'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { companySchema } from '@/lib/validation';
import { seedRowsForTrade } from '@/lib/catalog-seeds';
import { LEGAL_VERSION } from '@/lib/legal';
import { stripeRequest } from '@/lib/stripe';

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
    vat_number: formData.get('vat_number') || undefined,
    vat_on_debits: formData.get('vat_on_debits') === 'on',
    payment_terms: formData.get('payment_terms') || undefined,
    quote_validity_days: formData.get('quote_validity_days'),
    trade: formData.get('trade'),
  });

  if (!parsed.success) {
    redirect('/onboarding?error=' + encodeURIComponent(parsed.error.issues[0].message));
  }

  const values = parsed.data;

  // Acceptation des conditions : obligatoire, avec date et version conservées comme preuve
  if (formData.get('terms') !== 'on') {
    redirect(
      '/onboarding?error=' +
        encodeURIComponent('Vous devez accepter les conditions d’utilisation et la politique de confidentialité.')
    );
  }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      ...values,
      owner_id: user.id,
      terms_accepted_at: new Date().toISOString(),
      terms_version: LEGAL_VERSION,
    })
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
    vat_number: text('vat_number') || undefined,
    vat_on_debits: formData.get('vat_on_debits') === 'on',
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
      vat_number: v.vat_exemption ? null : (v.vat_number ?? null),
      vat_on_debits: v.vat_exemption ? false : v.vat_on_debits,
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

/** Droit à l'effacement : supprime le compte et, en cascade, toutes les données liées. */
export async function deleteAccount(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== 'SUPPRIMER') {
    redirect('/reglages?error=' + encodeURIComponent('Tapez SUPPRIMER pour confirmer la suppression de votre compte.'));
  }

  // Résilie l'abonnement Stripe AVANT la suppression, pour ne plus prélever un compte supprimé.
  if (process.env.STRIPE_SECRET_KEY) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .maybeSingle();
    if (sub?.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(sub.status)) {
      try {
        await stripeRequest('DELETE', `/subscriptions/${sub.stripe_subscription_id}`);
      } catch (e) {
        console.error('[deleteAccount] résiliation Stripe', e);
        redirect('/reglages?error=' + encodeURIComponent('Votre abonnement n’a pas pu être résilié. Résiliez-le depuis « Mon abonnement » puis réessayez.'));
      }
    }
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    console.error('[deleteAccount]', error.message);
    redirect('/reglages?error=' + encodeURIComponent('La suppression a échoué. Réessayez ou contactez-nous.'));
  }

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Le compte n'existe plus : on efface simplement la session locale.
  }
  redirect('/login?compte-supprime=1');
}
