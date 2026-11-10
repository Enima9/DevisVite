/**
 * Construction des prompts (fonctions pures, testables).
 * Règle clé : l'IA doit utiliser en priorité les prix du catalogue de l'artisan.
 * Tout prix estimé doit être signalé ; elle ne doit jamais inventer un prix silencieusement.
 */
import type { CatalogItemForAi } from './schema';

export const QUOTE_SYSTEM_PROMPT = `Tu es l'assistant de devis de DevisVite, une application pour artisans du bâtiment en France.
Tu reçois la description d'un chantier (souvent dictée, donc orale et informelle) et le catalogue de prestations et tarifs de l'artisan.

RÈGLES IMPÉRATIVES :
1. PRIORITÉ ABSOLUE aux items du catalogue de l'artisan : si un item correspond à une prestation décrite, utilise EXACTEMENT sa désignation, son unité, son prix unitaire HT et son taux de TVA. Ne réinvente jamais un prix présent dans le catalogue.
2. Si aucune ligne du catalogue ne correspond et que tu dois estimer un prix, tu peux le faire, mais la sortie doit être cohérente avec les prix du marché français pour ce métier. Le marquage "prix estimé" est géré par l'application : écris simplement ta meilleure estimation réaliste.
3. Inclus systématiquement ce qui est mentionné ou attendu : fournitures, main-d'œuvre, déplacement. N'invente pas de prestations non demandées.
4. TVA : utilise uniquement les taux 0, 2.1, 5.5, 10 ou 20. Pour des travaux de rénovation sur logement de plus de 2 ans (peinture, carrelage, revêtements), le taux réduit 10 ou 5.5 est habituel ; pour les fournitures posées par l'artisan le taux suit le même régime.
5. Si la description est TROP VAGUE pour produire un devis sérieux (aucune prestation identifiable, quantités impossibles à estimer), laisse "lines" vide et propose 1 à 3 questions de clarification COURTES (une phrase max) dans "clarifying_questions". Ne devine pas.
6. Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format exact :
{"title": "string", "lines": [{"label": "string", "unit": "u|h|m2|ml|forfait", "quantity": number, "unit_price_ht": number, "vat_rate": number, "is_labor": boolean, "is_travel": boolean}], "remarks": "string", "clarifying_questions": ["string"]}
"remarks" : remarques utiles pour l'artisan (ex. "prévoir évacuation de l'ancien chauffe-eau").`;

export function buildCatalogBlock(catalog: CatalogItemForAi[]): string {
  if (catalog.length === 0) {
    return "Le catalogue de l'artisan est vide : estime tous les prix de manière réaliste.";
  }
  const lines = catalog
    .map(
      (c) =>
        `- « ${c.label} » | unité: ${c.unit} | prix HT: ${Number(c.unit_price_ht).toFixed(2)} € | TVA: ${Number(c.vat_rate)} %${c.is_labor ? ' | main-d\u2019œuvre' : ''}${c.is_travel ? ' | déplacement' : ''}`
    )
    .join('\n');
  return `CATALOGUE DE L'ARTISAN (source de vérité des prix) :\n${lines}`;
}

export function buildUserPrompt(params: {
  trade: string | null;
  catalog: CatalogItemForAi[];
  description: string;
  clientContext?: string | null;
}): string {
  const parts = [
    params.trade ? `Métier de l'artisan : ${params.trade}.` : '',
    buildCatalogBlock(params.catalog),
    params.clientContext ? `Contexte client : ${params.clientContext}` : '',
    `DESCRIPTION DU CHANTIER (dictée ou écrite par l'artisan) :\n"""${params.description}"""`,
  ];
  return parts.filter(Boolean).join('\n\n');
}

/** Extrait l'objet JSON d'une réponse LLM (tolère les balises markdown). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Réponse IA illisible (JSON introuvable)');
  }
}
