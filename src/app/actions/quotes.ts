'use server';

import { createClient } from '@/lib/supabase/server';
import { nextQuoteReference } from '@/lib/quotes-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const lineSchema = z.object({
  label: z.string().min(1),
  unit: z.enum(['u', 'h', 'm2', 'ml', 'forfait']),
  quantity: z.coerce.number().min(0),
  unit_price_ht: z.coerce.number().min(0),
  vat_rate: z.coerce.number().refine((v) => [0, 2.1, 5.5, 10, 20].includes(v), 'Taux de TVA invalide'),
  discount: z.coerce.number().min(0).max(100).default(0),
  estimated: z.coerce.boolean().default(false),
  source: z.enum(['catalog', 'ai', 'manual']).default('manual'),
});

function fail(message: string): never {
  redirect('/devis/nouveau?error=' + encodeURIComponent(message));
}

const payloadSchema = z
  .object({
    id: z.string().uuid().optional(),
    client_id: z.string().uuid().optional(),
    new_client: z
      .object({
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        site_address: z.string().optional(),
      })
      .optional(),
    title: z.string().optional(),
    execution_delay: z.string().optional(),
    valid_until: z.string().min(8),
    global_discount: z.coerce.number().min(0).default(0),
    deposit_amount: z.coerce.number().min(0).default(0),
    intro_text: z.string().optional(),
    lines: z.array(lineSchema).min(1, 'Ajoutez au moins une ligne au devis'),
    save_as_template: z.boolean().default(false),
    template_name: z.string().optional(),
  })
  .refine((p) => p.client_id || p.new_client, {
    message: 'Choisissez un client ou créez-en un',
    path: ['client_id'],
  });

export async function saveQuote(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!company) redirect('/onboarding');

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('payload') ?? '{}'));
  } catch {
    fail('Données du devis invalides');
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    fail(parsed.error.issues[0].message);
  }
  const p = parsed.data;

  // Client : existant (vérifié par RLS) ou création rapide
  let clientId = p.client_id;
  if (!clientId && p.new_client) {
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        company_id: company.id,
        name: p.new_client.name,
        email: p.new_client.email || null,
        phone: p.new_client.phone || null,
        site_address: p.new_client.site_address || null,
      })
      .select('id')
      .single();
    if (error || !client) {
      fail('Création du client impossible. Vérifiez les informations saisies et réessayez.');
    }
    clientId = client.id;
  }

  const quoteValues = {
    company_id: company.id,
    client_id: clientId!,
    title: p.title || null,
    execution_delay: p.execution_delay || null,
    valid_until: p.valid_until,
    global_discount: p.global_discount,
    deposit_amount: p.deposit_amount,
    intro_text: p.intro_text || null,
  };

  let quoteId = p.id;
  let isNewQuote = false;

  if (quoteId) {
    // Mise à jour d'un brouillon existant (RLS protège l'accès)
    const { error } = await supabase
      .from('quotes')
      .update(quoteValues)
      .eq('id', quoteId)
      .eq('status', 'draft');
    if (error) {
      fail('Enregistrement impossible. Réessayez dans un instant.');
    }
    const { error: delError } = await supabase.from('quote_lines').delete().eq('quote_id', quoteId);
    if (delError) fail('Enregistrement impossible. Réessayez dans un instant.');
  } else {
    // Nouveau devis : référence DEV-<année>-000N (on retente si deux envois se croisent)
    let created: { id: string } | null = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const reference = await nextQuoteReference(company.id, attempt);
      const { data: quote, error } = await supabase
        .from('quotes')
        .insert({ ...quoteValues, reference, status: 'draft' })
        .select('id')
        .single();
      if (quote) {
        created = quote;
      } else if (error?.code !== '23505') {
        console.error('[saveQuote] création du devis impossible :', error?.message);
        fail('Création du devis impossible. Réessayez dans un instant.');
      }
    }
    if (!created) fail('Création du devis impossible (numérotation). Réessayez.');
    quoteId = created.id;
    const usedAi = p.lines.some((l) => l.source === 'ai');
    await supabase.from('quote_events').insert({
      quote_id: quoteId,
      company_id: company.id,
      event_type: 'created',
      metadata: { mode: usedAi ? 'ia' : 'manuel' },
    });
    isNewQuote = true;
  }

  // Lignes (le marquage "prix estimé" est conservé pour l'historique)
  const { error: linesError } = await supabase.from('quote_lines').insert(
    p.lines.map((l, i) => ({
      quote_id: quoteId,
      position: i,
      label: l.label,
      unit: l.unit,
      quantity: l.quantity,
      unit_price_ht: l.unit_price_ht,
      vat_rate: l.vat_rate,
      discount: l.discount,
      price_is_estimated: l.estimated,
      source: l.source,
    }))
  );
  if (linesError) {
    console.error('[saveQuote] insertion des lignes impossible :', linesError.message);
    // Un devis sans lignes n'a aucun sens : on annule la création.
    if (isNewQuote) await supabase.from('quotes').delete().eq('id', quoteId!);
    fail('Les lignes du devis n\u2019ont pas pu être enregistrées. Réessayez.');
  }

  // Modèle réutilisable
  if (p.save_as_template) {
    const { data: tpl } = await supabase
      .from('quote_templates')
      .insert({
        company_id: company.id,
        name: p.template_name || p.title || 'Modèle sans nom',
        intro_text: p.intro_text || null,
      })
      .select('id')
      .single();
    if (tpl) {
      await supabase.from('quote_template_lines').insert(
        p.lines.map((l, i) => ({
          template_id: tpl.id,
          position: i,
          label: l.label,
          unit: l.unit,
          quantity: l.quantity,
          unit_price_ht: l.unit_price_ht,
          vat_rate: l.vat_rate,
          discount: l.discount,
        }))
      );
    }
  }

  revalidatePath('/devis');
  redirect(`/devis/${quoteId}`);
}

export async function deleteQuote(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await supabase.from('quotes').delete().eq('id', id).eq('status', 'draft');
  revalidatePath('/devis');
  redirect('/devis');
}

export async function markQuoteStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !['accepted', 'refused'].includes(status)) return;

  const patch: Record<string, unknown> =
    status === 'accepted'
      ? { status: 'accepted', accepted_at: new Date().toISOString(), manual_accepted: true }
      : { status: 'refused', refused_at: new Date().toISOString() };

  // RLS : ne fonctionne que sur un devis de l'artisan
  const { data: quote } = await supabase
    .from('quotes')
    .update(patch)
    .eq('id', id)
    .select('company_id')
    .single();
  if (quote) {
    await supabase.from('quote_events').insert({
      quote_id: id,
      company_id: quote.company_id,
      event_type: 'manual_status',
      metadata: { status },
    });
  }
  revalidatePath(`/devis/${id}`);
  revalidatePath('/devis');
}
