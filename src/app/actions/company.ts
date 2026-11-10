'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { companySchema } from '@/lib/validation';
import { CATALOG_SEEDS, type TradeValue } from '@/lib/catalog-seeds';

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
  const seeds = CATALOG_SEEDS[values.trade as TradeValue] ?? [];
  if (seeds.length > 0) {
    await supabase.from('catalog_items').insert(
      seeds.map((item) => ({ ...item, company_id: company.id }))
    );
  }

  redirect('/dashboard?bienvenue=1');
}
