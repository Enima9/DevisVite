/**
 * XML Factur-X / CII (UN/CEFACT CrossIndustryInvoice D16B), profil EN 16931.
 * Fonction pure : un InvoiceDoc en entrée, une chaîne XML en sortie.
 *
 * Conventions retenues :
 *  - montants à 2 décimales (point décimal) ; un seul taux de TVA par ligne ;
 *  - remise de ligne = « allowance » de ligne ; remise globale = « allowance » de document, ventilée par taux ;
 *  - franchise en base de TVA : catégorie E, taux 0, motif « art. 293 B du CGI » (VATEX-FR-FRANCHISE) ;
 *  - avoir : type 381, montants positifs, référence à la facture d'origine.
 */
import { invoiceTotals, VAT_FRANCHISE_TEXT, type InvoiceDoc } from '@/lib/invoices';
import type { Unit } from '@/lib/money';

export const FACTURX_PROFILE_URN = 'urn:cen.eu:en16931:2017';

/** Codes d'unité UN/ECE Recommandation 20. */
const UNIT_CODES: Record<Unit, string> = { u: 'C62', h: 'HUR', m2: 'MTK', ml: 'MTR', forfait: 'C62' };

export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

const amt = (cents: number) => (cents / 100).toFixed(2);
const pct = (rate: number) => rate.toFixed(2);
const date102 = (iso: string) => iso.replace(/-/g, '');
/** Quantité / prix : jusqu'à 4 décimales, sans zéros inutiles (mais au moins 2). */
const num = (n: number) => {
  const s = n.toFixed(4).replace(/0+$/, '');
  const [i, d = ''] = s.split('.');
  return `${i}.${d.padEnd(2, '0')}`;
};

interface ParsedAddress {
  line: string;
  postcode: string | null;
  city: string | null;
}

/** Sépare « 12 rue des Lilas, 69003 Lyon » en rue / code postal / ville (si on trouve un code postal). */
export function parseAddress(address: string): ParsedAddress {
  const flat = address.replace(/\s*[\r\n]+\s*/g, ', ').trim();
  const m = flat.match(/^(.*?)[,\s]+(\d{5})\s+([^,]+?)\s*$/);
  if (m && m[1]) return { line: m[1].replace(/[,\s]+$/, ''), postcode: m[2], city: m[3] };
  return { line: flat, postcode: null, city: null };
}

function addressXml(address: string): string {
  const a = parseAddress(address);
  return (
    `<ram:PostalTradeAddress>` +
    (a.postcode ? `<ram:PostcodeCode>${xmlEscape(a.postcode)}</ram:PostcodeCode>` : '') +
    `<ram:LineOne>${xmlEscape(a.line)}</ram:LineOne>` +
    (a.city ? `<ram:CityName>${xmlEscape(a.city)}</ram:CityName>` : '') +
    `<ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>`
  );
}

const sirenOf = (v: string) => v.replace(/\s/g, '').slice(0, 9);

export function buildFacturXml(doc: InvoiceDoc): string {
  const totals = invoiceTotals(doc);
  const exempt = doc.seller.vat_exemption;
  const isCredit = doc.kind === 'credit_note';
  const catOf = (rate: number) => (exempt ? 'E' : rate === 0 ? 'Z' : 'S');
  const rateOf = (rate: number) => (exempt ? 0 : rate);

  // --- Lignes
  const linesXml = doc.lines
    .map((l, i) => {
      const t = totals.lines[i];
      const cat = catOf(l.vat_rate);
      return (
        `<ram:IncludedSupplyChainTradeLineItem>` +
        `<ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>` +
        `<ram:SpecifiedTradeProduct><ram:Name>${xmlEscape(l.label)}</ram:Name></ram:SpecifiedTradeProduct>` +
        `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${num(l.unit_price_ht)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>` +
        `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${UNIT_CODES[l.unit] ?? 'C62'}">${num(l.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>` +
        `<ram:SpecifiedLineTradeSettlement>` +
        `<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat}</ram:CategoryCode><ram:RateApplicablePercent>${pct(rateOf(l.vat_rate))}</ram:RateApplicablePercent></ram:ApplicableTradeTax>` +
        (t.discount_cents > 0
          ? `<ram:SpecifiedTradeAllowanceCharge><ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>` +
            `<ram:ActualAmount>${amt(t.discount_cents)}</ram:ActualAmount><ram:Reason>Remise</ram:Reason></ram:SpecifiedTradeAllowanceCharge>`
          : '') +
        `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amt(t.line_ht_cents)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>` +
        `</ram:SpecifiedLineTradeSettlement>` +
        `</ram:IncludedSupplyChainTradeLineItem>`
      );
    })
    .join('');

  // --- Remise globale ventilée par taux : brut (somme des lignes) - base nette du taux
  const grossByRate = new Map<number, number>();
  totals.lines.forEach((t, i) => {
    const r = doc.lines[i].vat_rate;
    grossByRate.set(r, (grossByRate.get(r) ?? 0) + t.line_ht_cents);
  });
  const allowancesXml = totals.vat_buckets
    .map((b) => ({ b, amount: (grossByRate.get(b.rate) ?? 0) - b.base_cents }))
    .filter((x) => x.amount > 0)
    .map(
      ({ b, amount }) =>
        `<ram:SpecifiedTradeAllowanceCharge><ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>` +
        `<ram:ActualAmount>${amt(amount)}</ram:ActualAmount><ram:Reason>Remise globale</ram:Reason>` +
        `<ram:CategoryTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${catOf(b.rate)}</ram:CategoryCode><ram:RateApplicablePercent>${pct(rateOf(b.rate))}</ram:RateApplicablePercent></ram:CategoryTradeTax>` +
        `</ram:SpecifiedTradeAllowanceCharge>`
    )
    .join('');

  // --- Ventilation de la TVA (en franchise : une seule ligne, taux 0)
  const buckets = exempt
    ? [{ rate: 0, base_cents: totals.total_ht_cents, vat_cents: 0 }]
    : totals.vat_buckets;
  const taxXml = buckets
    .map((b) => {
      const cat = catOf(b.rate);
      return (
        `<ram:ApplicableTradeTax><ram:CalculatedAmount>${amt(exempt ? 0 : b.vat_cents)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode>` +
        (exempt ? `<ram:ExemptionReason>${xmlEscape(VAT_FRANCHISE_TEXT)}</ram:ExemptionReason>` : '') +
        `<ram:BasisAmount>${amt(b.base_cents)}</ram:BasisAmount><ram:CategoryCode>${cat}</ram:CategoryCode>` +
        (exempt ? `<ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>` : '') +
        `<ram:RateApplicablePercent>${pct(rateOf(b.rate))}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`
      );
    })
    .join('');

  const totalVat = exempt ? 0 : totals.total_vat_cents;
  const totalTtc = totals.total_ht_cents + totalVat;
  const prepaid = isCredit ? 0 : totals.deposit_cents;
  const lineTotal = totals.lines.reduce((s, t) => s + t.line_ht_cents, 0);

  // --- Notes (mentions françaises : PMD pénalités, PMT indemnité, AAB escompte)
  const notes: { code: string; text: string }[] = [
    { code: 'PMD', text: 'Pénalités de retard : trois fois le taux d’intérêt légal.' },
    { code: 'PMT', text: 'Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.' },
    { code: 'AAB', text: 'Pas d’escompte pour paiement anticipé.' },
  ];
  if (exempt) notes.push({ code: 'AAI', text: VAT_FRANCHISE_TEXT });
  if (doc.seller.vat_on_debits) notes.push({ code: 'AAI', text: 'Option pour le paiement de la TVA d’après les débits.' });
  const notesXml = notes
    .map((n) => `<ram:IncludedNote><ram:Content>${xmlEscape(n.text)}</ram:Content><ram:SubjectCode>${n.code}</ram:SubjectCode></ram:IncludedNote>`)
    .join('');

  const sellerSiren = sirenOf(doc.seller.siret);
  const sellerTax = doc.seller.vat_number
    ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xmlEscape(doc.seller.vat_number.replace(/\s/g, ''))}</ram:ID></ram:SpecifiedTaxRegistration>`
    : `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${xmlEscape(sellerSiren)}</ram:ID></ram:SpecifiedTaxRegistration>`;

  const sellerXml =
    `<ram:SellerTradeParty><ram:Name>${xmlEscape(doc.seller.name)}</ram:Name>` +
    `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${xmlEscape(sellerSiren)}</ram:ID></ram:SpecifiedLegalOrganization>` +
    addressXml(doc.seller.address) +
    (doc.seller.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${xmlEscape(doc.seller.email)}</ram:URIID></ram:URIUniversalCommunication>` : '') +
    sellerTax +
    `</ram:SellerTradeParty>`;

  const buyerXml =
    `<ram:BuyerTradeParty><ram:Name>${xmlEscape(doc.buyer.name)}</ram:Name>` +
    (doc.buyer.siren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${xmlEscape(sirenOf(doc.buyer.siren))}</ram:ID></ram:SpecifiedLegalOrganization>` : '') +
    addressXml(doc.buyer.address) +
    (doc.buyer.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${xmlEscape(doc.buyer.email)}</ram:URIID></ram:URIUniversalCommunication>` : '') +
    `</ram:BuyerTradeParty>`;

  const iban = doc.seller.iban ? doc.seller.iban.replace(/\s/g, '') : null;
  const paymentMeans =
    `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>${iban ? '58' : '1'}</ram:TypeCode>` +
    (iban ? `<ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${xmlEscape(iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>` : '') +
    `</ram:SpecifiedTradeSettlementPaymentMeans>`;

  const referenced =
    isCredit && doc.credits_reference
      ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${xmlEscape(doc.credits_reference)}</ram:IssuerAssignedID>` +
        (doc.credits_issue_date ? `<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${date102(doc.credits_issue_date)}</qdt:DateTimeString></ram:FormattedIssueDateTime>` : '') +
        `</ram:InvoiceReferencedDocument>`
      : '';

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" ` +
    `xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" ` +
    `xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" ` +
    `xmlns:xs="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">` +
    `<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${FACTURX_PROFILE_URN}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>` +
    `<rsm:ExchangedDocument><ram:ID>${xmlEscape(doc.reference)}</ram:ID><ram:TypeCode>${isCredit ? '381' : '380'}</ram:TypeCode>` +
    `<ram:IssueDateTime><udt:DateTimeString format="102">${date102(doc.issue_date)}</udt:DateTimeString></ram:IssueDateTime>${notesXml}</rsm:ExchangedDocument>` +
    `<rsm:SupplyChainTradeTransaction>${linesXml}` +
    `<ram:ApplicableHeaderTradeAgreement>${sellerXml}${buyerXml}</ram:ApplicableHeaderTradeAgreement>` +
    `<ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${date102(doc.service_date)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery>` +
    `<ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${paymentMeans}${taxXml}${allowancesXml}` +
    `<ram:SpecifiedTradePaymentTerms>${doc.payment_terms ? `<ram:Description>${xmlEscape(doc.payment_terms)}</ram:Description>` : ''}` +
    `<ram:DueDateDateTime><udt:DateTimeString format="102">${date102(doc.due_date)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>` +
    `<ram:SpecifiedTradeSettlementHeaderMonetarySummation>` +
    `<ram:LineTotalAmount>${amt(lineTotal)}</ram:LineTotalAmount>` +
    (totals.global_discount_cents > 0 ? `<ram:AllowanceTotalAmount>${amt(totals.global_discount_cents)}</ram:AllowanceTotalAmount>` : '') +
    `<ram:TaxBasisTotalAmount>${amt(totals.total_ht_cents)}</ram:TaxBasisTotalAmount>` +
    `<ram:TaxTotalAmount currencyID="EUR">${amt(totalVat)}</ram:TaxTotalAmount>` +
    `<ram:GrandTotalAmount>${amt(totalTtc)}</ram:GrandTotalAmount>` +
    (prepaid > 0 ? `<ram:TotalPrepaidAmount>${amt(prepaid)}</ram:TotalPrepaidAmount>` : '') +
    `<ram:DuePayableAmount>${amt(totalTtc - prepaid)}</ram:DuePayableAmount>` +
    `</ram:SpecifiedTradeSettlementHeaderMonetarySummation>${referenced}</ram:ApplicableHeaderTradeSettlement>` +
    `</rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>`
  );
}
