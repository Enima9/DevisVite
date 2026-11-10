/**
 * Utilitaires Stripe SANS dépendance (fetch + crypto natifs) :
 * vérification de signature du webhook, conversion d'un abonnement Stripe, appels REST.
 * Fonctions pures autant que possible, pour pouvoir les tester.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

// ---------- Vérification de la signature du webhook ----------

/** Fenêtre de tolérance contre le rejeu d'un événement capturé : 5 minutes (valeur par défaut Stripe). */
const TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim());
  const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const t = Number(timestamp);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  return signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, 'utf8');
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}

// ---------- Statut d'abonnement ----------

export interface SubscriptionRow {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  comped: boolean;
}

/** Accès au téléchargement : abonnement actif ou en essai, ou compte offert. */
export function isEntitled(sub: Pick<SubscriptionRow, 'status' | 'comped'> | null | undefined): boolean {
  if (!sub) return false;
  return sub.comped || sub.status === 'active' || sub.status === 'trialing';
}

interface StripeSubscriptionLike {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  items?: { data?: { current_period_end?: number }[] };
  metadata?: Record<string, string>;
}

/** Convertit un objet Subscription de Stripe en champs de notre table. */
export function subscriptionToFields(sub: StripeSubscriptionLike) {
  // Selon la version d'API Stripe, la fin de période est sur l'abonnement ou sur ses lignes.
  const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
  return {
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  };
}

// ---------- Appels à l'API REST de Stripe ----------

/** Encode un objet imbriqué au format attendu par Stripe : a[b][0][c]=valeur. */
export function encodeStripeParams(params: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (v !== null && typeof v === 'object') out.push(...encodeStripeParams(v as Record<string, unknown>, `${name}[${i}]`));
        else out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(v))}`);
      });
    } else if (typeof value === 'object') {
      out.push(...encodeStripeParams(value as Record<string, unknown>, name));
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return out;
}

export class StripeError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'StripeError';
    this.status = status;
  }
}

export async function stripeRequest<T = Record<string, unknown>>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError(0, 'STRIPE_SECRET_KEY manquante');

  const body = encodeStripeParams(params).join('&');
  const url = `https://api.stripe.com/v1${path}${method === 'GET' && body ? `?${body}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' ? body : undefined,
  }).catch((err: unknown) => {
    throw new StripeError(0, `Appel à Stripe impossible : ${err instanceof Error ? err.message : String(err)}`);
  });

  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!res.ok) throw new StripeError(res.status, data.error?.message ?? `Erreur Stripe (${res.status})`);
  return data;
}
