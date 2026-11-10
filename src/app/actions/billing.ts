'use server';

import { redirect } from 'next/navigation';
import { requireCompany } from '@/lib/quotes-server';
import { createClient } from '@/lib/supabase/server';
import { PLAN, isBillingEnabled } from '@/lib/billing-config';
import { stripeRequest, StripeError } from '@/lib/stripe';
import { SITE } from '@/lib/legal';

const back = (msg: string): never => redirect('/abonnement?error=' + encodeURIComponent(msg));

async function ensureCustomer(companyId: string, email: string | null, name: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('company_id', companyId)
    .maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;

  const customer = await stripeRequest<{ id: string }>('POST', '/customers', {
    name,
    email: email ?? undefined,
    metadata: { company_id: companyId },
  });
  // Le lien client ⇄ entreprise est enregistré par le webhook (écriture réservée au serveur).
  return customer.id;
}

export async function startCheckout() {
  const { companyId, company } = await requireCompany();
  if (!isBillingEnabled() || PLAN.priceCents === null) back('L’abonnement n’est pas encore disponible.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let url: string | undefined;
  try {
    const customer = await ensureCustomer(companyId, company.email ?? user?.email ?? null, company.name);
    const session = await stripeRequest<{ url?: string }>('POST', '/checkout/sessions', {
      mode: 'subscription',
      customer,
      client_reference_id: companyId,
      success_url: `${SITE.url}/abonnement?paiement=ok`,
      cancel_url: `${SITE.url}/abonnement?paiement=annule`,
      locale: 'fr',
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { name: 'auto', address: 'auto' },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: PLAN.currency,
            unit_amount: PLAN.priceCents,
            recurring: { interval: PLAN.interval },
            tax_behavior: PLAN.taxBehavior,
            product_data: { name: PLAN.name },
          },
        },
      ],
      subscription_data: {
        metadata: { company_id: companyId },
        ...(PLAN.trialDays > 0 ? { trial_period_days: PLAN.trialDays } : {}),
      },
      metadata: { company_id: companyId },
    });
    url = session.url;
  } catch (e) {
    console.error('[startCheckout]', e instanceof StripeError ? e.message : e);
    back('Le paiement n’a pas pu démarrer. Réessayez dans un instant.');
  }
  if (!url) back('Le paiement n’a pas pu démarrer. Réessayez dans un instant.');
  redirect(url as string);
}

export async function openPortal() {
  const { companyId } = await requireCompany();
  if (!isBillingEnabled()) back('L’abonnement n’est pas encore disponible.');

  const supabase = await createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('company_id', companyId)
    .maybeSingle();
  if (!data?.stripe_customer_id) back('Aucun abonnement à gérer.');

  let url: string | undefined;
  try {
    const session = await stripeRequest<{ url?: string }>('POST', '/billing_portal/sessions', {
      customer: data?.stripe_customer_id,
      return_url: `${SITE.url}/abonnement`,
    });
    url = session.url;
  } catch (e) {
    console.error('[openPortal]', e instanceof StripeError ? e.message : e);
    back('Le portail de gestion est momentanément indisponible.');
  }
  if (!url) back('Le portail de gestion est momentanément indisponible.');
  redirect(url as string);
}
