import { createClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/quotes-server';
import { createCatalogItem, updateCatalogItem, deleteCatalogItem, seedCatalogFromTrade } from '@/app/actions/catalog';
import { VAT_RATES, UNIT_LABELS, type Unit } from '@/lib/money';

export const metadata = { title: 'Mon catalogue', robots: { index: false, follow: false } };

const UNITS = Object.entries(UNIT_LABELS) as [Unit, string][];

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const { companyId } = await requireCompany();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('company_id', companyId)
    .order('category, label');

  const vatOptions = VAT_RATES.map((r) => (
    <option key={r} value={r}>{r.toLocaleString('fr-FR')} %</option>
  ));

  return (
    <main id="contenu" className="mx-auto max-w-md px-5 py-8">
      <h1 className="text-2xl font-bold">Mon catalogue</h1>
      <p className="mt-1 mb-6 text-slate-600">
        Vos prestations et tarifs. Ils pré-remplissent vos devis : gardez-les à jour.
      </p>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {saved && (
        <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">Modification enregistrée ✓</p>
      )}

      {(items ?? []).length === 0 && (
        <section className="card mb-6 text-center">
          <p className="font-bold">Votre catalogue est vide</p>
          <p className="mt-1 mb-3 text-sm text-slate-600">
            Chargez les prestations types de votre métier, vous pourrez ensuite modifier les prix.
          </p>
          <form action={seedCatalogFromTrade}>
            <button type="submit" className="btn-primary">Charger les prestations de mon métier</button>
          </form>
        </section>
      )}

      {/* Ajout d'une prestation */}
      <section className="card mb-6">
        <h2 className="mb-3 font-bold">➕ Ajouter une prestation</h2>
        <form action={createCatalogItem} className="space-y-3">
          <input name="label" aria-label="Désignation" required className="input" placeholder="Désignation (ex. Remplacement robinet)" />
          <div className="grid grid-cols-2 gap-3">
            <select name="unit" aria-label="Unité" className="input" defaultValue="u">
              {UNITS.map(([value, label]) => (
                <option key={value} value={value}>par {label}</option>
              ))}
            </select>
            <input name="unit_price_ht" aria-label="Prix HT en euros" required inputMode="decimal" className="input" placeholder="Prix HT (€)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select name="vat_rate" aria-label="Taux de TVA" className="input" defaultValue="20">
              {vatOptions}
            </select>
            <input name="category" aria-label="Catégorie" className="input" placeholder="Catégorie (optionnel)" />
          </div>
          <button type="submit" className="btn-primary">Ajouter au catalogue</button>
        </form>
      </section>

      {/* Liste éditable */}
      <ul className="space-y-4 pb-8">
        {(items ?? []).map((item) => (
          <li key={item.id} className="card">
            <form action={updateCatalogItem} className="space-y-3">
              <input type="hidden" name="id" value={item.id} />
              <input name="label" aria-label="Désignation" defaultValue={item.label} className="input" />
              <div className="grid grid-cols-2 gap-3">
                <select name="unit" aria-label="Unité" className="input" defaultValue={item.unit}>
                  {UNITS.map(([value, label]) => (
                    <option key={value} value={value}>par {label}</option>
                  ))}
                </select>
                <input
                  name="unit_price_ht"
                  defaultValue={Number(item.unit_price_ht)}
                  inputMode="decimal"
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select name="vat_rate" aria-label="Taux de TVA" className="input" defaultValue={Number(item.vat_rate)}>
                  {vatOptions}
                </select>
                <input name="category" aria-label="Catégorie" defaultValue={item.category ?? ''} className="input" placeholder="Catégorie" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary !min-h-[46px] !text-base">Enregistrer</button>
              </div>
            </form>
            <form action={deleteCatalogItem} className="mt-2">
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="w-full rounded-xl py-2 text-sm font-semibold text-red-600">
                Supprimer
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
