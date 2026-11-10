/**
 * Calculs financiers — tout en CENTIMES entiers pour éviter les erreurs de flottants.
 * Règle : arrondi du HT par ligne, puis TVA calculée et arrondie PAR TAUX
 * sur la base HT agrégée (méthode standard des factures françaises).
 */

export type Unit = 'u' | 'h' | 'm2' | 'ml' | 'forfait';

export const VAT_RATES = [0, 2.1, 5.5, 10, 20] as const;
export type VatRate = (typeof VAT_RATES)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  u: 'u',
  h: 'h',
  m2: 'm²',
  ml: 'ml',
  forfait: 'forfait',
};

export interface LineInput {
  label: string;
  unit: Unit;
  quantity: number; // ex. 2.5
  unit_price_ht: number; // en EUROS (saisie utilisateur)
  vat_rate: VatRate;
  discount: number; // pourcentage 0-100 par ligne
}

export interface LineTotals {
  line_ht_cents: number; // HT après remise ligne
  gross_cents: number; // HT avant remise ligne
  discount_cents: number; // remise ligne
  vat_rate: VatRate;
}

export interface VatBucket {
  rate: VatRate;
  base_cents: number; // base HT au taux donné (après remises)
  vat_cents: number;
}

export interface QuoteTotals {
  lines: LineTotals[];
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  vat_buckets: VatBucket[];
  global_discount_cents: number;
  deposit_cents: number;
  net_ttc_cents: number; // TTC moins acompte
}

function roundCents(x: number): number {
  return Math.round(x + Number.EPSILON);
}

/** Total HT d'une ligne, arrondi au centime, remise ligne déduite. */
export function computeLineTotals(line: LineInput): LineTotals {
  const gross = roundCents(line.quantity * line.unit_price_ht * 100);
  const discountCents = roundCents((gross * Math.min(Math.max(line.discount, 0), 100)) / 100);
  return {
    gross_cents: gross,
    discount_cents: discountCents,
    line_ht_cents: gross - discountCents,
    vat_rate: line.vat_rate,
  };
}

/**
 * Totaux du devis complet.
 * - remise globale répartie au prorata sur les lignes (arrondie ligne par ligne)
 * - TVA agrégée par taux : base = somme des lignes HT arrondies, TVA = round(base × taux / 100)
 */
export function computeQuoteTotals(
  lines: LineInput[],
  globalDiscountEuros = 0,
  depositEuros = 0
): QuoteTotals {
  const lineTotals = lines.map(computeLineTotals);
  const rawHt = lineTotals.reduce((s, l) => s + l.line_ht_cents, 0);

  const globalDiscountCents = Math.min(
    roundCents(globalDiscountEuros * 100),
    rawHt
  );

  // Répartition prorata de la remise globale, dernière ligne = reste (somme exacte)
  let remaining = globalDiscountCents;
  const netHt = lineTotals.map((l, i) => {
    let lineDiscount = 0;
    if (globalDiscountCents > 0 && rawHt > 0) {
      if (i === lineTotals.length - 1) {
        lineDiscount = remaining;
      } else {
        lineDiscount = Math.round((l.line_ht_cents * globalDiscountCents) / rawHt);
        remaining -= lineDiscount;
      }
    }
    return l.line_ht_cents - lineDiscount;
  });

  // Agrégation de la TVA par taux sur les bases HT nettes
  const byRate = new Map<VatRate, number>();
  lineTotals.forEach((l, i) => {
    byRate.set(l.vat_rate, (byRate.get(l.vat_rate) ?? 0) + netHt[i]);
  });

  const vatBuckets: VatBucket[] = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, base]) => ({
      rate,
      base_cents: base,
      vat_cents: roundCents((base * rate) / 100),
    }));

  const totalHt = netHt.reduce((s, v) => s + v, 0);
  const totalVat = vatBuckets.reduce((s, b) => s + b.vat_cents, 0);
  const totalTtc = totalHt + totalVat;
  const depositCents = Math.min(roundCents(depositEuros * 100), totalTtc);

  return {
    lines: lineTotals,
    total_ht_cents: totalHt,
    total_vat_cents: totalVat,
    total_ttc_cents: totalTtc,
    vat_buckets: vatBuckets,
    global_discount_cents: globalDiscountCents,
    deposit_cents: depositCents,
    net_ttc_cents: totalTtc - depositCents,
  };
}

/** Saisie en euros (ex. "89,90") → nombre propre. */
export function parseEuroInput(value: string | number): number {
  if (typeof value === 'number') return value;
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Référence de devis : DEV-<année>-<numéro sur 4 chiffres> */
export function formatQuoteReference(year: number, count: number): string {
  return `DEV-${year}-${String(count + 1).padStart(4, '0')}`;
}

export function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });
}
