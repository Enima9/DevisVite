/**
 * Offre d'abonnement — SEUL endroit où définir le prix.
 *
 * Tant que `priceCents` vaut null, l'abonnement est DÉSACTIVÉ : le téléchargement des devis
 * reste libre et la page Abonnement indique « bientôt disponible ».
 * Pour activer : renseignez le prix (en centimes) ET ajoutez les clés Stripe dans Vercel
 * (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY).
 */
export const PLAN = {
  name: 'DevisVite — abonnement',
  /** Prix en centimes d'euro (ex. 1900 = 19,00 €). null = abonnement désactivé. */
  priceCents: null as number | null,
  /** 'month' (mensuel) ou 'year' (annuel) */
  interval: 'month' as 'month' | 'year',
  /** 'inclusive' : le prix est TTC · 'exclusive' : le prix est HT (la TVA s'ajoute) */
  taxBehavior: 'inclusive' as 'inclusive' | 'exclusive',
  /** Jours d'essai gratuit avant le premier prélèvement (0 = aucun) */
  trialDays: 0,
  currency: 'eur',
  features: [
    'Téléchargement des devis en PDF, sans limite',
    'Devis générés par l’IA (dans la limite d’usage raisonnable)',
    'Catalogue, modèles et suivi des devis',
    'Résiliation à tout moment, en un clic',
  ],
} as const;

/** L'abonnement n'est actif que si le prix est défini ET que Stripe est configuré. */
export function isBillingEnabled(): boolean {
  return PLAN.priceCents !== null && Boolean(process.env.STRIPE_SECRET_KEY);
}

export function planPriceLabel(): string | null {
  if (PLAN.priceCents === null) return null;
  const amount = (PLAN.priceCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  const tax = PLAN.taxBehavior === 'inclusive' ? 'TTC' : 'HT';
  return `${amount} ${tax} / ${PLAN.interval === 'month' ? 'mois' : 'an'}`;
}
