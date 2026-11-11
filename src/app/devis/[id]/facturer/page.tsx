import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/quotes-server';
import { createInvoice } from '@/app/actions/invoices';
import { todayParis } from '@/lib/invoices';

export const metadata = { title: 'Créer la facture', robots: { index: false, follow: false } };

export default async function FacturerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { companyId, company } = await requireCompany();
  const supabase = await createClient();

  const { data: quote } = await supabase.from('quotes').select('*, client:clients(*)').eq('id', id).maybeSingle();
  if (!quote || quote.company_id !== companyId) notFound();

  const { data: existing } = await supabase.from('invoices').select('id').eq('quote_id', id).eq('kind', 'invoice').maybeSingle();
  if (existing) redirect(`/factures/${existing.id}`);

  const client = (Array.isArray(quote.client) ? quote.client[0] : quote.client) as {
    name: string;
    site_address: string | null;
  } | null;
  const missing: string[] = [];
  if (!/^\d{14}$/.test(String(company.siret ?? '').replace(/\s/g, ''))) missing.push('votre SIRET');
  if (!String(company.address ?? '').trim()) missing.push('l’adresse de votre entreprise');
  if (!company.vat_exemption && !String(company.vat_number ?? '').trim()) missing.push('votre numéro de TVA intracommunautaire');

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <Link href={`/devis/${id}`} className="text-sm text-brand">← {quote.reference}</Link>
      <h1 className="mt-2 text-2xl font-bold">Créer la facture</h1>
      <p className="mt-1 mb-5 text-slate-600">
        Devis {quote.reference} — {client?.name}. Une fois émise, la facture ne peut plus être modifiée : en cas
        d’erreur, on émet un avoir.
      </p>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-red-800">{error}</p>
      )}

      {quote.status !== 'accepted' ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4">Seul un devis accepté peut être facturé.</p>
      ) : missing.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold">Il manque des informations obligatoires sur votre entreprise :</p>
          <p className="mt-1">{missing.join(', ')}.</p>
          <Link href="/reglages" className="btn-primary mt-3">Compléter Mon compte</Link>
        </div>
      ) : (
        <form action={createInvoice} className="card space-y-4">
          <input type="hidden" name="quote_id" value={id} />
          <div>
            <label htmlFor="service_date" className="label">Date de la prestation</label>
            <input id="service_date" name="service_date" type="date" className="input" defaultValue={todayParis()} required />
          </div>
          <div>
            <label htmlFor="due_days" className="label">Paiement sous (jours)</label>
            <input id="due_days" name="due_days" type="number" min={0} max={60} className="input" defaultValue={30} required />
          </div>
          <div>
            <label htmlFor="buyer_address" className="label">Adresse de facturation du client *</label>
            <textarea
              id="buyer_address"
              name="buyer_address"
              required
              className="input min-h-[80px]"
              placeholder="12 rue des Lilas, 69003 Lyon"
              defaultValue={client?.site_address ?? ''}
            />
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="buyer_is_company" className="mt-1 h-5 w-5" />
            <span>Le client est une entreprise (le SIREN devient obligatoire sur la facture).</span>
          </label>
          <div>
            <label htmlFor="buyer_siren" className="label">SIREN du client (9 chiffres, si entreprise)</label>
            <input id="buyer_siren" name="buyer_siren" className="input" inputMode="numeric" placeholder="123 456 789" />
          </div>
          <button className="btn-primary">Émettre la facture</button>
          <p className="text-center text-sm text-slate-600">
            Numéro attribué automatiquement, sans trou, à l’émission.
          </p>
        </form>
      )}
    </main>
  );
}
