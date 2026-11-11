-- Facturation électronique : factures, avoirs, numérotation continue.
-- Une facture émise est figée (copie des données vendeur/acheteur) : seules les infos de paiement
-- peuvent changer. Pour corriger une facture, on émet un avoir.

alter table public.companies add column if not exists vat_number text;
alter table public.companies add column if not exists vat_on_debits boolean not null default false;

-- Compteurs : une série continue par entreprise, par année et par type (FAC / AV).
create table public.invoice_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  year integer not null,
  kind text not null check (kind in ('invoice', 'credit_note')),
  last_number integer not null default 0,
  primary key (company_id, year, kind)
);
alter table public.invoice_counters enable row level security; -- aucune policy : seule la fonction ci-dessous y touche

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid references public.quotes(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  kind text not null default 'invoice' check (kind in ('invoice', 'credit_note')),
  credits_invoice_id uuid references public.invoices(id) on delete set null,
  credits_reference text,
  reference text not null,
  year integer not null,
  number integer not null,
  status text not null default 'issued' check (status in ('issued', 'paid')),
  issue_date date not null,
  service_date date not null,
  due_date date not null,
  operation_category text not null default 'services' check (operation_category in ('services', 'goods', 'mixed')),
  title text,
  -- Vendeur (copie figée)
  seller_name text not null,
  seller_legal_form text,
  seller_siret text not null,
  seller_vat_number text,
  seller_vat_exemption boolean not null default false,
  seller_vat_on_debits boolean not null default false,
  seller_address text not null,
  seller_email text,
  seller_phone text,
  seller_iban text,
  -- Acheteur (copie figée)
  buyer_name text not null,
  buyer_is_company boolean not null default false,
  buyer_siren text,
  buyer_address text not null,
  buyer_email text,
  delivery_address text,
  -- Conditions
  payment_terms text,
  late_penalty_text text,
  -- Montants (centimes)
  global_discount_cents integer not null default 0,
  deposit_cents integer not null default 0,
  total_ht_cents integer not null,
  total_vat_cents integer not null,
  total_ttc_cents integer not null,
  amount_due_cents integer not null,
  -- Paiement
  paid_at timestamptz,
  payment_method text,
  created_at timestamptz not null default now(),
  unique (company_id, kind, year, number)
);
create unique index invoices_one_invoice_per_quote on public.invoices (quote_id) where quote_id is not null and kind = 'invoice';
create unique index invoices_one_credit_per_invoice on public.invoices (credits_invoice_id) where credits_invoice_id is not null and kind = 'credit_note';
create index invoices_company_idx on public.invoices (company_id, issue_date desc);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null default 0,
  label text not null,
  unit text not null default 'u' check (unit in ('u', 'h', 'm2', 'ml', 'forfait')),
  quantity numeric(10,2) not null default 1,
  unit_price_ht numeric(10,2) not null,
  vat_rate numeric(5,3) not null check (vat_rate in (0, 2.1, 5.5, 10, 20)),
  discount numeric(5,2) not null default 0
);

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;

create policy "invoices_owner_select" on public.invoices
  for select using (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()));
create policy "invoices_owner_update" on public.invoices
  for update using (company_id in (select c.id from public.companies c where c.owner_id = auth.uid()));
create policy "invoice_lines_owner_select" on public.invoice_lines
  for select using (invoice_id in (
    select i.id from public.invoices i
    join public.companies c on c.id = i.company_id
    where c.owner_id = auth.uid()));
-- Pas de policy INSERT / DELETE : création uniquement par create_invoice_document().

-- Une facture émise ne se modifie plus : seul le suivi du paiement peut changer.
create or replace function public.invoices_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - array['status', 'paid_at', 'payment_method'])
     is distinct from (to_jsonb(old) - array['status', 'paid_at', 'payment_method']) then
    raise exception 'Une facture émise ne peut plus être modifiée : émettez un avoir.';
  end if;
  return new;
end $$;
create trigger invoices_guard_trg before update on public.invoices
  for each row execute function public.invoices_guard();

-- Création atomique : numéro continu + facture + lignes dans la même transaction
-- (si quoi que ce soit échoue, le compteur revient en arrière : jamais de trou).
create or replace function public.create_invoice_document(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := (p->>'company_id')::uuid;
  v_kind text := coalesce(p->>'kind', 'invoice');
  v_issue date := (p->>'issue_date')::date;
  v_year integer := extract(year from (p->>'issue_date')::date)::integer;
  v_number integer;
  v_prefix text;
  v_id uuid := gen_random_uuid();
begin
  if auth.uid() is null
     or not exists (select 1 from companies where id = v_company and owner_id = auth.uid()) then
    raise exception 'Accès refusé';
  end if;
  if v_kind not in ('invoice', 'credit_note') then raise exception 'Type de document invalide'; end if;

  insert into invoice_counters (company_id, year, kind, last_number)
    values (v_company, v_year, v_kind, 1)
    on conflict (company_id, year, kind) do update set last_number = invoice_counters.last_number + 1
    returning last_number into v_number;

  v_prefix := case when v_kind = 'credit_note' then 'AV' else 'FAC' end;

  insert into invoices (
    id, company_id, quote_id, client_id, kind, credits_invoice_id, credits_reference,
    reference, year, number, issue_date, service_date, due_date, operation_category, title,
    seller_name, seller_legal_form, seller_siret, seller_vat_number, seller_vat_exemption,
    seller_vat_on_debits, seller_address, seller_email, seller_phone, seller_iban,
    buyer_name, buyer_is_company, buyer_siren, buyer_address, buyer_email, delivery_address,
    payment_terms, late_penalty_text,
    global_discount_cents, deposit_cents, total_ht_cents, total_vat_cents, total_ttc_cents, amount_due_cents
  ) values (
    v_id, v_company, nullif(p->>'quote_id', '')::uuid, nullif(p->>'client_id', '')::uuid, v_kind,
    nullif(p->>'credits_invoice_id', '')::uuid, nullif(p->>'credits_reference', ''),
    v_prefix || '-' || v_year || '-' || lpad(v_number::text, 4, '0'), v_year, v_number,
    v_issue, (p->>'service_date')::date, (p->>'due_date')::date,
    coalesce(p->>'operation_category', 'services'), nullif(p->>'title', ''),
    p->>'seller_name', nullif(p->>'seller_legal_form', ''), p->>'seller_siret',
    nullif(p->>'seller_vat_number', ''), coalesce((p->>'seller_vat_exemption')::boolean, false),
    coalesce((p->>'seller_vat_on_debits')::boolean, false), p->>'seller_address',
    nullif(p->>'seller_email', ''), nullif(p->>'seller_phone', ''), nullif(p->>'seller_iban', ''),
    p->>'buyer_name', coalesce((p->>'buyer_is_company')::boolean, false), nullif(p->>'buyer_siren', ''),
    p->>'buyer_address', nullif(p->>'buyer_email', ''), nullif(p->>'delivery_address', ''),
    nullif(p->>'payment_terms', ''), nullif(p->>'late_penalty_text', ''),
    coalesce((p->>'global_discount_cents')::integer, 0), coalesce((p->>'deposit_cents')::integer, 0),
    (p->>'total_ht_cents')::integer, (p->>'total_vat_cents')::integer,
    (p->>'total_ttc_cents')::integer, (p->>'amount_due_cents')::integer
  );

  insert into invoice_lines (invoice_id, position, label, unit, quantity, unit_price_ht, vat_rate, discount)
  select v_id, (t.ord - 1)::integer, t.l->>'label', t.l->>'unit', (t.l->>'quantity')::numeric,
         (t.l->>'unit_price_ht')::numeric, (t.l->>'vat_rate')::numeric, coalesce((t.l->>'discount')::numeric, 0)
  from jsonb_array_elements(p->'lines') with ordinality as t(l, ord);

  return v_id;
end $$;

revoke all on function public.create_invoice_document(jsonb) from public, anon;
grant execute on function public.create_invoice_document(jsonb) to authenticated;
