import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import { computeQuoteTotals, UNIT_LABELS, type LineInput, type VatRate } from '@/lib/money';
import type { CompanyProfile } from '@/lib/quotes-server';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1e293b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  companyBlock: { flex: 1 },
  logo: { width: 90, height: 60, objectFit: 'contain', marginRight: 10 },
  companyName: { fontSize: 14, fontWeight: 700 },
  docTitle: { fontSize: 22, fontWeight: 700, textAlign: 'right' },
  ref: { fontSize: 10, textAlign: 'right', color: '#64748b', marginTop: 2 },
  metaBox: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  metaCol: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 6, padding: 10 },
  metaLabel: { fontSize: 8, color: '#64748b', marginBottom: 3, textTransform: 'uppercase' },
  metaValue: { fontSize: 10, fontWeight: 700 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1e293b', color: '#ffffff', padding: 7, borderRadius: 4, fontWeight: 700 },
  row: { flexDirection: 'row', borderBottomWidth: 0.7, borderBottomColor: '#e2e8f0', paddingVertical: 6, paddingHorizontal: 7 },
  colDesignation: { flex: 4.2 },
  colQty: { flex: 1, textAlign: 'right' },
  colUnit: { flex: 0.9, textAlign: 'right' },
  colPu: { flex: 1.4, textAlign: 'right' },
  colTva: { flex: 0.9, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right', fontWeight: 700 },
  totalsBox: { marginTop: 14, alignSelf: 'flex-end', width: 240 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsGrand: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1e293b', color: '#ffffff', padding: 8, borderRadius: 6, marginTop: 4, fontWeight: 700, fontSize: 12 },
  tvaDetail: { color: '#64748b', fontSize: 8, textAlign: 'right', marginTop: 4 },
  legalBlock: { marginTop: 22, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  legalTitle: { fontSize: 8, fontWeight: 700, color: '#475569', marginBottom: 3 },
  legal: { fontSize: 7.5, color: '#64748b', lineHeight: 1.5 },
  estimated: { fontSize: 7.5, color: '#b45309' },
  signatureZone: { marginTop: 18, flexDirection: 'row', gap: 20 },
  sigCol: { flex: 1 },
  sigLine: { borderBottomWidth: 0.7, borderBottomColor: '#94a3b8', height: 44 },
  reducedVatNotice: { marginTop: 10, padding: 8, backgroundColor: '#fefce8', borderRadius: 5, fontSize: 7.5, color: '#854d0e', lineHeight: 1.5 },
});

const VAT_LABEL: Record<number, string> = { 0: '0 %', 2.1: '2,1 %', 5.5: '5,5 %', 10: '10 %', 20: '20 %' };
// Formatage manuel : l'espace fine (U+202F) de toLocaleString n'a pas de glyphe
// dans Helvetica — on groupe avec une espace insécable classique (U+00A0).
const euro = (cents: number) => {
  const n = cents / 100;
  const [intPart, decPart] = n.toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${grouped},${decPart}\u00A0€`;
};

export interface DevisPdfData {
  company: CompanyProfile;
  quote: {
    reference: string;
    title: string | null;
    valid_until: string;
    execution_delay: string | null;
    created_at: string;
    global_discount: number;
  };
  client: { name: string; site_address: string | null };
  lines: LineInput[];
  intro_text?: string | null;
}

export function DevisPdf({ data }: { data: DevisPdfData }) {
  const { company, quote, client, lines } = data;
  const totals = computeQuoteTotals(lines, quote.global_discount ?? 0, 0);
  const hasReducedVat = lines.some((l) => l.vat_rate === 5.5 || l.vat_rate === 10);
  const createdDate = new Date(quote.created_at).toLocaleDateString('fr-FR');
  const validDate = new Date(quote.valid_until).toLocaleDateString('fr-FR');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête : identité et coordonnées de l'entreprise */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', flex: 2 }}>
            {company.logo_url ? <Image style={styles.logo} src={company.logo_url} /> : null}
            <View style={styles.companyBlock}>
              <Text style={styles.companyName}>
                {company.name}
                {company.legal_form ? ` — ${company.legal_form}` : ''}
              </Text>
              {company.address ? <Text>{company.address}</Text> : null}
              {company.phone ? <Text>Tél : {company.phone}</Text> : null}
              {company.email ? <Text>{company.email}</Text> : null}
              {company.siret ? (
                <Text>
                  SIRET {company.siret}
                  {company.legal_form === 'SARL' || company.legal_form === 'EURL'
                    ? ' — RCS'
                    : company.legal_form === 'Micro-entreprise' || company.legal_form === 'EI'
                      ? ''
                      : ''}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={{ flex: 1.2 }}>
            <Text style={styles.docTitle}>DEVIS</Text>
            <Text style={styles.ref}>N° {quote.reference}</Text>
            <Text style={styles.ref}>Date : {createdDate}</Text>
          </View>
        </View>

        {/* Client + lieu d'exécution + validité */}
        <View style={styles.metaBox}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Client</Text>
            <Text style={styles.metaValue}>{client.name}</Text>
            {client.site_address ? <Text>Lieu des travaux : {client.site_address}</Text> : null}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Validité de l&apos;offre</Text>
            <Text style={styles.metaValue}>Jusqu&apos;au {validDate}</Text>
            <Text>Devis établi gratuitement.</Text>
          </View>
          {quote.execution_delay ? (
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Délai d&apos;exécution</Text>
              <Text style={styles.metaValue}>{quote.execution_delay}</Text>
            </View>
          ) : null}
        </View>

        {data.intro_text ? <Text style={{ marginBottom: 10, color: '#475569' }}>{data.intro_text}</Text> : null}

        {/* Décompte détaillé */}
        <View style={styles.tableHeader}>
          <Text style={styles.colDesignation}>Désignation</Text>
          <Text style={styles.colQty}>Qté</Text>
          <Text style={styles.colUnit}>Unité</Text>
          <Text style={styles.colPu}>P.U. HT</Text>
          <Text style={styles.colTva}>TVA</Text>
          <Text style={styles.colTotal}>Total HT</Text>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={styles.colDesignation}>
              {l.label}
              {totals.lines[i].discount_cents > 0 ? ` (remise ${l.discount} %)` : ''}
            </Text>
            <Text style={styles.colQty}>{l.quantity.toLocaleString('fr-FR')}</Text>
            <Text style={styles.colUnit}>{UNIT_LABELS[l.unit]}</Text>
            <Text style={styles.colPu}>{euro(Math.round(l.unit_price_ht * 100))}</Text>
            <Text style={styles.colTva}>{VAT_LABEL[l.vat_rate]}</Text>
            <Text style={styles.colTotal}>{euro(totals.lines[i].line_ht_cents)}</Text>
          </View>
        ))}

        {/* Totaux HT / TVA / TTC */}
        <View style={styles.totalsBox}>
          {totals.global_discount_cents > 0 ? (
            <View style={styles.totalsRow}>
              <Text>Remise globale</Text>
              <Text>- {euro(totals.global_discount_cents)}</Text>
            </View>
          ) : null}
          <View style={styles.totalsRow}>
            <Text>Total HT</Text>
            <Text>{euro(totals.total_ht_cents)}</Text>
          </View>
          {company.vat_exemption ? (
            <View style={styles.totalsRow}>
              <Text>TVA</Text>
              <Text>—</Text>
            </View>
          ) : (
            totals.vat_buckets.map((b) => (
              <View key={b.rate} style={styles.totalsRow}>
                <Text>TVA {VAT_LABEL[b.rate]} (base {euro(b.base_cents)})</Text>
                <Text>{euro(b.vat_cents)}</Text>
              </View>
            ))
          )}
          <View style={styles.totalsGrand}>
            <Text>TOTAL TTC</Text>
            <Text>{euro(company.vat_exemption ? totals.total_ht_cents : totals.total_ttc_cents)}</Text>
          </View>
          <Text style={styles.tvaDetail}>
            {company.vat_exemption
              ? 'TVA non applicable, art. 293 B du CGI'
              : `Total HT : ${euro(totals.total_ht_cents)} — Total TTC : ${euro(totals.total_ttc_cents)}`}
          </Text>
        </View>

        {hasReducedVat && !company.vat_exemption ? (
          <View style={styles.reducedVatNotice}>
            <Text>
              Attestation simplifiée — TVA taux réduit : « Le client atteste que les travaux
              concernent un logement d&apos;habitation achevé depuis plus de deux ans et que les
              conditions d&apos;application du taux réduit de TVA (art. 278-0 ter et 279-0 bis du CGI)
              sont remplies. »
            </Text>
          </View>
        ) : null}

        {/* Bon pour accord + signature */}
        <View style={styles.signatureZone}>
          <View style={styles.sigCol}>
            <Text style={{ fontSize: 8, fontWeight: 700 }}>Bon pour accord (date et signature du client)</Text>
            <Text style={{ fontSize: 7, color: '#64748b', marginVertical: 3 }}>
              « Devis reçu avant l&apos;exécution des travaux. » La signature vaut acceptation du
              devis et de ses conditions.
            </Text>
            <View style={styles.sigLine} />
          </View>
        </View>

        {/* Mentions légales et conditions */}
        <View style={styles.legalBlock}>
          <Text style={styles.legalTitle}>Conditions de paiement</Text>
          <Text style={styles.legal}>{company.payment_terms ?? 'Paiement à 30 jours après réception de facture.'}</Text>
          {company.iban ? (
            <>
              <Text style={styles.legalTitle}>Coordonnées bancaires</Text>
              <Text style={styles.legal}>IBAN : {company.iban}</Text>
            </>
          ) : null}
          {company.insurance_provider ? (
            <>
              <Text style={styles.legalTitle}>Assurance professionnelle / décennale</Text>
              <Text style={styles.legal}>
                Assureur : {company.insurance_provider}
                {company.insurance_policy_number ? ` — N° de police : ${company.insurance_policy_number}` : ''}
              </Text>
            </>
          ) : null}
          <Text style={styles.legalTitle}>Informations légales</Text>
          <Text style={styles.legal}>
            Le client dispose d&apos;un droit de rétractation de 14 jours pour les contrats conclus à
            distance ou hors établissement (art. L221-18 du Code de la consommation). Le client peut,
            s&apos;il le souhaite, conserver les pièces, éléments ou appareils remplacés. Devis établi
            gratuitement le {createdDate}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
