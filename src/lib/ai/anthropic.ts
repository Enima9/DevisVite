/**
 * Client Anthropic minimal (fetch direct, pas de SDK) + suivi de dépense IA.
 */
import { createClient } from '@/lib/supabase/server';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export interface AiUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AiCallResult {
  text: string;
  usage: AiUsage;
}

const DEFAULT_MODEL = 'claude-sonnet-5-5';

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

/** Prix en $ par million de tokens (entrée, sortie). Tarifs Anthropic au 2026-11-03. */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};
/** Modèle inconnu : estimation volontairement haute, pour que le plafond mensuel reste prudent. */
const FALLBACK_PRICE = { input: 5, output: 25 };

/** Coût estimé en CENTIMES d'euro, d'après le modèle réellement utilisé. */
export function estimateCostCents(usage: AiUsage, model: string = aiModel()): number {
  const price = PRICES[model] ?? FALLBACK_PRICE;
  const usd = (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000;
  return Math.ceil(usd * 100); // $ → € ≈ 1:1, arrondi au centime supérieur
}

/**
 * Réflexion (thinking) coupée : produire un devis en JSON n'en a pas besoin, et les tokens de
 * réflexion sont facturés comme de la sortie et comptent dans max_tokens (risque de JSON tronqué).
 * La syntaxe dépend du modèle ; pour un modèle inconnu on n'envoie rien (comportement par défaut).
 */
function noThinking(model: string): Record<string, unknown> {
  if (model === 'claude-sonnet-5-5') return { thinking: { type: 'between_tools' } }; // sans outil = pas de réflexion
  if (model === 'claude-haiku-5-5') return { thinking: { type: 'disabled' } }; // accepté à l'effort par défaut (medium)
  return {};
}

export type AiFailureKind =
  | 'auth'
  | 'credit'
  | 'model'
  | 'rate_limit'
  | 'overloaded'
  | 'network'
  | 'other';

/** Erreur d'appel à l'API Anthropic, avec une catégorie exploitable par la route. */
export class AiApiError extends Error {
  kind: AiFailureKind;
  status: number;
  constructor(kind: AiFailureKind, status: number, message: string) {
    super(message);
    this.name = 'AiApiError';
    this.kind = kind;
    this.status = status;
  }
}

function classifyAiFailure(status: number, detail: string): AiFailureKind {
  if (/credit balance/i.test(detail)) return 'credit';
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'model';
  if (status === 429) return 'rate_limit';
  if (status === 529 || status >= 500) return 'overloaded';
  return 'other';
}

export async function callClaude(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<AiCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY manquante');
  }
  const model = aiModel();

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: params.maxTokens ?? 2000,
      ...noThinking(model),
      system: params.system,
      messages: [{ role: 'user', content: params.user }],
    }),
  }).catch((err: unknown) => {
    throw new AiApiError(
      'network',
      0,
      `Appel à l’API Anthropic impossible : ${err instanceof Error ? err.message : String(err)}`
    );
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new AiApiError(
      classifyAiFailure(res.status, detail),
      res.status,
      `Erreur API Anthropic (${res.status}) : ${detail.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: AiUsage;
  };

  const text = data.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');

  return { text, usage: data.usage ?? { input_tokens: 0, output_tokens: 0 } };
}

/** Premier jour du mois courant (UTC), au format YYYY-MM-DD, comme la colonne ai_spend_month. */
export function currentMonthStart(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

/** Incrémente la dépense IA du mois (remise à zéro au changement de mois). */
export async function recordAiSpend(companyId: string, costCents: number): Promise<void> {
  const supabase = await createClient();
  const monthStart = currentMonthStart();

  const { data: company } = await supabase
    .from('companies')
    .select('ai_spend_cents_month, ai_spend_month')
    .eq('id', companyId)
    .single();
  if (!company) return;

  const current =
    company.ai_spend_month === monthStart ? Number(company.ai_spend_cents_month) : 0;

  await supabase
    .from('companies')
    .update({
      ai_spend_cents_month: current + costCents,
      ai_spend_month: monthStart,
    })
    .eq('id', companyId);
}
