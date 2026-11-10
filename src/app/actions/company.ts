'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { companySchema } from '@/lib/validation';
import { seedRowsForTrade } from '@/lib/catalog-seeds';

export async function saveCompany(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const parsed = companySchema.safeParse({
    name: formData.get('name'),
    legal_form: formData.get('legal_form') || undefined,
    siret: formData.get('siret') || undefined,
    address: formData.get('address') || undefined,
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || '',
    primary_color: formData.get('primary_color') || '#1d4ed8',
    iban: formData.get('iban') || undefined,
    insurance_provider: formData.get('insurance_provider') || undefined,
    insurance_policy_number: formData.get('insurance_policy_number') || undefined,
    default_vat_rate: Number(formData.get('default_vat_rate')),
    vat_exemption: formData.get('vat_exemption') === 'on',
    payment_terms: formData.get('payment_terms') || undefined,
    quote_validity_days: formData.get('quote_validity_days'),
    trade: formData.get('trade'),
  });

  if (!parsed.success) {
    redirect('/onboarding?error=' + encodeURIComponent(parsed.error.issues[0].message));
  }

  const values = parsed.data;

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({ ...values, owner_id: user.id })
    .select('id')
    .single();

  if (companyError || !company) {
    redirect('/onboarding?error=' + encodeURIComponent('Enregistrement impossible : ' + companyError?.message));
  }

  // Pré-remplissage du catalogue selon le métier choisi
  const rows = seedRowsForTrade(String(values.trade), company.id);
  if (rows.length > 0) {
    const { error: seedError } = await supabase.from('catalog_items').insert(rows);
    if (seedError) {
      // Non bloquant : l'artisan pourra charger les prestations depuis le catalogue.
      console.error('[saveCompany] pré-remplissage du catalogue impossible :', seedError.message);
    }
  }

  redirect('/dashboard?bienvenue=1');
}

/** Met à jour le profil de l'entreprise (page Réglages). Les champs vidés sont remis à NULL. */
export async function updateCompany(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const text = (key: string) => String(formData.get(key) ?? '').trim();
  const parsed = companySchema.safeParse({
    name: text('name'),
    legal_form: text('legal_form') || undefined,
    siret: text('siret') || undefined,
    address: text('address') || undefined,
    phone: text('phone') || undefined,
    email: text('email'),
    primary_color: text('primary_color') || '#1d4ed8',
    iban: text('iban') || undefined,
    insurance_provider: text('insurance_provider') || undefined,
    insurance_policy_number: text('insurance_policy_number') || undefined,
    default_vat_rate: Number(formData.get('default_vat_rate')),
    vat_exemption: formData.get('vat_exemption') === 'on',
    payment_terms: text('payment_terms') || undefined,
    quote_validity_days: formData.get('quote_validity_days'),
    trade: text('trade'),
  });
  if (!parsed.success) {
    redirect('/reglages?error=' + encodeURIComponent(parsed.error.issues[0].message));
  }
  const v = parsed.data;

  // Liste explicite : on ne touche jamais aux champs sensibles (propriétaire, budget IA…)
  const { error } = await supabase
    .from('companies')
    .update({
      name: v.name.trim(),
      legal_form: v.legal_form ?? null,
      siret: v.siret ? v.siret.replace(/\s/g, '') : null,
      address: v.address ?? null,
      phone: v.phone ?? null,
      email: v.email || null,
      primary_color: v.primary_color,
      iban: v.iban ?? null,
      insurance_provider: v.insurance_provider ?? null,
      insurance_policy_number: v.insurance_policy_number ?? null,
      default_vat_rate: v.default_vat_rate,
      vat_exemption: v.vat_exemption,
      payment_terms: v.payment_terms,
      quote_validity_days: v.quote_validity_days,
      trade: v.trade,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', user.id);
  if (error) {
    console.error('[updateCompany]', error.message);
    redirect('/reglages?error=' + encodeURIComponent('Les réglages n\u2019ont pas pu être enregistrés. Réessayez.'));
  }

  revalidatePath('/', 'layout');
  redirect('/reglages?saved=1');
}
