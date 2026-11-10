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

/** Coût estimé en CENTIMES d'euro : input 3 $/MTok, output 15 $/MTok (Claude Sonnet). */
export function estimateCostCents(usage: AiUsage): number {
  const usd =
    (usage.input_tokens * 3 + usage.output_tokens * 15) / 1_000_000;
  return Math.ceil(usd * 100); // $ → € ≈ 1:1 (estimation volontairement majorée)
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
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

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

/** Incrémente la dépense IA du mois (remise à zéro au changement de mois). */
export async function recordAiSpend(companyId: string, costCents: number): Promise<void> {
  const supabase = await createClient();
  const monthStart = new Date().toISOString().slice(0, 10);

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
