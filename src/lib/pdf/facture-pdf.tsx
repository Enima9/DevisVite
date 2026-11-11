import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { UNIT_LABELS } from '@/lib/money';
import {
  invoiceTotals,
  formatDateFr,
  LATE_PENALTY_TEXT,
  OPERATION_LABELS,
  VAT_FRANCHISE_TEXT,
  type InvoiceDoc,
} from '@/lib/invoices';

const BLUE = '#1F4FBF';
const INK = '#1B2430';

const VAT_LABEL: Record<number, string> = { 0: '0 %', 2.1: '2,1 %', 5.5: '5,5 %', 10: '10 %', 20: '20 %' };
// Espace insécable classique (U+00A0) : l'espace fine de toLocaleString manque dans certaines polices.
const euro = (cents: number) => {
  const neg = cents < 0;
  const [intPart, decPart] = (Math.abs(cents) / 100).toFixed(2).split('.');
  return `${neg ? '-' : ''}${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${decPart} €`;
};

function makeStyles(family: string) {
  return StyleSheet.create({
    page: { padding: 34, paddingTop: 38, fontSize: 8.6, fontFamily: family, color: INK, borderTopWidth: 6, borderTopColor: BLUE },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    company: { flex: 1.6 },
    companyName: { fontSize: 12.5, fontWeight: 700, marginBottom: 2 },
    docTitle: { fontSize: 24, fontWeight: 700, textAlign: 'right', color: BLUE, letterSpacing: 1.5 },
    ref: { fontSize: 9, textAlign: 'right', color: '#475569', marginTop: 2 },
    boxes: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    box: { flex: 1, backgroundColor: '#f4f6f9', borderLeftWidth: 3, borderLeftColor: BLUE, padding: 9 },
    boxLabel: { fontSize: 7.5, color: '#475569', marginBottom: 3 },
    boxValue: { fontSize: 9.5, fontWeight: 700, marginBottom: 1 },
    tableHeader: { flexDirection: 'row', padding: 6, borderTopWidth: 1.5, borderTopColor: INK, borderBottomWidth: 1.5, borderBottomColor: INK, fontWeight: 700 },
    row: { flexDirection: 'row', borderBottomWidth: 0.7, borderBottomColor: '#cbd2db', paddingVertical: 5, paddingHorizontal: 6 },
    cDes: { flex: 4.3 },
    cQty: { flex: 0.9, textAlign: 'right' },
    cUnit: { flex: 1, textAlign: 'right' },
    cPu: { flex: 1.5, textAlign: 'right' },
    cTva: { flex: 0.9, textAlign: 'right' },
    cTot: { flex: 1.6, textAlign: 'right', fontWeight: 700 },
    totals: { marginTop: 12, alignSelf: 'flex-end', width: 250 },
    tRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
    tGrand: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: BLUE, color: '#ffffff', padding: 7, marginTop: 4, fontWeight: 700, fontSize: 10.5 },
    tDue: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1.5, borderColor: BLUE, padding: 7, marginTop: 4, fontWeight: 700, fontSize: 10.5 },
    note: { fontSize: 7.5, color: '#64748b', textAlign: 'right', marginTop: 4 },
    legal: { marginTop: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#cbd2db' },
    legalTitle: { fontSize: 7.5, fontWeight: 700, color: '#475569', marginTop: 4, marginBottom: 2 },
    legalText: { fontSize: 7.3, color: '#64748b', lineHeight: 1.5 },
  });
}

export function FacturePdf({ doc, family }: { doc: InvoiceDoc; family: 'DejaVu' | 'Helvetica' }) {
  const s = makeStyles(family);
  const totals = invoiceTotals(doc);
  const isCredit = doc.kind === 'credit_note';
  const exempt = doc.seller.vat_exemption;
  const totalVat = exempt ? 0 : totals.total_vat_cents;
  const totalTtc = totals.total_ht_cents + totalVat;
  const prepaid = isCredit ? 0 : totals.deposit_cents;
  const title = isCredit ? 'AVOIR' : 'FACTURE';

  return (
    <Document title={`${isCredit ? 'Avoir' : 'Facture'} ${doc.reference}`} author={doc.seller.name} creator="DevisVite" producer="DevisVite">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.company}>
            <Text style={s.companyName}>
              {doc.seller.name}
              {doc.seller.legal_form ? ` — ${doc.seller.legal_form}` : ''}
            </Text>
            <Text>{doc.seller.address}</Text>
            {doc.seller.phone ? <Text>Tél : {doc.seller.phone}</Text> : null}
            {doc.seller.email ? <Text>{doc.seller.email}</Text> : null}
            <Text>SIRET {doc.seller.siret}</Text>
            {doc.seller.vat_number ? <Text>N° de TVA intracommunautaire : {doc.seller.vat_number}</Text> : null}
          </View>
          <View style={{ flex: 1.2 }}>
            <Text style={s.docTitle}>{title}</Text>
            <Text style={s.ref}>N° {doc.reference}</Text>
            <Text style={s.ref}>Date d’émission : {formatDateFr(doc.issue_date)}</Text>
            {isCredit && doc.credits_reference ? (
              <Text style={s.ref}>Avoir sur la facture {doc.credits_reference}</Text>
            ) : null}
          </View>
        </View>

        <View style={s.boxes}>
          <View style={s.box}>
            <Text style={s.boxLabel}>Client</Text>
            <Text style={s.boxValue}>{doc.buyer.name}</Text>
            <Text>{doc.buyer.address}</Text>
            {doc.buyer.siren ? <Text>SIREN {doc.buyer.siren}</Text> : null}
            {doc.buyer.delivery_address ? <Text>Adresse de livraison / des travaux : {doc.buyer.delivery_address}</Text> : null}
          </View>
          <View style={s.box}>
            <Text style={s.boxLabel}>Opération</Text>
            <Text style={s.boxValue}>{OPERATION_LABELS[doc.operation_category]}</Text>
            <Text>Date de la prestation : {formatDateFr(doc.service_date)}</Text>
            <Text>{isCredit ? 'Avoir à déduire de la facture d’origine' : `Échéance de paiement : ${formatDateFr(doc.due_date)}`}</Text>
          </View>
        </View>

        {doc.title ? <Text style={{ marginBottom: 8, color: '#475569' }}>{doc.title}</Text> : null}

        <View style={s.tableHeader}>
          <Text style={s.cDes}>Désignation</Text>
          <Text style={s.cQty}>Qté</Text>
          <Text style={s.cUnit}>Unité</Text>
          <Text style={s.cPu}>P.U. HT</Text>
          <Text style={s.cTva}>TVA</Text>
          <Text style={s.cTot}>Total HT</Text>
        </View>
        {doc.lines.map((l, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.cDes}>
              {l.label}
              {totals.lines[i].discount_cents > 0 ? ` (remise ${l.discount} %)` : ''}
            </Text>
            <Text style={s.cQty}>{l.quantity.toLocaleString('fr-FR')}</Text>
            <Text style={s.cUnit}>{UNIT_LABELS[l.unit]}</Text>
            <Text style={s.cPu}>{euro(Math.round(l.unit_price_ht * 100))}</Text>
            <Text style={s.cTva}>{VAT_LABEL[exempt ? 0 : l.vat_rate]}</Text>
            <Text style={s.cTot}>{euro(totals.lines[i].line_ht_cents)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          {totals.global_discount_cents > 0 ? (
            <View style={s.tRow}>
              <Text>Remise globale</Text>
              <Text>- {euro(totals.global_discount_cents)}</Text>
            </View>
          ) : null}
          <View style={s.tRow}>
            <Text>Total HT</Text>
            <Text>{euro(totals.total_ht_cents)}</Text>
          </View>
          {exempt ? (
            <View style={s.tRow}>
              <Text>TVA</Text>
              <Text>{euro(0)}</Text>
            </View>
          ) : (
            totals.vat_buckets.map((b) => (
              <View key={b.rate} style={s.tRow}>
                <Text>TVA {VAT_LABEL[b.rate]} (base {euro(b.base_cents)})</Text>
                <Text>{euro(b.vat_cents)}</Text>
              </View>
            ))
          )}
          <View style={s.tGrand}>
            <Text>TOTAL TTC</Text>
            <Text>{euro(totalTtc)}</Text>
          </View>
          {prepaid > 0 ? (
            <View style={s.tRow}>
              <Text>Acompte déjà réglé</Text>
              <Text>- {euro(prepaid)}</Text>
            </View>
          ) : null}
          <View style={s.tDue}>
            <Text>{isCredit ? 'MONTANT DE L’AVOIR' : 'NET À PAYER'}</Text>
            <Text>{euro(totalTtc - prepaid)}</Text>
          </View>
          {exempt ? <Text style={s.note}>{VAT_FRANCHISE_TEXT}</Text> : null}
        </View>

        <View style={s.legal}>
          {!isCredit ? (
            <>
              <Text style={s.legalTitle}>Conditions de paiement</Text>
              <Text style={s.legalText}>
                {doc.payment_terms ?? 'Paiement à 30 jours après réception de facture.'} Date limite de règlement :{' '}
                {formatDateFr(doc.due_date)}.
              </Text>
              {doc.seller.iban ? (
                <>
                  <Text style={s.legalTitle}>Coordonnées bancaires</Text>
                  <Text style={s.legalText}>IBAN : {doc.seller.iban}</Text>
                </>
              ) : null}
              <Text style={s.legalTitle}>Retard de paiement</Text>
              <Text style={s.legalText}>{doc.late_penalty_text ?? LATE_PENALTY_TEXT}</Text>
            </>
          ) : null}
          {doc.seller.vat_on_debits ? (
            <>
              <Text style={s.legalTitle}>TVA</Text>
              <Text style={s.legalText}>Option pour le paiement de la TVA d’après les débits.</Text>
            </>
          ) : null}
          <Text style={s.legalTitle}>Facture électronique</Text>
          <Text style={s.legalText}>
            Ce document est un PDF au format Factur-X : il contient les données de la facture lisibles par un
            logiciel (fichier factur-x.xml, profil EN 16931).
          </Text>
        </View>
      </Page>
    </Document>
  );
}
