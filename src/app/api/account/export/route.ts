import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Droit d'accès et de portabilité : toutes les données de l'utilisateur connecté, en JSON. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  // Les règles de sécurité de la base (RLS) limitent déjà chaque requête aux données du compte.
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle();

  let clients: unknown[] = [];
  let quotes: unknown[] = [];
  let catalog: unknown[] = [];
  let templates: unknown[] = [];
  if (company) {
    const [c, q, i, t] = await Promise.all([
      supabase.from('clients').select('*').eq('company_id', company.id),
      supabase.from('quotes').select('*, quote_lines(*), quote_events(*)').eq('company_id', company.id),
      supabase.from('catalog_items').select('*').eq('company_id', company.id),
      supabase.from('quote_templates').select('*, quote_template_lines(*)').eq('company_id', company.id),
    ]);
    clients = c.data ?? [];
    // Le jeton d'accès public d'un devis est un secret : on ne l'inclut pas dans le fichier.
    quotes = (q.data ?? []).map((row: Record<string, unknown>) => {
      const { public_token: _t, token_expires_at: _e, ...rest } = row;
      return rest;
    });
    catalog = i.data ?? [];
    templates = t.data ?? [];
  }

  const body = {
    exported_at: new Date().toISOString(),
    account: { email: user.email, created_at: user.created_at },
    company,
    clients,
    quotes,
    catalog_items: catalog,
    quote_templates: templates,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="devisvite-export-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
