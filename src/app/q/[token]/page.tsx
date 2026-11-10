import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createPublicClient, isUuid } from '@/lib/supabase/public';
import { loadPublicQuote } from '@/lib/public-quote';
import { UNIT_LABELS, formatEuro } from '@/lib/money';
import AnswerForms from './answer-forms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Votre devis',
  // Lien personnel : jamais indexé, aucune information envoyée aux sites externes
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const VAT = (r: number) => `${r.toLocaleString('fr-FR')} %`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isUuid(token)) notFound();

  let data = await loadPublicQuote(token);
  if (!data) {
    return (
      <main id="contenu" className="mx-auto max-w-md px-5 py-12 text-center">
        <h1 className="text-2xl font-bold">Ce devis n’est plus disponible</h1>
        <p className="mt-3 text-slate-700">
          Le lien est invalide ou a expiré. Contactez l’entreprise qui vous l’a envoyé pour en obtenir un nouveau.
        </p>
      </main>
    );
  }

  // Première ouverture : on note la consultation (l'entreprise le voit dans son suivi)
  if (data.quote.status === 'sent') {
    await createPublicClient().rpc('mark_public_quote_viewed', { p_token: token });
    data = { ...data, quote: { ...data.quote, status: 'viewed' } };
  }

  const { quote: q, lines, extra, totals } = data;
  const expired = new Date(q.valid_until + 'T23:59:59') < new Date();
  const open = (q.status === 'sent' || q.status === 'viewed') && !expired;
  const vatFree = q.company_vat_exemption;

  return (
    <main id="contenu" className="mx-auto max-w-2xl px-4 py-6">
      {q.status === 'accepted' && (
        <p role="status" className="mb-4 border-l-4 border-green-700 bg-green-50 p-4 font-semibold text-green-900">
          Vous avez accepté ce devis. {q.company_name} en a été informé et vous recontactera.
        </p>
      )}
      {q.status === 'refused' && (
        <p role="status" className="mb-4 border-l-4 border-slate-600 bg-slate-100 p-4 font-semibold text-slate-800">
          Vous avez refusé ce devis. Merci pour votre réponse.
        </p>
      )}
      {expired && (q.status === 'sent' || q.status === 'viewed') && (
        <p role="status" className="mb-4 border-l-4 border-amber-600 bg-amber-50 p-4 font-semibold text-amber-900">
          La validité de ce devis est dépassée ({fmtDate(q.valid_until)}). Contactez {q.company_name} pour un nouveau devis.
        </p>
      )}

      <article className="sheet">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Devis</h1>
            <p className="mt-1 text-slate-700">
              N° {q.reference} — {fmtDate(extra.created_at)}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-serif text-lg font-bold">
              {q.company_name}
              {extra.company_legal_form ? ` — ${extra.company_legal_form}` : ''}
            </p>
            {q.company_address && <p>{q.company_address}</p>}
            {q.company_phone && <p>Tél : {q.company_phone}</p>}
            {q.company_email && <p>{q.company_email}</p>}
            {q.company_siret && <p>SIRET {q.company_siret}</p>}
          </div>
        </header>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="border-l-4 border-brand bg-slate-50 p-3">
            <dt className="text-sm text-slate-600">Client</dt>
            <dd className="font-bold">{q.client_name}</dd>
            {q.client_site_address && <dd className="text-sm">Lieu des travaux : {q.client_site_address}</dd>}
          </div>
          <div className="border-l-4 border-brand bg-slate-50 p-3">
            <dt className="text-sm text-slate-600">Validité de l’offre</dt>
            <dd className="font-bold">Jusqu’au {fmtDate(q.valid_until)}</dd>
            {extra.execution_delay && <dd className="text-sm">Délai d’exécution : {extra.execution_delay}</dd>}
          </div>
        </dl>

        {q.title && <h2 className="mt-5 text-lg font-bold">{q.title}</h2>}
        {q.intro_text && <p className="mt-2 text-slate-700">{q.intro_text}</p>}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Détail du devis</caption>
            <thead>
              <tr className="border-y-2 border-ink">
                <th scope="col" className="py-2 pr-2">Désignation</th>
                <th scope="col" className="px-2 text-right">Qté</th>
                <th scope="col" className="px-2 text-right">P.U. HT</th>
                <th scope="col" className="px-2 text-right">TVA</th>
                <th scope="col" className="pl-2 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-300 align-top">
                  <td className="py-2 pr-2">
                    {l.label}
                    {l.discount > 0 && <span className="block text-xs text-slate-600">remise {l.discount} %</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 text-right">
                    {l.quantity.toLocaleString('fr-FR')} {UNIT_LABELS[l.unit]}
                  </td>
                  <td className="whitespace-nowrap px-2 text-right">{formatEuro(Math.round(l.unit_price_ht * 100))}</td>
                  <td className="whitespace-nowrap px-2 text-right">{VAT(l.vat_rate)}</td>
                  <td className="whitespace-nowrap pl-2 text-right font-semibold">{formatEuro(totals.lines[i].line_ht_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-4 max-w-xs text-sm">
          {totals.global_discount_cents > 0 && (
            <div className="flex justify-between py-0.5"><span>Remise globale</span><span>− {formatEuro(totals.global_discount_cents)}</span></div>
          )}
          <div className="flex justify-between py-0.5"><span>Total HT</span><span>{formatEuro(totals.total_ht_cents)}</span></div>
          {!vatFree &&
            totals.vat_buckets.map((b) => (
              <div key={b.rate} className="flex justify-between py-0.5 text-slate-700">
                <span>TVA {VAT(b.rate)}</span>
                <span>{formatEuro(b.vat_cents)}</span>
              </div>
            ))}
          <div className="mt-1 flex justify-between bg-brand px-3 py-2 text-base font-bold text-white">
            <span>Total TTC</span>
            <span>{formatEuro(vatFree ? totals.total_ht_cents : totals.total_ttc_cents)}</span>
          </div>
          {vatFree && <p className="mt-1 text-right text-xs text-slate-600">TVA non applicable, art. 293 B du CGI</p>}
          {extra.deposit_amount > 0 && (
            <p className="mt-2 text-right text-slate-700">Acompte demandé : {formatEuro(Math.round(extra.deposit_amount * 100))}</p>
          )}
        </div>

        {q.outro_text && <p className="mt-5 text-slate-700">{q.outro_text}</p>}

        <footer className="mt-6 border-t border-slate-300 pt-3 text-xs leading-relaxed text-slate-700">
          <p>{q.company_payment_terms ?? 'Paiement à 30 jours après réception de facture.'}</p>
          {q.company_insurance_provider && (
            <p>
              Assurance : {q.company_insurance_provider}
              {q.company_insurance_policy ? ` — police n° ${q.company_insurance_policy}` : ''}
            </p>
          )}
          <p>
            Vous disposez d’un droit de rétractation de 14 jours pour les contrats conclus à distance ou hors
            établissement (art. L221-18 du Code de la consommation).
          </p>
        </footer>
      </article>

      {open && <AnswerForms token={token} clientName={q.client_name} />}
    </main>
  );
}
