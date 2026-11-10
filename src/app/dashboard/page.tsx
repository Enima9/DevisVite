import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <p className="mt-1 mb-6 text-slate-600">Vos statistiques arrivent en phase 6.</p>
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
    </main>
  );
}
