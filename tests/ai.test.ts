import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapDraftToEditorLines,
  aiDraftSchema,
  type AiDraft,
  type CatalogItemForAi,
} from '../src/lib/ai/schema';
import {
  QUOTE_SYSTEM_PROMPT,
  buildCatalogBlock,
  buildUserPrompt,
  extractJson,
} from '../src/lib/ai/prompt';
import { checkAiRateLimit, checkRateLimit, resetRateLimits } from '../src/lib/ratelimit';
import { estimateCostCents } from '../src/lib/ai/anthropic';

const catalogItem = (over: Partial<CatalogItemForAi> = {}): CatalogItemForAi => ({
  id: 'c1',
  label: 'Remplacement chauffe-eau électrique 200 L',
  unit: 'u',
  unit_price_ht: 890,
  vat_rate: 20,
  category: 'Chauffe-eau',
  is_labor: false,
  is_travel: false,
  ...over,
});

const catalog = [
  catalogItem(),
  catalogItem({ id: 'c2', label: 'Main-d\u2019œuvre plomberie', unit: 'h', unit_price_ht: 55, is_labor: true }),
  catalogItem({ id: 'c3', label: 'Déplacement', unit: 'forfait', unit_price_ht: 45, is_travel: true }),
];

const draft = (lines: AiDraft['lines'], questions: string[] = []): AiDraft => ({
  title: 'Remplacement chauffe-eau',
  lines,
  remarks: '',
  clarifying_questions: questions,
});

describe('mapDraftToEditorLines — règle : priorité aux prix du catalogue', () => {
  it('marque "catalog" (non estimé) quand l\u2019IA reprend exactement le prix du catalogue', () => {
    const result = mapDraftToEditorLines(
      draft([
        { label: 'Remplacement chauffe-eau électrique 200 L', unit: 'u', quantity: 1, unit_price_ht: 890, vat_rate: 20, is_labor: false, is_travel: false },
      ]),
      catalog
    );
    expect(result[0].estimated).toBe(false);
    expect(result[0].source).toBe('catalog');
    expect(result[0].unit_price_ht).toBe('890');
  });

  it('marque "ai"/estimé quand le prix ne vient pas du catalogue', () => {
    const result = mapDraftToEditorLines(
      draft([
        { label: 'Évacuation de l\u2019ancien chauffe-eau', unit: 'forfait', quantity: 1, unit_price_ht: 60, vat_rate: 20, is_labor: false, is_travel: false },
      ]),
      catalog
    );
    expect(result[0].estimated).toBe(true);
    expect(result[0].source).toBe('ai');
  });

  it('reprend LE PRIX DU CATALOGUE si l\u2019IA propose un prix différent pour le même item', () => {
    const result = mapDraftToEditorLines(
      draft([
        // même désignation/unité/TVA, mais l'IA "imagine" 750 € au lieu de 890 €
        { label: 'Remplacement chauffe-eau électrique 200 L', unit: 'u', quantity: 1, unit_price_ht: 750, vat_rate: 20, is_labor: false, is_travel: false },
      ]),
      catalog
    );
    expect(result[0].source).toBe('catalog');
    expect(result[0].unit_price_ht).toBe('890');
    expect(result[0].estimated).toBe(false);
  });

  it('ignore la casse et les accents pour reconnaître un item du catalogue', () => {
    const result = mapDraftToEditorLines(
      draft([
        { label: 'REMPLACEMENT CHAUFFE-EAU ÉLECTRIQUE 200 L', unit: 'u', quantity: 1, unit_price_ht: 890, vat_rate: 20, is_labor: false, is_travel: false },
      ]),
      catalog
    );
    expect(result[0].source).toBe('catalog');
    expect(result[0].estimated).toBe(false);
  });

  it('ne reconnaît pas un item si l\u2019unité diffère (ex. m² vs u)', () => {
    const result = mapDraftToEditorLines(
      draft([
        { label: 'Main-d\u2019œuvre plomberie', unit: 'forfait', quantity: 1, unit_price_ht: 55, vat_rate: 20, is_labor: true, is_travel: false },
      ]),
      catalog
    );
    expect(result[0].estimated).toBe(true);
  });
});

describe('aiDraftSchema — validation stricte de la sortie IA', () => {
  it('accepte un brouillon valide', () => {
    const parsed = aiDraftSchema.safeParse(
      draft([{ label: 'Ligne', unit: 'u', quantity: 1, unit_price_ht: 100, vat_rate: 20, is_labor: false, is_travel: false }])
    );
    expect(parsed.success).toBe(true);
  });

  it('rejette un taux de TVA inventé (ex. 7 %)', () => {
    const parsed = aiDraftSchema.safeParse(
      draft([{ label: 'Ligne', unit: 'u', quantity: 1, unit_price_ht: 100, vat_rate: 7, is_labor: false, is_travel: false }])
    );
    expect(parsed.success).toBe(false);
  });

  it('rejette une unité hors liste', () => {
    const parsed = aiDraftSchema.safeParse(
      draft([{ label: 'Ligne', unit: 'km', quantity: 1, unit_price_ht: 100, vat_rate: 20, is_labor: false, is_travel: false } as never])
    );
    expect(parsed.success).toBe(false);
  });

  it('exige des lignes OU des questions de clarification (jamais les deux vides)', () => {
    const parsed = aiDraftSchema.safeParse(draft([], []));
    expect(parsed.success).toBe(false);
  });

  it('limite à 3 questions de clarification', () => {
    const parsed = aiDraftSchema.safeParse(
      draft([], ['Q1 ?', 'Q2 ?', 'Q3 ?', 'Q4 ?'])
    );
    expect(parsed.success).toBe(false);
  });
});

describe('prompts', () => {
  it('le prompt système contient la règle de priorité du catalogue', () => {
    expect(QUOTE_SYSTEM_PROMPT).toContain('PRIORITÉ ABSOLUE');
    expect(QUOTE_SYSTEM_PROMPT).toContain('Ne réinvente jamais un prix');
    expect(QUOTE_SYSTEM_PROMPT).toContain('clarifying_questions');
  });

  it('buildCatalogBlock liste les items avec prix et TVA', () => {
    const block = buildCatalogBlock(catalog);
    expect(block).toContain('Remplacement chauffe-eau électrique 200 L');
    expect(block).toContain('890.00 €');
    expect(block).toContain('TVA: 20 %');
  });

  it('buildCatalogBlock précise le cas catalogue vide', () => {
    expect(buildCatalogBlock([])).toContain('catalogue de l\'artisan est vide');
  });

  it('buildUserPrompt inclut métier, catalogue et description délimitée', () => {
    const prompt = buildUserPrompt({
      trade: 'plombier',
      catalog,
      description: 'remplacement chauffe-eau 200 L',
    });
    expect(prompt).toContain('M\u00e9tier de l\'artisan : plombier');
    expect(prompt).toContain('"""remplacement chauffe-eau 200 L"""');
  });

  it('extractJson tolère les balises markdown et le texte autour', () => {
    const obj = extractJson('```json\n{"a": 1}\n```');
    expect(obj).toEqual({ a: 1 });
    const obj2 = extractJson('Voici le résultat : {"b": 2} merci');
    expect(obj2).toEqual({ b: 2 });
    expect(() => extractJson('pas de json ici')).toThrow();
  });
});

describe('limitation de débit IA', () => {
  beforeEach(() => resetRateLimits());

  it('laisse passer les 20 premiers appels puis bloque', () => {
    let last = { allowed: true } as ReturnType<typeof checkAiRateLimit>;
    for (let i = 0; i < 20; i++) {
      last = checkAiRateLimit('company-1', 1_000_000);
      expect(last.allowed).toBe(true);
    }
    const blocked = checkAiRateLimit('company-1', 1_000_000 + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('est indépendant par entreprise', () => {
    checkRateLimit('ai:company-A', { max: 1, windowMs: 60000, now: 1000 });
    const other = checkRateLimit('ai:company-B', { max: 1, windowMs: 60000, now: 1000 });
    expect(other.allowed).toBe(true);
  });

  it('déblocage après expiration de la fenêtre', () => {
    checkRateLimit('ai:company-C', { max: 1, windowMs: 60000, now: 1000 });
    const blocked = checkRateLimit('ai:company-C', { max: 1, windowMs: 60000, now: 5000 });
    expect(blocked.allowed).toBe(false);
    const afterWindow = checkRateLimit('ai:company-C', { max: 1, windowMs: 60000, now: 61000 });
    expect(afterWindow.allowed).toBe(true);
  });
});

describe('plafond de dépense IA', () => {
  it('estime le coût : 1000 tokens in + 500 out ≈ 1 € (100 cents, arrondi sup)', () => {
    const cents = estimateCostCents({ input_tokens: 1000, output_tokens: 500 });
    // (1000×3 + 500×15)/1M = 0.0105 $ → 1.05 ¢ → ceil = 2 cents
    expect(cents).toBe(2);
  });

  it('un appel typique de devis reste bien sous 10 cents', () => {
    const cents = estimateCostCents({ input_tokens: 3000, output_tokens: 800 });
    expect(cents).toBeLessThan(10);
  });
});
