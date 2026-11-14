'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCompany } from '@/lib/quotes-server';
import { isValidSiren, LATE_PENALTY_TEXT, todayParis } from '@/lib/invoices';

const PAYMENT_METHODS = ['virement', 'cheque', 'especes', 'carte', 'autre'];
/** Même borne que la base (create_invoice_document, migration 0008). */
const MAX_ADDRESS_LENGTH = 500;
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
  const buyerSiren = text('buyer_siren').replace(/\s/g, '').slice(0, 20);
  const buyerAddress = text('buyer_address');
  if (!buyerAddress) back('Indiquez l’adresse de facturation du client.');
  if (buyerAddress.length > MAX_ADDRESS_LENGTH) back(`L’adresse de facturation est trop longue (${MAX_ADDRESS_LENGTH} caractères maximum).`);
  if (buyerIsCompany && !isValidSiren(buyerSiren)) back('Le SIREN du client doit contenir 9 chiffres valides.');

  const client = Array.isArray(quote.client) ? quote.client[0] : quote.client;
  if (!client) back('Client introuvable.');

  const { count: lineCount } = await supabase
    .from('quote_lines')
    .select('id', { count: 'exact', head: true })
    .eq('quote_id', quoteId);
  if (!lineCount) back('Ce devis ne contient aucune ligne.');

  // La base relit le devis, le client, l'entreprise et les lignes, impose la date d'émission
  // et recalcule les totaux (create_invoice_document, migration 0008) : on n'envoie que la saisie.
  const payload = {
    kind: 'invoice',
    company_id: companyId,
    quote_id: quoteId,
    service_date: serviceDate,
    due_days: dueDays,
    buyer_is_company: buyerIsCompany,
    buyer_siren: buyerIsCompany ? buyerSiren : null,
    buyer_address: buyerAddress,
    late_penalty_text: LATE_PENALTY_TEXT,
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

  // La base recopie la facture d'origine (vendeur, acheteur, lignes) et recalcule les totaux.
  const payload = {
    kind: 'credit_note',
    company_id: companyId,
    credits_invoice_id: inv.id,
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
