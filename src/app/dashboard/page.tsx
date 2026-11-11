import Link from 'next/link';
import { requireCompany } from '@/lib/quotes-server';

export const metadata = { title: 'Tableau de bord', robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const { company } = await requireCompany();

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <h1 className="text-4xl">Bonjour {company.name}</h1>
      <p className="mb-7 mt-2 border-b border-brass/40 pb-5 text-slate-600">Que voulez-vous faire ?</p>
      <div className="space-y-3">
        <Link href="/devis/nouveau" className="btn-primary">
          Créer un devis
        </Link>
        <Link href="/devis" className="btn-secondary">
          Mes devis
        </Link>
        <Link href="/factures" className="btn-secondary">
          Mes factures
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
        <button type="submit" className="text-sm font-semibold text-slate-500 underline underline-offset-4 hover:text-ink">
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
