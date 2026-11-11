'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createPublicClient, isUuid } from '@/lib/supabase/public';
import { loadPublicQuote } from '@/lib/public-quote';

export interface PublicActionState {
  error?: string;
}

const REASONS = ['too_expensive', 'other_quote', 'postponed', 'other'] as const;

export async function acceptQuote(_prev: PublicActionState, formData: FormData): Promise<PublicActionState> {
  const token = String(formData.get('token') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!isUuid(token)) return { error: 'Lien invalide.' };
  if (name.length < 3 || name.length > 120) return { error: 'Saisissez votre nom complet pour signer.' };
  if (formData.get('accord') !== 'on') return { error: 'Cochez la case « Bon pour accord » pour accepter le devis.' };

  const data = await loadPublicQuote(token);
  if (!data) return { error: 'Ce devis est introuvable ou son lien a expiré.' };
  if (data.quote.status === 'accepted') redirect(`/q/${token}`);
  if (data.quote.status !== 'sent' && data.quote.status !== 'viewed') {
    return { error: 'Ce devis ne peut plus être accepté.' };
  }
  if (new Date(data.quote.valid_until + 'T23:59:59') < new Date()) {
    return { error: 'La validité de ce devis est dépassée. Contactez l’entreprise pour obtenir un nouveau devis.' };
  }

  // Empreinte SHA-256 du contenu exact accepté (preuve de ce qui a été signé)
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        ref: data.quote.reference,
        company: data.quote.company_name,
        client: data.quote.client_name,
        lines: data.lines,
        discount: data.extra.global_discount,
        deposit: data.extra.deposit_amount,
        totals: [data.totals.total_ht_cents, data.totals.total_ttc_cents],
        valid_until: data.quote.valid_until,
      })
    )
    .digest('hex');

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const ua = (h.get('user-agent') ?? '').slice(0, 300) || null;

  const db = createPublicClient();
  await db.rpc('mark_public_quote_viewed', { p_token: token }); // la signature exige le statut « consulté »
  const { error } = await db.rpc('save_public_signature', {
    p_token: token,
    p_signed_by_name: name,
    p_drawn_signature: null,
    p_typed_name: true,
    p_ip: ip && /^[0-9a-f:.]+$/i.test(ip) ? ip : null,
    p_user_agent: ua,
    p_document_hash: hash,
  });
  if (error) {
    console.error('[acceptQuote]', error.message);
    return { error: 'L’acceptation n’a pas pu être enregistrée. Réessayez dans un instant.' };
  }
  redirect(`/q/${token}`);
}

export async function refuseQuote(_prev: PublicActionState, formData: FormData): Promise<PublicActionState> {
  const token = String(formData.get('token') ?? '');
  const reason = String(formData.get('reason') ?? '');
  const comment = String(formData.get('comment') ?? '').trim().slice(0, 500);
  if (!isUuid(token)) return { error: 'Lien invalide.' };
  if (!(REASONS as readonly string[]).includes(reason)) return { error: 'Choisissez un motif de refus.' };

  const db = createPublicClient();
  const { error } = await db.rpc('set_public_quote_refused', {
    p_token: token,
    p_reason: reason,
    p_comment: comment || null,
  });
  if (error) {
    console.error('[refuseQuote]', error.message);
    return { error: 'Le refus n’a pas pu être enregistré. Réessayez dans un instant.' };
  }
  redirect(`/q/${token}`);
}
