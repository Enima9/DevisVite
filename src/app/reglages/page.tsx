import Link from 'next/link';
import { requireCompany } from '@/lib/quotes-server';
import OnboardingForm from '../onboarding/form';
import { deleteAccount } from '@/app/actions/company';

export const metadata = { title: 'Réglages', robots: { index: false, follow: false } };

export default async function ReglagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { company } = await requireCompany();
  const { error, saved } = await searchParams;

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <Link href="/dashboard" className="text-sm text-brand">← Tableau de bord</Link>
      <h1 className="mt-2 text-2xl font-bold">Réglages</h1>
      <p className="mt-1 mb-6 text-slate-600">
        Les informations de votre entreprise, reprises sur tous vos devis.
      </p>
      {saved && (
        <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">Réglages enregistrés ✓</p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <OnboardingForm mode="edit" initial={company} />

      <section aria-labelledby="mes-donnees" className="card mt-8 space-y-4">
        <h2 id="mes-donnees" className="text-lg font-bold">Mes données</h2>
        <p className="text-sm text-slate-700">
          Vous gardez la main sur vos données (RGPD). Voir la{' '}
          <Link href="/confidentialite" className="font-medium text-brand underline">politique de confidentialité</Link>.
        </p>
        <a href="/api/account/export" download className="btn-secondary">
          ⬇️ Télécharger mes données (JSON)
        </a>

        <form action={deleteAccount} className="space-y-3 rounded-xl border-2 border-red-300 p-4">
          <h3 className="font-bold text-red-700">Supprimer mon compte</h3>
          <p className="text-sm text-slate-700">
            Supprime immédiatement et définitivement votre compte, votre entreprise, vos clients, devis et catalogue.
            Pensez à télécharger vos données d&apos;abord : cette action est irréversible.
          </p>
          <label htmlFor="confirm" className="label">Pour confirmer, tapez SUPPRIMER</label>
          <input id="confirm" name="confirm" required autoComplete="off" className="input" />
          <button type="submit" className="btn-primary !bg-red-700">Supprimer définitivement mon compte</button>
        </form>
      </section>
      <div className="pb-8" />
    </main>
  );
}
