'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const UNITS = ['u', 'h', 'm2', 'ml', 'forfait'];
const VAT = [0, 2.1, 5.5, 10, 20];

function parsePrice(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? '').trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function back(message: string): never {
  redirect('/catalogue?error=' + encodeURIComponent(message));
}


export async function createCatalogItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: company } = await supabase
    .from('companies')
    .select('id, default_vat_rate')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!company) return;

  const label = String(formData.get('label') ?? '').trim();
  if (!label) back('Indiquez une désignation.');
  const price = parsePrice(formData.get('unit_price_ht'));
  if (price === null) back('Prix invalide : saisissez un nombre (ex. 45 ou 45,50).');
  const unit = String(formData.get('unit') ?? 'u');
  if (!UNITS.includes(unit)) back('Unité invalide.');
  const vat = Number(formData.get('vat_rate') ?? company.default_vat_rate);
  if (!VAT.includes(vat)) back('Taux de TVA invalide.');

  const { error } = await supabase.from('catalog_items').insert({
    company_id: company.id,
    label,
    unit,
    unit_price_ht: price,
    vat_rate: vat,
    category: String(formData.get('category') ?? '').trim() || null,
    description: String(formData.get('description') ?? '').trim() || null,
  });
  if (error) {
    console.error('[createCatalogItem]', error.message);
    back('La prestation n\u2019a pas pu être ajoutée. Réessayez.');
  }

  revalidatePath('/catalogue');
  redirect('/catalogue');
}

export async function updateCatalogItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const label = String(formData.get('label') ?? '').trim();
  if (!label) back('Indiquez une désignation.');
  const price = parsePrice(formData.get('unit_price_ht'));
  if (price === null) back('Prix invalide : saisissez un nombre (ex. 45 ou 45,50).');
  const unit = String(formData.get('unit') ?? 'u');
  if (!UNITS.includes(unit)) back('Unité invalide.');
  const vat = Number(formData.get('vat_rate'));
  if (!VAT.includes(vat)) back('Taux de TVA invalide.');

  // RLS : la mise à jour n'aboutit que si l'item appartient à l'artisan
  const { error } = await supabase
    .from('catalog_items')
    .update({
      label,
      unit,
      unit_price_ht: price,
      vat_rate: vat,
      category: String(formData.get('category') ?? '').trim() || null,
    })
    .eq('id', id);
  if (error) {
    console.error('[updateCatalogItem]', error.message);
    back('La modification n\u2019a pas pu être enregistrée. Réessayez.');
  }

  revalidatePath('/catalogue');
  redirect('/catalogue?saved=1');
}

export async function deleteCatalogItem(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await supabase.from('catalog_items').delete().eq('id', id);
  revalidatePath('/catalogue');
}
