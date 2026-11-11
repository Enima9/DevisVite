'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/quotes-server';
import { computeQuoteTotals, type LineInput, type VatRate } from '@/lib/money';
import { addDays, dbLineToInput, isValidSiren, LATE_PENALTY_TEXT, todayParis } from '@/lib/invoices';

const PAYMENT_METHODS = ['virement', 'cheque', 'especes', 'carte', 'autre'];
const isoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Transforme un devis accepté en facture (numérotation continue faite par la base). */
export async function createInvoice(formData: FormData) {
  const quoteId = String(formData.get('quote_id') ?? '');
  const { companyId, company } = await requireCompany();
  const supabase = await createClient();
  const back = (msg: string): never => redirect(`/devis/${quoteId}/facturer?error=${encodeURIComponent(msg)}`);

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, client:clients(*)')
    .eq('id', quoteId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!quote) redirect('/devis');
  if (quote.status !== 'accepted') back('Seul un devis accepté peut être facturé.');

  // Une facture par devis : si elle existe déjà, on y renvoie.
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('quote_id', quoteId)
    .eq('kind', 'invoice')
    .maybeSingle();
  if (existing) redirect(`/factures/${existing.id}`);

  // --- Contrôles du vendeur (mentions obligatoires)
  const siret = String(company.siret ?? '').replace(/\s/g, '');
  if (!/^\d{14}$/.test(siret)) back('Renseignez votre SIRET (14 chiffres) dans Mon compte avant de facturer.');
  if (!String(company.address ?? '').trim()) back('Renseignez l’adresse de votre entreprise dans Mon compte avant de facturer.');
  const vatNumber = String(company.vat_number ?? '').replace(/\s/g, '');
  if (!company.vat_exemption && !vatNumber) {
    back('Renseignez votre numéro de TVA intracommunautaire dans Mon compte (ou cochez « TVA non applicable »).');
  }

  // --- Saisie
  const text = (k: string) => String(formData.get(k) ?? '').trim();
  const today = todayParis();
  const serviceDate = text('service_date') || today;
  if (!isoDate(serviceDate)) back('La date de la prestation est invalide.');
  const dueDays = Math.min(Math.max(Number.parseInt(text('due_days') || '30', 10) || 0, 0), 60);
  const buyerIsCompany = formData.get('buyer_is_company') === 'on';
  const buyerSiren = text('buyer_siren').replace(/\s/g, '');
  const buyerAddress = text('buyer_address');
  if (!buyerAddress) back('Indiquez l’adresse de facturation du client.');
  if (buyerIsCompany && !isValidSiren(buyerSiren)) back('Le SIREN du client doit contenir 9 chiffres valides.');

  const client = (Array.isArray(quote.client) ? quote.client[0] : quote.client) as {
    id: string; name: string; email: string | null; site_address: string | null;
  } | null;
  if (!client) back('Client introuvable.');

  const { data: dbLines } = await supabase.from('quote_lines').select('*').eq('quote_id', quoteId).order('position');
  if (!dbLines || dbLines.length === 0) back('Ce devis ne contient aucune ligne.');

  // Franchise en base : aucune TVA sur la facture (taux forcé à 0).
  const lines: LineInput[] = (dbLines ?? []).map((l) => {
    const input = dbLineToInput(l);
    return company.vat_exemption ? { ...input, vat_rate: 0 as VatRate } : input;
  });
  const totals = computeQuoteTotals(lines, Number(quote.global_discount ?? 0), Number(quote.deposit_amount ?? 0));
  const deliveryAddress =
    client!.site_address && client!.site_address.trim() !== buyerAddress ? client!.site_address.trim() : null;

  const payload = {
    kind: 'invoice',
    company_id: companyId,
    quote_id: quoteId,
    client_id: client!.id,
    issue_date: today,
    service_date: serviceDate,
    due_date: addDays(today, dueDays),
    operation_category: 'services',
    title: quote.title,
    seller_name: company.name,
    seller_legal_form: company.legal_form,
    seller_siret: siret,
    seller_vat_number: company.vat_exemption ? null : vatNumber,
    seller_vat_exemption: company.vat_exemption,
    seller_vat_on_debits: Boolean(company.vat_on_debits),
    seller_address: String(company.address),
    seller_email: company.email,
    seller_phone: company.phone,
    seller_iban: company.iban,
    buyer_name: client!.name,
    buyer_is_company: buyerIsCompany,
    buyer_siren: buyerIsCompany ? buyerSiren : null,
    buyer_address: buyerAddress,
    buyer_email: client!.email,
    delivery_address: deliveryAddress,
    payment_terms: company.payment_terms,
    late_penalty_text: LATE_PENALTY_TEXT,
    global_discount_cents: totals.global_discount_cents,
    deposit_cents: totals.deposit_cents,
    total_ht_cents: totals.total_ht_cents,
    total_vat_cents: totals.total_vat_cents,
    total_ttc_cents: totals.total_ttc_cents,
    amount_due_cents: totals.net_ttc_cents,
    lines: lines.map((l) => ({
      label: l.label,
      unit: l.unit,
      quantity: l.quantity,
      unit_price_ht: l.unit_price_ht,
      vat_rate: l.vat_rate,
      discount: l.discount,
    })),
  };

  const { data: newId, error } = await supabase.rpc('create_invoice_document', { p: payload });
  if (error || !newId) {
    console.error('[createInvoice]', error?.message);
    if (error?.code === '23505') {
      const { data: again } = await supabase.from('invoices').select('id').eq('quote_id', quoteId).eq('kind', 'invoice').maybeSingle();
      if (again) redirect(`/factures/${again.id}`);
    }
    back('La facture n’a pas pu être créée. Réessayez dans un instant.');
  }

  revalidatePath('/factures');
  revalidatePath(`/devis/${quoteId}`);
  redirect(`/factures/${newId}?cree=1`);
}

/** Émet un avoir qui annule intégralement une facture (la facture elle-même n'est jamais modifiée). */
export async function createCreditNote(formData: FormData) {
  const invoiceId = String(formData.get('invoice_id') ?? '');
  const { companyId } = await requireCompany();
  const supabase = await createClient();
  const back = (msg: string): never => redirect(`/factures/${invoiceId}?error=${encodeURIComponent(msg)}`);

  const { data: inv } = await supabase.from('invoices').select('*').eq('id', invoiceId).eq('company_id', companyId).maybeSingle();
  if (!inv) redirect('/factures');
  if (inv.kind !== 'invoice') back('Un avoir ne peut pas être annulé.');
  const { data: already } = await supabase.from('invoices').select('id').eq('credits_invoice_id', invoiceId).maybeSingle();
  if (already) redirect(`/factures/${already.id}`);

  const { data: dbLines } = await supabase.from('invoice_lines').select('*').eq('invoice_id', invoiceId).order('position');
  const lines = (dbLines ?? []).map(dbLineToInput);
  const totals = computeQuoteTotals(lines, Number(inv.global_discount_cents) / 100, 0);
  const today = todayParis();

  const payload = {
    kind: 'credit_note',
    company_id: companyId,
    quote_id: null,
    client_id: inv.client_id,
    credits_invoice_id: inv.id,
    credits_reference: inv.reference,
    issue_date: today,
    service_date: inv.service_date,
    due_date: today,
    operation_category: inv.operation_category,
    title: inv.title,
    seller_name: inv.seller_name,
    seller_legal_form: inv.seller_legal_form,
    seller_siret: inv.seller_siret,
    seller_vat_number: inv.seller_vat_number,
    seller_vat_exemption: inv.seller_vat_exemption,
    seller_vat_on_debits: inv.seller_vat_on_debits,
    seller_address: inv.seller_address,
    seller_email: inv.seller_email,
    seller_phone: inv.seller_phone,
    seller_iban: inv.seller_iban,
    buyer_name: inv.buyer_name,
    buyer_is_company: inv.buyer_is_company,
    buyer_siren: inv.buyer_siren,
    buyer_address: inv.buyer_address,
    buyer_email: inv.buyer_email,
    delivery_address: inv.delivery_address,
    payment_terms: null,
    late_penalty_text: null,
    global_discount_cents: totals.global_discount_cents,
    deposit_cents: 0,
    total_ht_cents: totals.total_ht_cents,
    total_vat_cents: totals.total_vat_cents,
    total_ttc_cents: totals.total_ttc_cents,
    amount_due_cents: totals.total_ttc_cents,
    lines: lines.map((l) => ({
      label: l.label,
      unit: l.unit,
      quantity: l.quantity,
      unit_price_ht: l.unit_price_ht,
      vat_rate: l.vat_rate,
      discount: l.discount,
    })),
  };

  const { data: newId, error } = await supabase.rpc('create_invoice_document', { p: payload });
  if (error || !newId) {
    console.error('[createCreditNote]', error?.message);
    back('L’avoir n’a pas pu être créé. Réessayez dans un instant.');
  }
  revalidatePath('/factures');
  redirect(`/factures/${newId}?cree=1`);
}

/** Enregistre le paiement d'une facture (seul changement autorisé sur une facture émise). */
export async function markInvoicePaid(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const method = String(formData.get('payment_method') ?? '');
  const { companyId } = await requireCompany();
  const supabase = await createClient();
  if (!PAYMENT_METHODS.includes(method)) redirect(`/factures/${id}?error=${encodeURIComponent('Choisissez un moyen de paiement.')}`);

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: method })
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('kind', 'invoice')
    .eq('status', 'issued');
  if (error) {
    console.error('[markInvoicePaid]', error.message);
    redirect(`/factures/${id}?error=${encodeURIComponent('Le paiement n’a pas pu être enregistré.')}`);
  }
  revalidatePath(`/factures/${id}`);
  revalidatePath('/factures');
  redirect(`/factures/${id}`);
}
