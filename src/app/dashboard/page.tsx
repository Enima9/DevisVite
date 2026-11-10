import Link from 'next/link';
import { requireCompany } from '@/lib/quotes-server';

export const metadata = { title: 'Tableau de bord', robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const { company } = await requireCompany();

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <h1 className="text-3xl font-bold">Bonjour {company.name}</h1>
      <p className="mt-1 mb-6 text-slate-600">Que voulez-vous faire ?</p>
      <div className="space-y-3">
        <Link href="/devis/nouveau" className="btn-primary">
          ➕ Créer un devis
        </Link>
        <Link href="/devis" className="btn-secondary">
          Mes devis
        </Link>
        <Link href="/catalogue" className="btn-secondary">
          Mon catalogue
        </Link>
        <Link href="/abonnement" className="btn-secondary">
          Mon abonnement
        </Link>
        <Link href="/reglages" className="btn-secondary">
          Réglages
        </Link>
      </div>
      <form action="/auth/signout" method="post" className="mt-8 text-center">
        <button type="submit" className="text-sm font-semibold text-slate-500 underline">
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
