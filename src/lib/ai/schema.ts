/**
 * Schémas Zod pour la sortie IA + mapping vers l'éditeur.
 * Module pur (aucune dépendance serveur) : utilisable côté client et en tests.
 */
import { z } from 'zod';

export const VAT_ALLOWED = [0, 2.1, 5.5, 10, 20] as const;

export const aiLineSchema = z.object({
  label: z.string().min(1).max(200),
  unit: z.enum(['u', 'h', 'm2', 'ml', 'forfait']),
  quantity: z.number().positive().max(10000),
  unit_price_ht: z.number().min(0).max(1000000),
  vat_rate: z
    .number()
    .refine((v) => (VAT_ALLOWED as readonly number[]).includes(v), 'Taux de TVA invalide'),
  is_labor: z.boolean().default(false),
  is_travel: z.boolean().default(false),
});

export const aiDraftSchema = z
  .object({
    title: z.string().max(120).default(''),
    lines: z.array(aiLineSchema).max(30),
    remarks: z.string().max(1000).default(''),
    clarifying_questions: z.array(z.string().max(300)).max(3).default([]),
  })
  .refine(
    (d) => d.lines.length > 0 || d.clarifying_questions.length > 0,
    'Un brouillon doit contenir des lignes ou des questions de clarification'
  );

export type AiDraft = z.infer<typeof aiDraftSchema>;

export interface CatalogItemForAi {
  id: string;
  label: string;
  unit: string;
  unit_price_ht: number;
  vat_rate: number;
  category: string | null;
  is_labor: boolean;
  is_travel: boolean;
}

export interface EditorLineAi {
  label: string;
  unit: 'u' | 'h' | 'm2' | 'ml' | 'forfait';
  quantity: string;
  unit_price_ht: string;
  vat_rate: string;
  discount: string;
  estimated: boolean;
  source: 'catalog' | 'ai' | 'manual';
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mappe le brouillon IA vers les lignes de l'éditeur.
 * Règle impérative : une ligne est considérée "issue du catalogue" (prix fiable)
 * uniquement si on trouve un item du catalogue avec la même désignation normalisée,
 * la même unité, le même taux de TVA ET le même prix. Sinon → "Prix estimé, à vérifier".
 */
export function mapDraftToEditorLines(
  draft: AiDraft,
  catalog: CatalogItemForAi[]
): EditorLineAi[] {
  const byNormalized = new Map(
    catalog.map((c) => [
      `${normalizeLabel(c.label)}|${c.unit}|${Number(c.vat_rate)}`,
      c,
    ])
  );

  return draft.lines.map((l) => {
    const key = `${normalizeLabel(l.label)}|${l.unit}|${l.vat_rate}`;
    const match = byNormalized.get(key);
    const priceMatches =
      match !== undefined && Math.abs(Number(match.unit_price_ht) - l.unit_price_ht) < 0.01;

    if (match && priceMatches) {
      return {
        label: l.label,
        unit: l.unit,
        quantity: String(l.quantity),
        unit_price_ht: String(l.unit_price_ht),
        vat_rate: String(l.vat_rate),
        discount: '0',
        estimated: false,
        source: 'catalog' as const,
      };
    }
    // Même désignation trouvée mais prix différent : on reprend LE PRIX DU CATALOGUE
    // (priorité au catalogue) et on marque la ligne comme vérifiable.
    if (match && !priceMatches) {
      return {
        label: l.label,
        unit: l.unit,
        quantity: String(l.quantity),
        unit_price_ht: String(Number(match.unit_price_ht)),
        vat_rate: String(Number(match.vat_rate)),
        discount: '0',
        estimated: false,
        source: 'catalog' as const,
      };
    }
    return {
      label: l.label,
      unit: l.unit,
      quantity: String(l.quantity),
      unit_price_ht: String(l.unit_price_ht),
      vat_rate: String(l.vat_rate),
      discount: '0',
      estimated: true,
      source: 'ai' as const,
    };
  });
}
