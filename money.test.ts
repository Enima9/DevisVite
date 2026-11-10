import { describe, it, expect } from 'vitest';
import {
  computeLineTotals,
  computeQuoteTotals,
  parseEuroInput,
  formatQuoteReference,
  formatEuro,
  type LineInput,
} from '../src/lib/money';

const line = (over: Partial<LineInput> = {}): LineInput => ({
  label: 'Ligne',
  unit: 'u',
  quantity: 1,
  unit_price_ht: 100,
  vat_rate: 20,
  discount: 0,
  ...over,
});

describe('computeLineTotals', () => {
  it('arrondit au centime (2,5 h × 55 € = 137,50 €)', () => {
    const t = computeLineTotals(line({ quantity: 2.5, unit_price_ht: 55, unit: 'h' }));
    expect(t.line_ht_cents).toBe(13750);
  });

  it('applique la remise ligne (10 %)', () => {
    const t = computeLineTotals(line({ quantity: 1, unit_price_ht: 89.9, discount: 10 }));
    expect(t.gross_cents).toBe(8990);
    expect(t.discount_cents).toBe(899);
    expect(t.line_ht_cents).toBe(8091);
  });

  it('gère la quantité 0', () => {
    expect(computeLineTotals(line({ quantity: 0 })).line_ht_cents).toBe(0);
  });

  it('n\u2019accepte pas une remise > 100 %', () => {
    const t = computeLineTotals(line({ discount: 150 }));
    expect(t.line_ht_cents).toBe(0);
  });
});

describe('computeQuoteTotals', () => {
  it('additionne plusieurs taux de TVA avec arrondi par taux', () => {
    const totals = computeQuoteTotals([
      line({ quantity: 1, unit_price_ht: 100, vat_rate: 20 }), // HT 10000, TVA 2000
      line({ quantity: 1, unit_price_ht: 100, vat_rate: 10 }), // HT 10000, TVA 1000
      line({ quantity: 1, unit_price_ht: 100, vat_rate: 5.5 }), // HT 10000, TVA 550
    ]);
    expect(totals.total_ht_cents).toBe(30000);
    expect(totals.total_vat_cents).toBe(3550);
    expect(totals.total_ttc_cents).toBe(33550);
    expect(totals.vat_buckets).toHaveLength(3);
  });

  it('exemple exact : chauffe-eau 200 L (du scénario produit)', () => {
    // Remplacement chauffe-eau 200 L : fourniture 690 € à 20 % + 3 h MO à 55 € + déplacement 45 €
    const totals = computeQuoteTotals([
      line({ label: 'Chauffe-eau 200 L', unit_price_ht: 690 }),
      line({ label: 'Main-d\u2019œuvre', unit: 'h', quantity: 3, unit_price_ht: 55 }),
      line({ label: 'Déplacement', unit: 'forfait', unit_price_ht: 45 }),
    ]);
    expect(totals.total_ht_cents).toBe(90000); // 900,00 €
    expect(totals.total_vat_cents).toBe(18000); // 180,00 €
    expect(totals.total_ttc_cents).toBe(108000); // 1 080,00 €
  });

  it('TVB 0 % (franchise en base) : TTC = HT', () => {
    const totals = computeQuoteTotals([line({ unit_price_ht: 250, vat_rate: 0 })]);
    expect(totals.total_ht_cents).toBe(25000);
    expect(totals.total_vat_cents).toBe(0);
    expect(totals.total_ttc_cents).toBe(25000);
  });

  it('remise globale répartie au prorata, TVA recalculée par taux', () => {
    const totals = computeQuoteTotals(
      [
        line({ unit_price_ht: 100, vat_rate: 20 }),
        line({ unit_price_ht: 100, vat_rate: 10 }),
      ],
      50 // 50 € de remise globale
    );
    // Chaque ligne passe de 100 € à 75 €
    expect(totals.total_ht_cents).toBe(15000);
    expect(totals.vat_buckets.find((b) => b.rate === 20)!.base_cents).toBe(7500);
    expect(totals.vat_buckets.find((b) => b.rate === 20)!.vat_cents).toBe(1500);
    expect(totals.vat_buckets.find((b) => b.rate === 10)!.vat_cents).toBe(750);
    expect(totals.total_ttc_cents).toBe(17250);
    expect(totals.global_discount_cents).toBe(5000);
  });

  it('la remise globale ne peut pas dépasser le total HT', () => {
    const totals = computeQuoteTotals([line({ unit_price_ht: 40 })], 100);
    expect(totals.total_ht_cents).toBe(0);
    expect(totals.total_ttc_cents).toBe(0);
  });

  it('acompte déduit du TTC restant', () => {
    const totals = computeQuoteTotals([line({ unit_price_ht: 1000 })], 0, 300);
    expect(totals.total_ttc_cents).toBe(120000); // 1 200,00 € TTC
    expect(totals.deposit_cents).toBe(30000); // acompte 300,00 €
    expect(totals.net_ttc_cents).toBe(90000); // reste 900,00 €
  });

  it('arrondi exact sur cas piégeux (0,1 + 0,2 en flottants)', () => {
    const totals = computeQuoteTotals([
      line({ unit_price_ht: 0.1, quantity: 1 }),
      line({ unit_price_ht: 0.2, quantity: 1 }),
    ]);
    expect(totals.total_ht_cents).toBe(30); // 0,30 € pile, pas 0.30000000000000004
  });

  it('base HT agrégée par taux avant calcul de la TVA', () => {
    // Deux lignes à 5,5 % : la TVA est calculée sur la somme, une seule fois
    const totals = computeQuoteTotals([
      line({ unit_price_ht: 33.33, vat_rate: 5.5 }),
      line({ unit_price_ht: 33.33, vat_rate: 5.5 }),
    ]);
    expect(totals.total_ht_cents).toBe(6666);
    expect(totals.vat_buckets[0].base_cents).toBe(6666);
    expect(totals.vat_buckets[0].vat_cents).toBe(367); // round(66.66 × 0.055 × 100) = 367
  });
});

describe('utilitaires', () => {
  it('parseEuroInput accepte la virgule française', () => {
    expect(parseEuroInput('89,90')).toBeCloseTo(89.9);
    expect(parseEuroInput(' 1 200 ')).toBe(1200);
    expect(parseEuroInput('abc')).toBe(0);
  });

  it('formatQuoteReference', () => {
    expect(formatQuoteReference(2026, 3)).toBe('DEV-2026-0004');
  });

  it('formatEuro', () => {
    expect(formatEuro(108000)).toContain('080,00'); // 1 080,00 €
  });
});
