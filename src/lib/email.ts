/**
 * Envoi d'emails via Resend (API REST, sans dépendance).
 * Actif seulement si RESEND_API_KEY et EMAIL_FROM sont définies dans Vercel.
 * EMAIL_FROM doit utiliser un domaine vérifié chez Resend, ex. : « DevisVite <devis@votredomaine.fr> ».
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  fromName?: string;
}): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: 'Envoi d’emails non configuré' };

  // « Nom de l'artisan via DevisVite <adresse>» : on garde l'adresse technique de EMAIL_FROM
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  const safeName = (opts.fromName ?? 'DevisVite').replace(/["<>\r\n]/g, '').slice(0, 60);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${safeName} <${address}>`,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message ?? `Erreur d’envoi (${res.status})` };
    return { ok: true, id: data.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}
