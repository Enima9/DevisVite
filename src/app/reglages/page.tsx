import Link from 'next/link';
import { requireCompany } from '@/lib/quotes-server';
import OnboardingForm from '../onboarding/form';

export default async function ReglagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { company } = await requireCompany();
  const { error, saved } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <Link href="/dashboard" className="text-sm text-brand">← Tableau de bord</Link>
      <h1 className="mt-2 text-2xl font-bold">Réglages</h1>
      <p className="mt-1 mb-6 text-slate-600">
        Les informations de votre entreprise, reprises sur tous vos devis.
      </p>
      {saved && (
        <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">Réglages enregistrés ✓</p>
      )}
      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <OnboardingForm mode="edit" initial={company} />
      <div className="pb-8" />
    </main>
  );
}
