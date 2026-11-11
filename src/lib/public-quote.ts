import { createPublicClient } from '@/lib/supabase/public';
import { computeQuoteTotals, type LineInput, type VatRate } from '@/lib/money';

export interface PublicQuote {
  quote_id: string;
  reference: string;
  title: string | null;
  status: 'sent' | 'viewed' | 'accepted' | 'refused' | 'expired' | 'draft';
  valid_until: string;
  intro_text: string | null;
  outro_text: string | null;
  company_name: string;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_siret: string | null;
  company_vat_exemption: boolean;
  company_insurance_provider: string | null;
  company_insurance_policy: string | null;
  company_payment_terms: string | null;
  client_name: string;
  client_site_address: string | null;
}

export interface PublicQuoteData {
  quote: PublicQuote;
  lines: LineInput[];
  extra: { global_discount: number; deposit_amount: number; execution_delay: string | null; created_at: string; company_legal_form: string | null };
  totals: ReturnType<typeof computeQuoteTotals>;
}

/** Charge le devis public par jeton (via les fonctions sécurisées de la base). null si introuvable ou expiré. */
export async function loadPublicQuote(token: string): Promise<PublicQuoteData | null> {
  const db = createPublicClient();
  const { data: q } = await db.rpc('get_public_quote', { p_token: token });
  const quote = (q as PublicQuote[] | null)?.[0];
  if (!quote) return null;

  const [{ data: l }, { data: e }] = await Promise.all([
    db.rpc('get_public_quote_lines', { p_token: token }),
    db.rpc('get_public_quote_extra', { p_token: token }),
  ]);
  const extraRow = (e as PublicQuoteData['extra'][] | null)?.[0];
  if (!extraRow) return null;

  const lines: LineInput[] = ((l as Record<string, unknown>[] | null) ?? []).map((x) => ({
    label: String(x.label),
    unit: x.unit as LineInput['unit'],
    quantity: Number(x.quantity),
    unit_price_ht: Number(x.unit_price_ht),
    vat_rate: Number(x.vat_rate) as VatRate,
    discount: Number(x.discount),
  }));
  const extra = {
    ...extraRow,
    global_discount: Number(extraRow.global_discount),
    deposit_amount: Number(extraRow.deposit_amount),
  };
  return { quote, lines, extra, totals: computeQuoteTotals(lines, extra.global_discount, extra.deposit_amount) };
}
