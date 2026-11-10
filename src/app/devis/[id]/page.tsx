import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/quotes-server';
import { canDownloadQuotes } from '@/lib/billing';
import { computeQuoteTotals, formatEuro, UNIT_LABELS, type LineInput, type VatRate } from '@/lib/money';
import { deleteQuote, markQuoteStatus } from '@/app/actions/quotes';

export const metadata = { title: 'Détail du devis', robots: { index: false, follow: false } };

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-700' },
  sent: { label: 'Envoyé', cls: 'bg-blue-100 text-blue-800' },
  viewed: { label: 'Consulté', cls: 'bg-amber-100 text-amber-800' },
  accepted: { label: 'Accepté ✓', cls: 'bg-green-100 text-green-800' },
  refused: { label: 'Refusé', cls: 'bg-red-100 text-red-700' },
  expired: { label: 'Expiré', cls: 'bg-slate-100 text-slate-600' },
};

export default async function DevisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { companyId } = await requireCompany();
  const supabase = await createClient();
  const canDownload = await canDownloadQuotes(companyId);

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, client:clients(*)')
    .eq('id', id)
    .maybeSingle();
  if (!quote || quote.company_id !== companyId) notFound();

  const { data: lines } = await supabase
    .from('quote_lines')
    .select('*')
    .eq('quote_id', id)
    .order('position');

  const { data: events } = await supabase
    .from('quote_events')
    .select('*')
    .eq('quote_id', id)
    .order('created_at', { ascending: false });

  const pdfLines: LineInput[] = (lines ?? []).map((l) => ({
    label: l.label,
    unit: l.unit,
    quantity: Number(l.quantity),
    unit_price_ht: Number(l.unit_price_ht),
    vat_rate: Number(l.vat_rate) as VatRate,
    discount: Number(l.discount),
  }));
  const totals = computeQuoteTotals(pdfLines, Number(quote.global_discount), Number(quote.deposit_amount));

  const st = STATUS_LABELS[quote.status] ?? STATUS_LABELS.draft;
  const EVENT_LABELS: Record<string, string> = {
    created: 'Devis créé',
    sent: 'Envoyé au client',
    opened: 'Ouvert par le client',
    viewed: 'Consulté',
    followup: 'Relance envoyée',
    accepted: 'Accepté',
    refused: 'Refusé',
    expired: 'Expiré',
    signed: 'Signé électroniquement',
    manual_status: 'Statut mis à jour manuellement',
    ai_generated: 'Brouillon généré par l\u2019IA',
    ai_retried: 'Nouvelle génération IA',
  };

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <Link href="/devis" className="text-sm text-brand">← Mes devis</Link>
      <div className="mt-2 mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{quote.reference}</h1>
          <p className="text-slate-600">
            {quote.client?.name}
            {quote.title ? ` — ${quote.title}` : ''}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${st.cls}`}>{st.label}</span>
      </div>

      {/* Aperçu des lignes + totaux */}
      <section className="card mb-5">
        <ul className="divide-y divide-slate-100">
          {(lines ?? []).map((l, i) => (
            <li key={l.id} className="flex justify-between gap-3 py-2 text-sm">
              <span>
                {l.label}
                <span className="block text-xs text-slate-500">
                  {Number(l.quantity).toLocaleString('fr-FR')} {UNIT_LABELS[l.unit as keyof typeof UNIT_LABELS]} × {Number(l.unit_price_ht).toLocaleString('fr-FR')} € HT
                </span>
              </span>
              <span className="whitespace-nowrap font-semibold">{formatEuro(totals.lines[i].line_ht_cents)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between py-0.5"><span>Total HT</span><span>{formatEuro(totals.total_ht_cents)}</span></div>
          {totals.vat_buckets.map((b) => (
            <div key={b.rate} className="flex justify-between py-0.5 text-slate-500">
              <span>TVA {b.rate.toLocaleString('fr-FR')} %</span><span>{formatEuro(b.vat_cents)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-1 text-base font-bold"><span>Total TTC</span><span>{formatEuro(totals.total_ttc_cents)}</span></div>
        </div>
      </section>

      {/* Actions principales */}
      <section className="space-y-3">
        {canDownload ? (
          <a href={`/api/quotes/${quote.id}/pdf`} target="_blank" className="btn-primary">
            📄 Voir / exporter le PDF
          </a>
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="font-semibold text-slate-900">🔒 Le téléchargement est réservé aux abonnés</p>
            <p className="mt-1 text-sm text-slate-700">
              Votre devis est prêt. Abonnez-vous pour le télécharger en PDF.
            </p>
            <Link href="/abonnement" className="btn-primary mt-3">
              S’abonner pour télécharger
            </Link>
          </div>
        )}
        {quote.status === 'draft' && (
          <p className="text-center text-sm text-slate-500">
            L&apos;envoi au client arrive en phase 4. Le PDF est déjà conforme.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {quote.status !== 'accepted' && (
            <form action={markQuoteStatus}>
              <input type="hidden" name="id" value={quote.id} />
              <input type="hidden" name="status" value="accepted" />
              <button className="btn-secondary !text-green-700">Accepté (téléphone)</button>
            </form>
          )}
          {quote.status !== 'refused' && (
            <form action={markQuoteStatus}>
              <input type="hidden" name="id" value={quote.id} />
              <input type="hidden" name="status" value="refused" />
              <button className="btn-secondary !text-red-600">Perdu</button>
            </form>
          )}
        </div>
        {quote.status === 'draft' && (
          <form action={deleteQuote}>
            <input type="hidden" name="id" value={quote.id} />
            <button className="w-full py-2 text-sm font-semibold text-red-600">Supprimer ce brouillon</button>
          </form>
        )}
      </section>

      {/* Historique */}
      <section className="card mt-6">
        <h2 className="mb-3 font-bold">Historique</h2>
        <ul className="space-y-2 text-sm">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span>{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
              <span className="text-slate-500">
                {new Date(e.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <div className="pb-8" />
    </main>
  );
}
