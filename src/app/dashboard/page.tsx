import Link from 'next/link';
import { requireCompany } from '@/lib/quotes-server';

export default async function DashboardPage() {
  const { company } = await requireCompany();

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <h1 className="text-2xl font-bold">Bonjour {company.name} 👋</h1>
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
      </div>
      <form action="/auth/signout" method="post" className="mt-8 text-center">
        <button type="submit" className="text-sm font-semibold text-slate-500 underline">
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
