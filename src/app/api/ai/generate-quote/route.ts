import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { QUOTE_SYSTEM_PROMPT, buildUserPrompt, extractJson } from '@/lib/ai/prompt';
import { aiDraftSchema, mapDraftToEditorLines, type CatalogItemForAi } from '@/lib/ai/schema';
import { AiApiError, callClaude, estimateCostCents, recordAiSpend } from '@/lib/ai/anthropic';
import { checkAiRateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Authentification
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Connectez-vous pour utiliser l\u2019IA.' }, { status: 401 });
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id, trade, ai_spend_cents_month, ai_spend_month, ai_budget_cents_month')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!company) {
    return NextResponse.json({ error: 'Complétez d\u2019abord votre profil entreprise.' }, { status: 400 });
  }

  // 2. Limitation de débit : 20 générations par heure
  const rl = checkAiRateLimit(company.id);
  if (!rl.allowed) {
    const minutes = Math.ceil(rl.retryAfterMs / 60000);
    return NextResponse.json(
      {
        error: `Vous avez atteint la limite de 20 générations par heure. Réessayez dans ${minutes} min.`,
      },
      { status: 429 }
    );
  }

  // 3. Plafond de dépense IA mensuel (remise à zéro au changement de mois)
  const today = new Date().toISOString().slice(0, 10);
  const spendThisMonth =
    company.ai_spend_month === today ? Number(company.ai_spend_cents_month) : 0;
  if (spendThisMonth >= Number(company.ai_budget_cents_month)) {
    return NextResponse.json(
      {
        error:
          'Votre budget IA mensuel est atteint. Vous pouvez toujours créer vos devis manuellement, ou augmenter le plafond dans les réglages.',
      },
      { status: 429 }
    );
  }

  // 4. Description du chantier
  let description: string;
  try {
    const body = (await request.json()) as { description?: unknown };
    description = String(body.description ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  if (description.length < 5) {
    return NextResponse.json(
      { error: 'Décrivez le chantier en quelques mots (ou appuyez sur le micro pour dicter).' },
      { status: 400 }
    );
  }
  if (description.length > 5000) {
    description = description.slice(0, 5000);
  }

  // 5. Catalogue de l'artisan (source de vérité des prix)
  const { data: catalogRows } = await supabase
    .from('catalog_items')
    .select('id, label, unit, unit_price_ht, vat_rate, category, is_labor, is_travel')
    .eq('company_id', company.id);
  const catalog: CatalogItemForAi[] = (catalogRows ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    unit: c.unit,
    unit_price_ht: Number(c.unit_price_ht),
    vat_rate: Number(c.vat_rate),
    category: c.category,
    is_labor: Boolean(c.is_labor),
    is_travel: Boolean(c.is_travel),
  }));

  // 6. Appel IA + validation stricte par Zod
  try {
    const { text, usage } = await callClaude({
      system: QUOTE_SYSTEM_PROMPT,
      user: buildUserPrompt({ trade: company.trade, catalog, description }),
      maxTokens: 2000,
    });

    const raw = extractJson(text);
    const draft = aiDraftSchema.parse(raw);

    // 7. Comptabilisation de la dépense IA
    await recordAiSpend(company.id, estimateCostCents(usage));

    // 8. Marquage catalog / estimé selon la règle impérative
    const lines = mapDraftToEditorLines(draft, catalog);

    return NextResponse.json({
      title: draft.title,
      lines,
      remarks: draft.remarks,
      clarifying_questions: draft.clarifying_questions,
    });
  } catch (err) {
    // Le détail technique va dans les logs Vercel, jamais à l'écran de l'artisan.
    console.error(
      '[generate-quote] échec de la génération IA :',
      err instanceof Error ? `${err.name} — ${err.message}` : err
    );
    const { message, status } = describeAiFailure(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** Message lisible pour l'artisan + code HTTP adapté, selon la nature de l'échec. */
function describeAiFailure(err: unknown): { message: string; status: number } {
  if (err instanceof AiApiError) {
    switch (err.kind) {
      case 'auth':
      case 'credit':
      case 'model':
        return {
          message:
            'Le service IA est momentanément indisponible. Vous pouvez créer votre devis manuellement en attendant.',
          status: 503,
        };
      case 'rate_limit':
      case 'overloaded':
        return {
          message: 'Le service IA est très sollicité en ce moment. Réessayez dans une minute.',
          status: 503,
        };
      case 'network':
        return {
          message: 'Impossible de joindre le service IA. Réessayez dans un instant.',
          status: 502,
        };
      default:
        break;
    }
  }
  const text = err instanceof Error ? err.message : '';
  if (text.includes('ANTHROPIC_API_KEY')) {
    return {
      message: 'L\u2019IA n\u2019est pas configurée sur ce serveur (clé API manquante).',
      status: 503,
    };
  }
  if (err instanceof Error && err.name === 'ZodError') {
    return {
      message: 'L\u2019IA a renvoyé une réponse inattendue. Réessayez en reformulant votre description.',
      status: 502,
    };
  }
  if (text.includes('JSON')) {
    return {
      message: 'L\u2019IA a renvoyé une réponse illisible. Réessayez en reformulant votre description.',
      status: 502,
    };
  }
  return { message: 'La génération a échoué. Réessayez dans un instant.', status: 502 };
}
