import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { subscriptionToFields, verifyStripeSignature } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, any> };
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Webhook non configuré' }, { status: 503 });
  }

  // Corps brut indispensable : la signature porte sur le texte exact reçu.
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotence : Stripe peut renvoyer le même événement.
  const { error: dupe } = await admin.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dupe) {
    if (dupe.code === '23505') return NextResponse.json({ received: true, duplicate: true });
    console.error('[stripe webhook] stripe_events', dupe.message);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }

  try {
    const obj = event.data.object;

    if (event.type === 'checkout.session.completed') {
      const companyId: string | undefined = obj.client_reference_id ?? obj.metadata?.company_id;
      if (companyId && obj.customer && obj.subscription) {
        // Rattache client Stripe ⇄ entreprise ; le statut réel arrive via customer.subscription.*
        const { error } = await admin.from('subscriptions').upsert(
          {
            company_id: companyId,
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.subscription,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'company_id' }
        );
        if (error) throw error;
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      const companyId: string | undefined = obj.metadata?.company_id;
      let target = companyId;
      if (!target) {
        const { data } = await admin
          .from('subscriptions')
          .select('company_id')
          .eq('stripe_customer_id', typeof obj.customer === 'string' ? obj.customer : obj.customer?.id)
          .maybeSingle();
        target = data?.company_id;
      }
      if (target) {
        const { data: existing } = await admin
          .from('subscriptions')
          .select('last_event_at')
          .eq('company_id', target)
          .maybeSingle();
        // Ignore un événement plus ancien que le dernier appliqué (ordre non garanti).
        if (!existing || Number(existing.last_event_at) <= event.created) {
          const { error } = await admin.from('subscriptions').upsert(
            {
              company_id: target,
              ...subscriptionToFields(obj as any),
              last_event_at: event.created,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'company_id' }
          );
          if (error) throw error;
        }
      }
    }
    // invoice.payment_failed : Stripe bascule l'abonnement en past_due → événement subscription.updated.
  } catch (e) {
    console.error('[stripe webhook]', event.type, e);
    // On libère l'identifiant pour que Stripe puisse réessayer.
    await admin.from('stripe_events').delete().eq('id', event.id);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
