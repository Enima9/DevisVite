import { createClient } from '@/lib/supabase/server';
import { dbLineToInput, rowToDoc, type InvoiceDoc } from '@/lib/invoices';

export interface LoadedInvoice {
  row: Record<string, any>;
  doc: InvoiceDoc;
}

/** Charge une facture (ou un avoir) de l'utilisateur connecté. La RLS garantit qu'il ne voit que les siens. */
export async function loadInvoice(id: string): Promise<LoadedInvoice | null> {
  const supabase = await createClient();
  const { data: row } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
  if (!row) return null;
  const { data: lines } = await supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('position');
  let creditedIssue: string | null = null;
  if (row.credits_invoice_id) {
    const { data: original } = await supabase.from('invoices').select('issue_date').eq('id', row.credits_invoice_id).maybeSingle();
    creditedIssue = original?.issue_date ?? null;
  }
  return { row, doc: rowToDoc(row, (lines ?? []).map(dbLineToInput), creditedIssue) };
}
