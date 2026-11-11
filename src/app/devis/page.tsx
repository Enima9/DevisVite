import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/quotes-server';
import { computeQuoteTotals, formatEuro, type LineInput, type VatRate } from '@/lib/money';

export const metadata = { title: 'Mes devis', robots: { index: false, follow: false } };

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-700' },
  sent: { label: 'Envoyé', cls: 'bg-blue-100 text-blue-800' },
  viewed: { label: 'Consulté', cls: 'bg-amber-100 text-amber-800' },
  accepted: { label: 'Accepté ✓', cls: 'bg-green-100 text-green-800' },
  refused: { label: 'Refusé', cls: 'bg-red-100 text-red-700' },
  expired: { label: 'Expiré', cls: 'bg-slate-100 text-slate-600' },
};

export default async function DevisListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { companyId } = await requireCompany();
  const supabase = await createClient();

  const { data: quotes } = await supabase
    .from('quotes')
    .select('*, client:clients(name), lines:quote_lines(*)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes devis</h1>
        <Link href="/devis/nouveau" className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white">
          + Nouveau
        </Link>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {(quotes ?? []).length === 0 ? (
        <div className="card text-center">
          <p className="text-4xl">📄</p>
          <h2 className="mt-2 font-bold">Aucun devis pour le moment</h2>
          <p className="mt-1 text-slate-600">Créez votre premier devis en moins de 2 minutes.</p>
          <Link href="/devis/nouveau" className="btn-primary mt-5">
            Créer un devis
          </Link>
        </div>
      ) : (
        <ul className="space-y-3 pb-8">
          {(quotes ?? []).map((q) => {
            const s = STATUS_STYLES[q.status] ?? STATUS_STYLES.draft;
            const totals = computeQuoteTotals(
              ((q.lines ?? []) as Record<string, unknown>[]).map((l) => ({
                label: String(l.label),
                unit: l.unit as LineInput['unit'],
                quantity: Number(l.quantity),
                unit_price_ht: Number(l.unit_price_ht),
                vat_rate: Number(l.vat_rate) as VatRate,
                discount: Number(l.discount),
              })),
              Number(q.global_discount),
              Number(q.deposit_amount)
            );
            return (
              <li key={q.id}>
                <Link href={`/devis/${q.id}`} className="card block">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{q.reference}</p>
                      <p className="text-sm text-slate-600">
                        {q.client?.name}
                        {q.title ? ` — ${q.title}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(q.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
                        {s.label}
                      </span>
                      <p className="mt-1 font-bold">{formatEuro(totals.total_ttc_cents)} TTC</p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
