import { createClient } from '@supabase/supabase-js';

/**
 * Client « service role » : contourne les règles de sécurité (RLS).
 * À utiliser UNIQUEMENT côté serveur, pour les écritures d'abonnement (webhook Stripe).
 * Ne jamais exposer cette clé au navigateur (pas de préfixe NEXT_PUBLIC_).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
