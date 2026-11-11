import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canDownloadQuotes } from '@/lib/billing';
import { loadInvoice } from '@/lib/invoices-server';
import { buildFacturXml } from '@/lib/facturx/xml';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });

  const loaded = await loadInvoice(id);
  if (!loaded) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
  if (!(await canDownloadQuotes(String(loaded.row.company_id)))) {
    return NextResponse.json({ error: 'Abonnement requis', subscribe: '/abonnement' }, { status: 402 });
  }

  return new NextResponse(buildFacturXml(loaded.doc), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${loaded.doc.reference}.xml"`,
    },
  });
}
