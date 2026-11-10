'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/quotes-server';
import { canDownloadQuotes } from '@/lib/billing';
import { SITE } from '@/lib/legal';
import { escapeHtml, isEmailConfigured, looksLikeEmail, sendEmail } from '@/lib/email';

export async function sendQuote(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const { companyId, company } = await requireCompany();
  const supabase = await createClient();
  const back = (qs: string): never => redirect(`/devis/${id}?${qs}`);

  const { data: quote } = await supabase
    .from('quotes')
    .select('id, reference, status, title, public_token, client:clients(name, email)')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!quote) redirect('/devis');

  if (quote.status === 'accepted' || quote.status === 'refused') {
    back('error=' + encodeURIComponent('Ce devis a déjà reçu une réponse : il ne peut plus être renvoyé.'));
  }

  // Le lien donne accès au devis complet : même règle que le téléchargement (abonnement requis).
  if (!(await canDownloadQuotes(companyId))) {
    back('error=' + encodeURIComponent('L’envoi au client est réservé aux abonnés.'));
  }

  const now = new Date();
  const { error } = await supabase
    .from('quotes')
    .update({
      status: quote.status === 'draft' || quote.status === 'expired' ? 'sent' : quote.status,
      sent_at: now.toISOString(),
      token_expires_at: new Date(now.getTime() + 90 * 86400000).toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('[sendQuote]', error.message);
    back('error=' + encodeURIComponent('L’envoi a échoué. Réessayez dans un instant.'));
  }
  await supabase.from('quote_events').insert({
    quote_id: id,
    company_id: companyId,
    event_type: 'sent',
    metadata: { channel: 'link' },
  });

  // Email automatique au client (si le service d'envoi est configuré et que le client a un email)
  const client = (Array.isArray(quote.client) ? quote.client[0] : quote.client) as
    | { name: string; email: string | null }
    | null;
  let mail = 'none';
  if (client?.email && looksLikeEmail(client.email) && isEmailConfigured()) {
    const link = `${SITE.url}/q/${quote.public_token}`;
    const name = escapeHtml(client.name);
    const co = escapeHtml(company.name);
    const subject = `Votre devis ${quote.reference} — ${company.name}`;
    const result = await sendEmail({
      to: client.email.trim(),
      subject,
      fromName: company.name,
      replyTo: company.email,
      text: `Bonjour ${client.name},\n\n${company.name} vous a envoyé le devis ${quote.reference}${
        quote.title ? ` (${quote.title})` : ''
      }.\nVous pouvez le consulter, l’accepter ou le refuser en ligne : ${link}\n\nCe lien est personnel.\n`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1B2430">
<p>Bonjour ${name},</p>
<p><strong>${co}</strong> vous a envoyé le devis <strong>${escapeHtml(quote.reference)}</strong>${
        quote.title ? ` (${escapeHtml(quote.title)})` : ''
      }.</p>
<p><a href="${link}" style="display:inline-block;background:#1F4FBF;color:#fff;padding:14px 22px;text-decoration:none;font-weight:bold;border-radius:4px">Consulter le devis</a></p>
<p style="font-size:13px;color:#475569">Vous pourrez l’accepter ou le refuser en ligne. Ce lien est personnel : ne le transmettez pas.</p></div>`,
    });
    await supabase.from('email_logs').insert({
      company_id: companyId,
      quote_id: id,
      kind: 'quote_sent',
      to_email: client.email.trim(),
      resend_id: result.ok ? result.id : null,
      status: result.ok ? 'sent' : 'failed',
      error_message: result.ok ? null : result.error,
    });
    mail = result.ok ? 'sent' : 'failed';
  }

  revalidatePath(`/devis/${id}`);
  revalidatePath('/devis');
  back(`envoye=1&mail=${mail}`);
}
