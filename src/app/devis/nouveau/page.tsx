import { createClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/quotes-server';
import QuoteEditor from '../editor';

export const metadata = { title: 'Nouveau devis', robots: { index: false, follow: false } };

export default async function NouveauDevisPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { companyId, company } = await requireCompany();
  const supabase = await createClient();

  const [{ data: catalogue }, { data: clients }] = await Promise.all([
    supabase.from('catalog_items').select('*').eq('company_id', companyId).order('category, label'),
    supabase.from('clients').select('*').eq('company_id', companyId).order('name'),
  ]);

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <h1 className="text-2xl font-bold">Nouveau devis</h1>
      <p className="mt-1 mb-6 text-slate-600">Rien ne part sans votre validation : vous vérifiez tout avant l'envoi.</p>
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <QuoteEditor
        catalogue={(catalogue ?? []) as never}
        clients={(clients ?? []) as never}
        defaultVatRate={Number(company.default_vat_rate)}
        validityDays={company.quote_validity_days}
      />
    </main>
  );
}
