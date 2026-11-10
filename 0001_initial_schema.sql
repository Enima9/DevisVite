-- =============================================================
-- DevisVite — Phase 1 : schéma complet + RLS
-- À exécuter dans l'éditeur SQL de Supabase (région UE)
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type quote_status as enum ('draft', 'sent', 'viewed', 'accepted', 'refused', 'expired');
create type followup_status as enum ('active', 'paused', 'stopped');
create type event_type as enum ('created', 'sent', 'opened', 'viewed', 'followup', 'accepted', 'refused', 'expired', 'signed', 'manual_status');

-- ---------- COMPANY ----------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  legal_form text,
  siret text,
  address text,
  phone text,
  email text,
  logo_url text,
  primary_color text default '#1d4ed8',
  iban text,
  insurance_provider text,
  insurance_policy_number text,
  default_vat_rate numeric(5,3) not null default 20.00,
  vat_exemption boolean not null default false, -- micro-entrepreneur : TVA non applicable
  payment_terms text default 'Paiement à 30 jours après réception de facture.',
  quote_validity_days integer not null default 30,
  trade text, -- métier : plombier, électricien…
  ai_spend_cents_month integer not null default 0,
  ai_spend_month date not null default date_trunc('month', now())::date,
  ai_budget_cents_month integer not null default 500, -- plafond IA par mois
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CATALOG ITEMS ----------
create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null,
  description text,
  unit text not null default 'u' check (unit in ('u', 'h', 'm2', 'ml', 'forfait')),
  unit_price_ht numeric(10,2) not null,
  vat_rate numeric(5,3) not null check (vat_rate in (0, 5.5, 10, 20)),
  category text,
  is_labor boolean not null default false,
  is_travel boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- QUOTE TEMPLATES ----------
create table public.quote_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  intro_text text,
  outro_text text,
  created_at timestamptz not null default now()
);

-- ---------- CLIENTS ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  site_address text,
  created_at timestamptz not null default now()
);

-- ---------- QUOTES ----------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  template_id uuid references public.quote_templates(id) on delete set null,
  reference text not null, -- ex. DEV-2026-001
  status quote_status not null default 'draft',
  title text,
  description text, -- texte dicté / décrit pour l'IA
  global_discount numeric(10,2) not null default 0,
  deposit_amount numeric(10,2) not null default 0,
  intro_text text,
  outro_text text,
  public_token uuid not null default gen_random_uuid(), -- jeton non devinable
  token_expires_at timestamptz not null default now() + interval '90 days',
  valid_until date not null default (now() + interval '30 days')::date,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  refused_at timestamptz,
  refusal_reason text check (refusal_reason in ('too_expensive', 'other_quote', 'postponed', 'other')),
  refusal_comment text,
  manual_accepted boolean not null default false, -- accord par téléphone
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index quotes_public_token_idx on public.quotes(public_token);
create index quotes_company_status_idx on public.quotes(company_id, status);

-- ---------- QUOTE LINES ----------
create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  position integer not null default 0,
  label text not null,
  unit text not null default 'u' check (unit in ('u', 'h', 'm2', 'ml', 'forfait')),
  quantity numeric(10,2) not null default 1,
  unit_price_ht numeric(10,2) not null,
  vat_rate numeric(5,3) not null check (vat_rate in (0, 5.5, 10, 20)),
  discount numeric(5,2) not null default 0, -- remise % par ligne
  price_is_estimated boolean not null default false, -- "Prix estimé, à vérifier"
  source text not null default 'manual' check (source in ('catalog', 'ai', 'manual'))
);

-- ---------- QUOTE EVENTS (historique) ----------
create table public.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type event_type not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index quote_events_quote_idx on public.quote_events(quote_id, created_at);

-- ---------- FOLLOWUP SEQUENCES ----------
create table public.followup_sequences (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  status followup_status not null default 'active',
  days_offset_1 integer not null default 3,
  days_offset_2 integer not null default 7,
  days_offset_3 integer not null default 14,
  validate_before_send boolean not null default false, -- "Je valide chaque relance"
  created_at timestamptz not null default now()
);

-- ---------- FOLLOWUP MESSAGES ----------
create table public.followup_messages (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.followup_sequences(id) on delete cascade,
  step integer not null check (step in (1, 2, 3)),
  scheduled_at date not null,
  sent_at timestamptz,
  cancelled boolean not null default false,
  message_body text,
  ai_generated boolean not null default true,
  unique (sequence_id, step)
);

-- ---------- SIGNATURES ----------
create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  signed_by_name text not null,
  drawn_signature text, -- dataURL du dessin
  typed_name boolean not null default false,
  accepted_checkbox boolean not null default false check (accepted_checkbox = true), -- "Bon pour accord" obligatoire
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  document_hash text not null -- empreinte SHA-256 du PDF signé
);

-- ---------- EMAIL LOGS ----------
create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  kind text not null check (kind in ('quote_sent', 'followup', 'accepted_artisan', 'signed_pdf')),
  to_email text not null,
  resend_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'bounced')),
  error_message text,
  created_at timestamptz not null default now()
);

-- =============================================================
-- ROW LEVEL SECURITY — chaque artisan ne voit que ses données
-- =============================================================
alter table public.companies enable row level security;
alter table public.catalog_items enable row level security;
alter table public.quote_templates enable row level security;
alter table public.clients enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.quote_events enable row level security;
alter table public.followup_sequences enable row level security;
alter table public.followup_messages enable row level security;
alter table public.signatures enable row level security;
alter table public.email_logs enable row level security;

-- companies : l'utilisateur ne gère que SON entreprise
create policy "company_owner_all" on public.companies
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Toutes les autres tables : accès via company_id appartenant à auth.uid()
create policy "items_owner_all" on public.catalog_items
  for all using (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()))
  with check (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()));

create policy "templates_owner_all" on public.quote_templates
  for all using (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()))
  with check (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()));

create policy "clients_owner_all" on public.clients
  for all using (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()))
  with check (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()));

create policy "quotes_owner_all" on public.quotes
  for all using (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()))
  with check (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()));

create policy "quote_lines_owner_all" on public.quote_lines
  for all using (
    quote_id in (
      select q.id from public.quotes q
      join public.companies c on c.id = q.company_id
      where c.owner_id = auth.uid()
    )
  )
  with check (
    quote_id in (
      select q.id from public.quotes q
      join public.companies c on c.id = q.company_id
      where c.owner_id = auth.uid()
    )
  );

create policy "quote_events_owner_all" on public.quote_events
  for all using (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()))
  with check (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()));

create policy "seq_owner_all" on public.followup_sequences
  for all using (
    quote_id in (
      select q.id from public.quotes q
      join public.companies c on c.id = q.company_id
      where c.owner_id = auth.uid()
    )
  )
  with check (
    quote_id in (
      select q.id from public.quotes q
      join public.companies c on c.id = q.company_id
      where c.owner_id = auth.uid()
    )
  );

create policy "fmsg_owner_all" on public.followup_messages
  for all using (
    sequence_id in (
      select s.id from public.followup_sequences s
      join public.quotes q on q.id = s.quote_id
      join public.companies c on c.id = q.company_id
      where c.owner_id = auth.uid()
    )
  )
  with check (
    sequence_id in (
      select s.id from public.followup_sequences s
      join public.quotes q on q.id = s.quote_id
      join public.companies c on c.id = q.company_id
      where c.owner_id = auth.uid()
    )
  );

create policy "sig_owner_all" on public.signatures
  for all using (
    quote_id in (
      select q.id from public.quotes q
      join public.companies c on c.id = q.company_id
      where c.owner_id = auth.uid()
    )
  )
  with check (
    quote_id in (
      select q.id from public.quotes q
      join public.companies c on c.id = q.company_id
      where c.owner_id = auth.uid()
    )
  );

create policy "email_logs_owner_all" on public.email_logs
  for all using (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()))
  with check (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()));

-- =============================================================
-- Accès PUBLIC au devis : uniquement via fonction security definer
-- (le rôle anon ne peut JAMAIS lire les tables directement)
-- =============================================================
create or replace function public.get_public_quote(p_token uuid)
returns table (
  quote_id uuid, reference text, title text, status quote_status,
  valid_until date, intro_text text, outro_text text,
  company_name text, company_address text, company_phone text,
  company_email text, company_siret text, company_logo_url text, company_primary_color text,
  company_vat_exemption boolean, company_insurance_provider text, company_insurance_policy text,
  company_payment_terms text,
  client_name text, client_site_address text
)
language sql security definer set search_path = public stable
as $$
  select q.id, q.reference, q.title, q.status, q.valid_until, q.intro_text, q.outro_text,
         co.name, co.address, co.phone, co.email, co.siret, co.logo_url, co.primary_color,
         co.vat_exemption, co.insurance_provider, co.insurance_policy_number,
         co.payment_terms,
         cl.name, cl.site_address
  from public.quotes q
  join public.companies co on co.id = q.company_id
  join public.clients cl on cl.id = q.client_id
  where q.public_token = p_token
    and q.token_expires_at > now()
    and q.status <> 'draft';
$$;

create or replace function public.get_public_quote_lines(p_token uuid)
returns table (line_position integer, label text, unit text, quantity numeric,
               unit_price_ht numeric, vat_rate numeric, discount numeric, price_is_estimated boolean)
language sql security definer set search_path = public stable
as $$
  select l.position as line_position, l.label, l.unit, l.quantity, l.unit_price_ht, l.vat_rate, l.discount, l.price_is_estimated
  from public.quote_lines l
  join public.quotes q on q.id = l.quote_id
  where q.public_token = p_token
    and q.token_expires_at > now()
    and q.status <> 'draft'
  order by l.position;
$$;

-- Enregistrement de la signature par le client public (token requis)
create or replace function public.save_public_signature(
  p_token uuid,
  p_signed_by_name text,
  p_drawn_signature text,
  p_typed_name boolean,
  p_ip inet,
  p_user_agent text,
  p_document_hash text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_quote_id uuid; v_sig_id uuid;
begin
  select id into v_quote_id from public.quotes
  where public_token = p_token and token_expires_at > now() and status = 'viewed';
  if v_quote_id is null then
    raise exception 'Devis introuvable, expiré ou non consultable';
  end if;
  insert into public.signatures (quote_id, signed_by_name, drawn_signature, typed_name,
                                 accepted_checkbox, ip_address, user_agent, document_hash)
  values (v_quote_id, p_signed_by_name, p_drawn_signature, p_typed_name, true, p_ip, p_user_agent, p_document_hash)
  returning id into v_sig_id;
  update public.quotes set status = 'accepted', accepted_at = now() where id = v_quote_id;
  insert into public.quote_events (quote_id, company_id, event_type, metadata)
  select v_quote_id, company_id, 'signed', jsonb_build_object('signed_by', p_signed_by_name)
  from public.quotes where id = v_quote_id;
  return v_sig_id;
end;
$$;

-- Enregistrement du refus par le client public (motif : trop cher, autre devis, report, autre)
create or replace function public.set_public_quote_refused(
  p_token uuid, p_reason text, p_comment text default null
) returns void
language sql security definer set search_path = public as $$
  update public.quotes
  set status = 'refused', refused_at = now(), refusal_reason = p_reason, refusal_comment = p_comment
  where public_token = p_token and token_expires_at > now() and status in ('sent', 'viewed');
$$;

create or replace function public.mark_public_quote_viewed(p_token uuid) returns void
language sql security definer set search_path = public as $$
  update public.quotes set status = 'viewed', viewed_at = now()
  where public_token = p_token and token_expires_at > now() and status = 'sent';
$$;


-- =============================================================
-- STORAGE — bucket logos (public en lecture, écriture owner)
-- =============================================================
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict do nothing;

create policy "logos_read_public" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos_insert_owner" on storage.objects
  for insert with check (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_update_owner" on storage.objects
  for update using (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
  );
