-- 0005 — Abonnement (Stripe).
-- Le statut d'abonnement est dans une table À PART, en lecture seule pour l'utilisateur :
-- seules les écritures du serveur (clé « service role », webhook Stripe) peuvent la modifier.
-- (Les règles de la table companies permettent à l'utilisateur de modifier toutes ses colonnes :
--  y mettre le statut d'abonnement lui permettrait de s'offrir un abonnement.)

create table if not exists public.subscriptions (
  company_id uuid primary key references public.companies(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  -- none | incomplete | incomplete_expired | trialing | active | past_due | canceled | unpaid | paused
  status text not null default 'none',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Compte offert (accès gratuit accordé à la main, ex. testeurs) : modifiable uniquement en SQL.
  comped boolean not null default false,
  -- Horodatage (secondes Stripe) du dernier événement appliqué : ignore les événements en retard.
  last_event_at bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select on public.subscriptions
  for select to authenticated
  using (public.is_company_member(company_id));
-- Aucune policy insert/update/delete : seul le rôle serveur (service_role, qui contourne la RLS) écrit.

-- Journal des événements Stripe déjà traités (idempotence : Stripe peut renvoyer un événement).
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- Aucune policy : table inaccessible aux utilisateurs, réservée au serveur.
