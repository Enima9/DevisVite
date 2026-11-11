import { describe, it, expect } from 'vitest';
import { buildFacturXml, parseAddress, xmlEscape } from '../src/lib/facturx/xml';
import { embedFacturX } from '../src/lib/facturx/embed';
import { addDays, isValidSiren, invoiceTotals, type InvoiceDoc } from '../src/lib/invoices';

const doc = (over: Partial<InvoiceDoc> = {}): InvoiceDoc => ({
  id: 'x',
  kind: 'invoice',
  reference: 'FAC-2026-0001',
  credits_reference: null,
  credits_issue_date: null,
  issue_date: '2026-11-11',
  service_date: '2026-11-10',
  due_date: '2026-12-11',
  operation_category: 'services',
  title: null,
  status: 'issued',
  seller: {
    name: 'Plomberie & Fils',
    legal_form: 'EI',
    siret: '49869512100042',
    vat_number: 'FR12498695121',
    vat_exemption: false,
    vat_on_debits: false,
    address: '12 rue des Lilas, 69003 Lyon',
    email: 'contact@example.fr',
    phone: null,
    iban: 'FR76 3000 6000 0112 3456 7890 189',
  },
  buyer: { name: 'M. Dupont', is_company: false, siren: null, address: '12 rue Paradis, 13006 Marseille', email: null, delivery_address: null },
  payment_terms: 'Paiement à 30 jours',
  late_penalty_text: null,
  global_discount: 10,
  deposit: 100,
  lines: [
    { label: 'Chauffe-eau 200 L', unit: 'u', quantity: 1, unit_price_ht: 890, vat_rate: 10, discount: 0 },
    { label: 'Déplacement', unit: 'forfait', quantity: 1, unit_price_ht: 45, vat_rate: 20, discount: 10 },
  ],
  ...over,
});

const tag = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<ram:${name}[^>]*>([^<]*)</ram:${name}>`, 'g'))].map((m) => m[1]);

describe('outils facture', () => {
  it('SIREN : contrôle de Luhn', () => {
    expect(isValidSiren('498 695 121')).toBe(true);
    expect(isValidSiren('123456789')).toBe(false);
    expect(isValidSiren('12345')).toBe(false);
  });
  it('addDays traverse les fins de mois', () => {
    expect(addDays('2026-11-11', 30)).toBe('2026-12-11');
    expect(addDays('2026-12-20', 30)).toBe('2027-01-19');
  });
  it('adresse : rue / code postal / ville', () => {
    expect(parseAddress('12 rue des Lilas, 69003 Lyon')).toEqual({ line: '12 rue des Lilas', postcode: '69003', city: 'Lyon' });
    expect(parseAddress('Lieu-dit Les Pins')).toEqual({ line: 'Lieu-dit Les Pins', postcode: null, city: null });
  });
  it('échappe le XML', () => {
    expect(xmlEscape('A & B <c> "d"')).toBe('A &amp; B &lt;c&gt; &quot;d&quot;');
  });
});

describe('XML Factur-X (EN 16931)', () => {
  it('facture avec TVA : montants cohérents (règles BR-CO)', () => {
    const d = doc();
    const t = invoiceTotals(d);
    const xml = buildFacturXml(d);
    expect(xml).toContain('urn:cen.eu:en16931:2017');
    expect(tag(xml, 'TypeCode')).toContain('380');
    expect(tag(xml, 'GrandTotalAmount')[0]).toBe((t.total_ttc_cents / 100).toFixed(2));
    expect(tag(xml, 'TotalPrepaidAmount')[0]).toBe('100.00');
    expect(tag(xml, 'DuePayableAmount')[0]).toBe(((t.total_ttc_cents - 10000) / 100).toFixed(2));
    expect(tag(xml, 'TaxBasisTotalAmount')[0]).toBe((t.total_ht_cents / 100).toFixed(2));
    const bases = tag(xml, 'BasisAmount').reduce((s, v) => s + Number(v), 0);
    expect(bases.toFixed(2)).toBe((t.total_ht_cents / 100).toFixed(2));
    expect(xml).toContain('Plomberie &amp; Fils');
    expect(xml).toContain('schemeID="VA"');
  });
  it('franchise en base : catégorie E, aucune TVA, motif article 293 B', () => {
    const d = doc({
      seller: { ...doc().seller, vat_exemption: true, vat_number: null },
      lines: doc().lines.map((l) => ({ ...l, vat_rate: 0 as const })),
    });
    const xml = buildFacturXml(d);
    expect(xml).toContain('<ram:CategoryCode>E</ram:CategoryCode>');
    expect(xml).toContain('VATEX-FR-FRANCHISE');
    expect(xml).toContain('art. 293 B du CGI');
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">0.00</ram:TaxTotalAmount>');
  });
  it('avoir : type 381, montants positifs, facture d’origine référencée', () => {
    const xml = buildFacturXml(doc({ kind: 'credit_note', reference: 'AV-2026-0001', credits_reference: 'FAC-2026-0001', credits_issue_date: '2026-11-11' }));
    expect(tag(xml, 'TypeCode')).toContain('381');
    expect(xml).toContain('<ram:IssuerAssignedID>FAC-2026-0001</ram:IssuerAssignedID>');
    expect(xml).not.toContain('TotalPrepaidAmount');
  });
});

/** Plus petit PDF valide à table de références classique (comme celui de @react-pdf/renderer). */
function tinyPdf(): Uint8Array {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
  ];
  let out = '%PDF-1.3\n';
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 4\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

describe('PDF Factur-X', () => {
  it('ajoute le XML en pièce jointe sans modifier le PDF d’origine', () => {
    const original = tinyPdf();
    const xml = buildFacturXml(doc());
    const out = embedFacturX(original, { xml, title: 'Facture', author: 'Test', created: new Date('2026-11-11T12:00:00Z') });
    const s = Buffer.from(out).toString('latin1');
    expect(s.startsWith('%PDF-1.7')).toBe(true);
    // les octets d'origine (hors en-tête relevé) sont conservés tels quels
    expect(Buffer.from(out).subarray(8, original.length).equals(Buffer.from(original).subarray(8))).toBe(true);
    expect(s).toContain('/AFRelationship /Data');
    expect(s).toContain('(factur-x.xml)');
    expect(s).toContain('/Prev ');
    expect(s).toContain('urn:factur-x:pdfa:CIIXML:1p0#');
    expect(s).toContain('<ram:ID>FAC-2026-0001</ram:ID>');
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
  });
  it('refuse un PDF sans table de références classique', () => {
    expect(() => embedFacturX(new Uint8Array(Buffer.from('%PDF-1.7\nnope')), { xml: '<a/>', title: 't', author: 'a', created: new Date() })).toThrow();
  });
});
