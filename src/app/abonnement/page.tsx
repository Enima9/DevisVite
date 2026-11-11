import Link from 'next/link';
import { requireCompany } from '@/lib/quotes-server';
import { getSubscription } from '@/lib/billing';
import { PLAN, VAT_FRANCHISE, VAT_NOTICE, isBillingEnabled, planPriceLabel } from '@/lib/billing-config';
import { isEntitled } from '@/lib/stripe';
import { openPortal, startCheckout } from '@/app/actions/billing';

export const metadata = { title: 'Mon abonnement', robots: { index: false, follow: false } };

const STATUS_TEXT: Record<string, string> = {
  none: 'Aucun abonnement',
  incomplete: 'Paiement en attente',
  incomplete_expired: 'Paiement expiré',
  trialing: 'Période d’essai',
  active: 'Actif',
  past_due: 'Paiement en échec',
  canceled: 'Résilié',
  unpaid: 'Impayé',
  paused: 'En pause',
};

export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; paiement?: string }>;
}) {
  const sp = await searchParams;
  const { companyId } = await requireCompany();
  const sub = await getSubscription(companyId);
  const enabled = isBillingEnabled();
  const entitled = isEntitled(sub);
  const price = planPriceLabel();
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <Link href="/dashboard" className="text-sm font-medium text-brand underline">
        ← Tableau de bord
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Mon abonnement</h1>

      {sp.error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">
          {sp.error}
        </p>
      )}
      {sp.paiement === 'ok' && !entitled && (
        <p role="status" className="mt-4 rounded-xl border border-blue-300 bg-blue-50 p-3 text-slate-800">
          Merci ! Votre paiement est en cours de confirmation, cela prend quelques secondes. Rechargez cette page.
        </p>
      )}
      {sp.paiement === 'annule' && (
        <p role="status" className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-800">
          Paiement annulé. Aucun prélèvement n’a été effectué.
        </p>
      )}

      {!enabled ? (
        <section className="mt-5 rounded-xl border border-slate-300 bg-white p-4">
          <p className="font-semibold">Bientôt disponible</p>
          <p className="mt-1 text-slate-700">
            L’abonnement n’est pas encore ouvert. En attendant, le téléchargement de vos devis reste libre.
          </p>
        </section>
      ) : (
        <>
          <section className="mt-5 rounded-xl border border-slate-300 bg-white p-4" aria-labelledby="etat">
            <h2 id="etat" className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              État
            </h2>
            <p className="mt-1 text-xl font-bold">
              {sub?.comped ? 'Accès offert' : STATUS_TEXT[sub?.status ?? 'none'] ?? sub?.status}
            </p>
            {sub?.current_period_end && entitled && !sub.comped && (
              <p className="mt-1 text-slate-700">
                {sub.cancel_at_period_end
                  ? `Résilié : accès jusqu’au ${fmt(sub.current_period_end)}.`
                  : `Prochain renouvellement : ${fmt(sub.current_period_end)}.`}
              </p>
            )}
            {sub?.status === 'past_due' && (
              <p className="mt-1 text-red-800">Votre dernier paiement a échoué. Mettez à jour votre carte pour retrouver l’accès.</p>
            )}
          </section>

          {!entitled && (
            <section className="mt-5 rounded-xl border-2 border-brand bg-white p-4" aria-labelledby="offre">
              <h2 id="offre" className="text-lg font-bold">
                {PLAN.name}
              </h2>
              <p className="mt-1 text-2xl font-bold">{price}</p>
              {VAT_FRANCHISE && <p className="text-sm text-slate-600">{VAT_NOTICE}</p>}
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-800">
                {PLAN.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <form action={startCheckout} className="mt-4">
                <button type="submit" className="btn-primary">
                  S’abonner
                </button>
              </form>
              <p className="mt-3 text-sm text-slate-600">
                Paiement sécurisé par Stripe. Résiliation possible à tout moment. En vous abonnant, vous acceptez les{' '}
                <Link href="/cgv" className="font-medium text-brand underline">
                  conditions de vente
                </Link>
                .
              </p>
            </section>
          )}

          {(sub && sub.status !== 'none' && !sub.comped) && (
            <form action={openPortal} className="mt-5">
              <button type="submit" className="btn-secondary">
                Gérer mon abonnement et mes factures
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
