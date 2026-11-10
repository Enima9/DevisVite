import { createClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/quotes-server';
import QuoteEditor from '../editor';

export default async function NouveauDevisPage() {
  const { companyId, company } = await requireCompany();
  const supabase = await createClient();

  const [{ data: catalogue }, { data: clients }] = await Promise.all([
    supabase.from('catalog_items').select('*').eq('company_id', companyId).order('category, label'),
    supabase.from('clients').select('*').eq('company_id', companyId).order('name'),
  ]);

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <h1 className="text-2xl font-bold">Nouveau devis</h1>
      <p className="mt-1 mb-6 text-slate-600">Rien ne part sans votre validation : vous vérifiez tout avant l'envoi.</p>
      <QuoteEditor
        catalogue={(catalogue ?? []) as never}
        clients={(clients ?? []) as never}
        defaultVatRate={Number(company.default_vat_rate)}
        validityDays={company.quote_validity_days}
      />
    </main>
  );
}
