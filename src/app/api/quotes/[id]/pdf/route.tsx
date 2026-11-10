import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { DevisPdf, type DevisPdfData } from '@/lib/pdf/devis-pdf';
import type { LineInput, VatRate } from '@/lib/money';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  // RLS garantit que l'artisan ne lit que SES devis
  const { data: quote } = await supabase
    .from('quotes')
    .select('*, client:clients(*)')
    .eq('id', id)
    .maybeSingle();
  if (!quote) return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });

  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', quote.company_id)
    .single();

  const { data: lines } = await supabase
    .from('quote_lines')
    .select('*')
    .eq('quote_id', id)
    .order('position');

  const pdfLines: LineInput[] = (lines ?? []).map((l) => ({
    label: l.label,
    unit: l.unit,
    quantity: Number(l.quantity),
    unit_price_ht: Number(l.unit_price_ht),
    vat_rate: Number(l.vat_rate) as VatRate,
    discount: Number(l.discount),
  }));

  if (!company) return NextResponse.json({ error: 'Entreprise introuvable' }, { status: 404 });

  const data: DevisPdfData = {
    company,
    quote: {
      reference: quote.reference,
      title: quote.title,
      valid_until: quote.valid_until,
      execution_delay: quote.execution_delay,
      created_at: quote.created_at,
      global_discount: Number(quote.global_discount ?? 0),
    },
    client: {
      name: quote.client?.name ?? 'Client',
      site_address: quote.client?.site_address ?? null,
    },
    lines: pdfLines,
    intro_text: quote.intro_text,
  };

  const buffer = await renderToBuffer(<DevisPdf data={data} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${quote.reference}.pdf"`,
    },
  });
}
