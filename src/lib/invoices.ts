/**
 * Types et règles métier des factures et avoirs.
 * Les montants sont en CENTIMES. Une facture est une copie figée : on y recalcule les totaux
 * à partir des lignes (mêmes règles que les devis, voir money.ts) uniquement pour l'affichage.
 */
import { computeQuoteTotals, type LineInput, type QuoteTotals, type Unit, type VatRate } from '@/lib/money';

export type InvoiceKind = 'invoice' | 'credit_note';
export type OperationCategory = 'services' | 'goods' | 'mixed';

export const OPERATION_LABELS: Record<OperationCategory, string> = {
  services: 'Prestation de services',
  goods: 'Livraison de biens',
  mixed: 'Livraison de biens et prestation de services',
};

/** Mentions de retard de paiement exigées entre professionnels (Code de commerce, art. L441-10). */
export const LATE_PENALTY_TEXT =
  'En cas de retard de paiement, des pénalités de retard sont exigibles au taux de trois fois le taux d’intérêt légal, ' +
  'ainsi qu’une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 et D441-5 du Code de commerce). ' +
  'Pas d’escompte pour paiement anticipé.';

export const VAT_FRANCHISE_TEXT = 'TVA non applicable, art. 293 B du CGI';

export interface InvoiceDoc {
  id: string;
  kind: InvoiceKind;
  reference: string;
  credits_reference: string | null;
  credits_issue_date: string | null;
  issue_date: string; // YYYY-MM-DD
  service_date: string;
  due_date: string;
  operation_category: OperationCategory;
  title: string | null;
  status: 'issued' | 'paid';
  seller: {
    name: string;
    legal_form: string | null;
    siret: string;
    vat_number: string | null;
    vat_exemption: boolean;
    vat_on_debits: boolean;
    address: string;
    email: string | null;
    phone: string | null;
    iban: string | null;
  };
  buyer: {
    name: string;
    is_company: boolean;
    siren: string | null;
    address: string;
    email: string | null;
    delivery_address: string | null;
  };
  payment_terms: string | null;
  late_penalty_text: string | null;
  global_discount: number; // euros
  deposit: number; // euros
  lines: LineInput[];
}

/** Totaux recalculés d'une facture (même moteur que les devis). */
export function invoiceTotals(doc: Pick<InvoiceDoc, 'lines' | 'global_discount' | 'deposit' | 'kind'>): QuoteTotals {
  return computeQuoteTotals(doc.lines, doc.global_discount, doc.kind === 'credit_note' ? 0 : doc.deposit);
}

/** Ligne de facture stockée en base → ligne de calcul. */
export function dbLineToInput(l: {
  label: string;
  unit: string;
  quantity: number | string;
  unit_price_ht: number | string;
  vat_rate: number | string;
  discount: number | string;
}): LineInput {
  return {
    label: l.label,
    unit: l.unit as Unit,
    quantity: Number(l.quantity),
    unit_price_ht: Number(l.unit_price_ht),
    vat_rate: Number(l.vat_rate) as VatRate,
    discount: Number(l.discount),
  };
}

/** Ligne de base de données (colonnes `invoices`) + lignes → document complet. */
export function rowToDoc(
  row: Record<string, unknown>,
  lines: LineInput[],
  creditedIssueDate: string | null = null
): InvoiceDoc {
  const s = (k: string) => (row[k] == null ? null : String(row[k]));
  const n = (k: string) => Number(row[k] ?? 0);
  return {
    id: String(row.id),
    kind: row.kind === 'credit_note' ? 'credit_note' : 'invoice',
    reference: String(row.reference),
    credits_reference: s('credits_reference'),
    credits_issue_date: creditedIssueDate,
    issue_date: String(row.issue_date),
    service_date: String(row.service_date),
    due_date: String(row.due_date),
    operation_category: (s('operation_category') as OperationCategory) ?? 'services',
    title: s('title'),
    status: row.status === 'paid' ? 'paid' : 'issued',
    seller: {
      name: String(row.seller_name),
      legal_form: s('seller_legal_form'),
      siret: String(row.seller_siret),
      vat_number: s('seller_vat_number'),
      vat_exemption: Boolean(row.seller_vat_exemption),
      vat_on_debits: Boolean(row.seller_vat_on_debits),
      address: String(row.seller_address),
      email: s('seller_email'),
      phone: s('seller_phone'),
      iban: s('seller_iban'),
    },
    buyer: {
      name: String(row.buyer_name),
      is_company: Boolean(row.buyer_is_company),
      siren: s('buyer_siren'),
      address: String(row.buyer_address),
      email: s('buyer_email'),
      delivery_address: s('delivery_address'),
    },
    payment_terms: s('payment_terms'),
    late_penalty_text: s('late_penalty_text'),
    global_discount: n('global_discount_cents') / 100,
    deposit: n('deposit_cents') / 100,
    lines,
  };
}

/** Date AAAA-MM-JJ du jour (fuseau de Paris), pour la date d'émission. */
export function todayParis(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // en-CA → 2026-11-11
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** SIREN = 9 chiffres (contrôle de Luhn). */
export function isValidSiren(value: string): boolean {
  const v = value.replace(/\s/g, '');
  if (!/^\d{9}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(v[8 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
