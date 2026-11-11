import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { canDownloadQuotes } from '@/lib/billing';
import { loadInvoice } from '@/lib/invoices-server';
import { FacturePdf } from '@/lib/pdf/facture-pdf';
import { registerInvoiceFonts } from '@/lib/pdf/fonts';
import { buildFacturXml } from '@/lib/facturx/xml';
import { embedFacturX } from '@/lib/facturx/embed';

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

  // Même règle que les devis : téléchargement réservé aux abonnés (contrôle côté serveur)
  if (!(await canDownloadQuotes(String(loaded.row.company_id)))) {
    return NextResponse.json({ error: 'Abonnement requis pour télécharger la facture', subscribe: '/abonnement' }, { status: 402 });
  }

  const { doc } = loaded;
  let family = registerInvoiceFonts();
  let pdf: Uint8Array;
  try {
    pdf = new Uint8Array(await renderToBuffer(<FacturePdf doc={doc} family={family} />));
  } catch (e) {
    if (family === 'Helvetica') throw e;
    console.error('[facture-pdf] polices intégrées indisponibles, repli sur Helvetica', e);
    family = 'Helvetica';
    pdf = new Uint8Array(await renderToBuffer(<FacturePdf doc={doc} family="Helvetica" />));
  }

  let facturx = 'oui';
  try {
    pdf = embedFacturX(pdf, {
      xml: buildFacturXml(doc),
      title: `${doc.kind === 'credit_note' ? 'Avoir' : 'Facture'} ${doc.reference}`,
      author: doc.seller.name,
      created: new Date(String(loaded.row.created_at)),
      documentType: doc.kind === 'credit_note' ? 'CREDITNOTE' : 'INVOICE',
    });
  } catch (e) {
    // On préfère livrer un PDF lisible (le XML reste téléchargeable à part) plutôt qu'une erreur.
    console.error('[facture-pdf] intégration Factur-X impossible', e);
    facturx = 'non';
  }

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${doc.reference}.pdf"`,
      'X-Facturx': facturx,
      'X-Pdf-Fonts': family,
    },
  });
}
