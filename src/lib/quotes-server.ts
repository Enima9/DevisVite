import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export interface CompanyProfile {
  id: string;
  name: string;
  legal_form: string | null;
  siret: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  primary_color: string;
  iban: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  default_vat_rate: number;
  vat_exemption: boolean;
  payment_terms: string | null;
  quote_validity_days: number;
  trade: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  site_address: string | null;
}

export interface CatalogRow {
  id: string;
  label: string;
  description: string | null;
  unit: 'u' | 'h' | 'm2' | 'ml' | 'forfait';
  unit_price_ht: number;
  vat_rate: number;
  category: string | null;
}

export interface QuoteRow {
  id: string;
  reference: string;
  status: string;
  title: string | null;
  global_discount: number;
  deposit_amount: number;
  execution_delay: string | null;
  valid_until: string;
  created_at: string;
  client: ClientRow;
}

export interface QuoteLineRow {
  id: string;
  label: string;
  unit: 'u' | 'h' | 'm2' | 'ml' | 'forfait';
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
  discount: number;
  position: number;
}

/** Récupère l'entreprise de l'utilisateur connecté (ou redirige). */
export async function requireCompany(): Promise<{
  companyId: string;
  company: CompanyProfile;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!company) redirect('/onboarding');

  return { companyId: company.id, company: company as CompanyProfile };
}

/** Numéro de référence suivant : DEV-<année>-0001, 0002… */
export async function nextQuoteReference(companyId: string): Promise<string> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);
  return `DEV-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
}
