import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/quotes-server';
import { formatEuro } from '@/lib/money';
import { formatDateFr } from '@/lib/invoices';

export const metadata = { title: 'Mes factures', robots: { index: false, follow: false } };

export default async function FacturesPage() {
  const { companyId } = await requireCompany();
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, reference, kind, status, issue_date, due_date, buyer_name, total_ttc_cents, amount_due_cents')
    .eq('company_id', companyId)
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <Link href="/dashboard" className="text-sm text-brand">← Tableau de bord</Link>
      <h1 className="mt-2 text-2xl font-bold">Mes factures</h1>
      <p className="mt-1 mb-5 text-slate-600">Factures et avoirs émis, au format électronique Factur-X.</p>

      {(invoices ?? []).length === 0 ? (
        <div className="card">
          <p className="font-semibold">Aucune facture pour l’instant.</p>
          <p className="mt-1 text-sm text-slate-600">
            Ouvrez un devis accepté et choisissez « Créer la facture ».
          </p>
          <Link href="/devis" className="btn-secondary mt-3">Voir mes devis</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {(invoices ?? []).map((i) => {
            const credit = i.kind === 'credit_note';
            const late = !credit && i.status === 'issued' && i.due_date < today;
            const badge = credit
              ? { label: 'Avoir', cls: 'bg-slate-100 text-slate-700' }
              : i.status === 'paid'
                ? { label: 'Payée ✓', cls: 'bg-green-100 text-green-800' }
                : late
                  ? { label: 'En retard', cls: 'bg-red-100 text-red-700' }
                  : { label: 'À encaisser', cls: 'bg-blue-100 text-blue-800' };
            return (
              <li key={i.id}>
                <Link href={`/factures/${i.id}`} className="card block">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{i.reference}</p>
                      <p className="text-sm text-slate-600">{i.buyer_name}</p>
                      <p className="text-xs text-slate-500">
                        Émise le {formatDateFr(i.issue_date)}
                        {credit ? '' : ` · échéance ${formatDateFr(i.due_date)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatEuro(Number(i.total_ttc_cents))}</p>
                      <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
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
