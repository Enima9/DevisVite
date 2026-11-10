import { createClient } from '@/lib/supabase/server';
import { isBillingEnabled } from '@/lib/billing-config';
import { isEntitled, type SubscriptionRow } from '@/lib/stripe';

export async function getSubscription(companyId: string): Promise<SubscriptionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end, comped')
    .eq('company_id', companyId)
    .maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

/**
 * Peut-on télécharger les devis ?
 * Tant que l'abonnement n'est pas activé (prix + clés Stripe), le téléchargement reste libre.
 */
export async function canDownloadQuotes(companyId: string): Promise<boolean> {
  if (!isBillingEnabled()) return true;
  return isEntitled(await getSubscription(companyId));
}
