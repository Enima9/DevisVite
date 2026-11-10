'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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
  if (!label) return;

  await supabase.from('catalog_items').insert({
    company_id: company.id,
    label,
    unit: String(formData.get('unit') ?? 'u'),
    unit_price_ht: Number(String(formData.get('unit_price_ht') ?? '0').replace(',', '.')),
    vat_rate: Number(formData.get('vat_rate') ?? company.default_vat_rate),
    category: String(formData.get('category') ?? '').trim() || null,
    description: String(formData.get('description') ?? '').trim() || null,
  });

  revalidatePath('/catalogue');
}

export async function updateCatalogItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  if (!id) return;

  // RLS : la mise à jour n'aboutit que si l'item appartient à l'artisan
  await supabase
    .from('catalog_items')
    .update({
      label: String(formData.get('label') ?? '').trim(),
      unit: String(formData.get('unit') ?? 'u'),
      unit_price_ht: Number(String(formData.get('unit_price_ht') ?? '0').replace(',', '.')),
      vat_rate: Number(formData.get('vat_rate')),
      category: String(formData.get('category') ?? '').trim() || null,
    })
    .eq('id', id);

  revalidatePath('/catalogue');
}

export async function deleteCatalogItem(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await supabase.from('catalog_items').delete().eq('id', id);
  revalidatePath('/catalogue');
}
