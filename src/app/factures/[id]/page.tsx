import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCompany } from '@/lib/quotes-server';
import { canDownloadQuotes } from '@/lib/billing';
import { createClient } from '@/lib/supabase/server';
import { loadInvoice } from '@/lib/invoices-server';
import { formatDateFr, invoiceTotals, OPERATION_LABELS } from '@/lib/invoices';
import { formatEuro, UNIT_LABELS } from '@/lib/money';
import { createCreditNote, markInvoicePaid } from '@/app/actions/invoices';

export const metadata = { title: 'Facture', robots: { index: false, follow: false } };

const METHODS: [string, string][] = [
  ['virement', 'Virement'],
  ['cheque', 'Chèque'],
  ['especes', 'Espèces'],
  ['carte', 'Carte bancaire'],
  ['autre', 'Autre'],
];

export default async function FactureDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; cree?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { companyId } = await requireCompany();
  const loaded = await loadInvoice(id);
  if (!loaded || loaded.row.company_id !== companyId) notFound();
  const { doc, row } = loaded;
  const canDownload = await canDownloadQuotes(companyId);
  const totals = invoiceTotals(doc);
  const credit = doc.kind === 'credit_note';
  const exempt = doc.seller.vat_exemption;
  const totalTtc = totals.total_ht_cents + (exempt ? 0 : totals.total_vat_cents);
  const prepaid = credit ? 0 : totals.deposit_cents;

  const supabase = await createClient();
  const { data: creditNote } = credit
    ? { data: null }
    : await supabase.from('invoices').select('id, reference').eq('credits_invoice_id', id).maybeSingle();

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <Link href="/factures" className="text-sm text-brand">← Mes factures</Link>
      <div className="mt-2 mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{doc.reference}</h1>
          <p className="text-slate-600">{doc.buyer.name}</p>
          <p className="text-xs text-slate-500">
            {credit ? `Avoir sur la facture ${doc.credits_reference ?? ''}` : OPERATION_LABELS[doc.operation_category]} · émise le{' '}
            {formatDateFr(doc.issue_date)}
          </p>
        </div>
        {!credit && (
          <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${row.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
            {row.status === 'paid' ? 'Payée ✓' : 'À encaisser'}
          </span>
        )}
      </div>

      {sp.cree && (
        <p role="status" className="mb-4 rounded-xl border border-green-300 bg-green-50 p-3 text-green-900">
          {credit ? 'Avoir émis.' : 'Facture émise.'} Le numéro est définitif.
        </p>
      )}
      {sp.error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{sp.error}</p>
      )}

      <section className="card mb-5">
        <ul className="divide-y divide-slate-100">
          {doc.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 py-2 text-sm">
              <span>
                {l.label}
                <span className="block text-xs text-slate-500">
                  {l.quantity.toLocaleString('fr-FR')} {UNIT_LABELS[l.unit]} × {l.unit_price_ht.toLocaleString('fr-FR')} € HT
                </span>
              </span>
              <span className="whitespace-nowrap font-semibold">{formatEuro(totals.lines[i].line_ht_cents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between py-0.5"><span>Total HT</span><span>{formatEuro(totals.total_ht_cents)}</span></div>
          {exempt ? (
            <p className="py-0.5 text-slate-500">TVA non applicable, art. 293 B du CGI</p>
          ) : (
            totals.vat_buckets.map((b) => (
              <div key={b.rate} className="flex justify-between py-0.5 text-slate-500">
                <span>TVA {b.rate.toLocaleString('fr-FR')} %</span><span>{formatEuro(b.vat_cents)}</span>
              </div>
            ))
          )}
          <div className="flex justify-between pt-1 text-base font-bold"><span>Total TTC</span><span>{formatEuro(totalTtc)}</span></div>
          {prepaid > 0 && (
            <div className="flex justify-between py-0.5 text-slate-500"><span>Acompte déjà réglé</span><span>- {formatEuro(prepaid)}</span></div>
          )}
          <div className="flex justify-between pt-1 text-base font-bold text-brand">
            <span>{credit ? 'Montant de l’avoir' : 'Net à payer'}</span><span>{formatEuro(totalTtc - prepaid)}</span>
          </div>
          {!credit && <p className="mt-2 text-xs text-slate-500">À régler avant le {formatDateFr(doc.due_date)}.</p>}
        </div>
      </section>

      <section className="space-y-3">
        {canDownload ? (
          <>
            <a href={`/api/invoices/${id}/pdf`} target="_blank" className="btn-primary">📄 PDF Factur-X</a>
            <a href={`/api/invoices/${id}/xml`} className="btn-secondary">⬇️ Fichier XML (données de la facture)</a>
          </>
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-semibold">🔒 Le téléchargement est réservé aux abonnés</p>
            <Link href="/abonnement" className="btn-primary mt-3">S’abonner pour télécharger</Link>
          </div>
        )}

        {!credit && row.status === 'issued' && (
          <form action={markInvoicePaid} className="card space-y-3">
            <input type="hidden" name="id" value={id} />
            <label htmlFor="payment_method" className="label">Enregistrer le paiement</label>
            <select id="payment_method" name="payment_method" className="input" defaultValue="virement">
              {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="btn-secondary !text-green-700">Marquer comme payée</button>
          </form>
        )}
        {!credit && row.status === 'paid' && row.paid_at && (
          <p className="text-center text-sm text-slate-600">
            Payée le {new Date(row.paid_at).toLocaleDateString('fr-FR')} ({METHODS.find(([v]) => v === row.payment_method)?.[1] ?? 'paiement'}).
          </p>
        )}

        {!credit && (
          creditNote ? (
            <p className="text-center text-sm">
              Avoir émis : <Link href={`/factures/${creditNote.id}`} className="font-semibold text-brand underline">{creditNote.reference}</Link>
            </p>
          ) : (
            <form action={createCreditNote} className="card">
              <input type="hidden" name="invoice_id" value={id} />
              <p className="text-sm text-slate-700">
                Une erreur sur cette facture ? Elle ne peut pas être modifiée : émettez un avoir qui l’annule en totalité,
                puis refacturez si besoin.
              </p>
              <button className="mt-3 w-full py-2 text-sm font-semibold text-red-600">Annuler par un avoir</button>
            </form>
          )
        )}
      </section>
      <div className="pb-8" />
    </main>
  );
}
