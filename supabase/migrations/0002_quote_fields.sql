-- =============================================================
-- DevisVite — Phase 2 : champs devis + modèles avec lignes
-- =============================================================

-- Délai / date d'exécution (mention obligatoire devis travaux)
alter table public.quotes add column if not exists execution_delay text;

-- Référence unique par entreprise
create unique index if not exists quotes_company_reference_idx
  on public.quotes(company_id, reference);

-- Ajout du taux 2,1 % (TVA particulière) aux contraintes existantes
alter table public.catalog_items drop constraint if exists catalog_items_vat_rate_check;
alter table public.catalog_items add constraint catalog_items_vat_rate_check
  check (vat_rate in (0, 2.1, 5.5, 10, 20));
alter table public.quote_lines drop constraint if exists quote_lines_vat_rate_check;
alter table public.quote_lines add constraint quote_lines_vat_rate_check
  check (vat_rate in (0, 2.1, 5.5, 10, 20));

-- Lignes des modèles de devis réutilisables
create table if not exists public.quote_template_lines (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quote_templates(id) on delete cascade,
  position integer not null default 0,
  label text not null,
  unit text not null default 'u' check (unit in ('u', 'h', 'm2', 'ml', 'forfait')),
  quantity numeric(10,2) not null default 1,
  unit_price_ht numeric(10,2) not null,
  vat_rate numeric(5,3) not null default 20 check (vat_rate in (0, 2.1, 5.5, 10, 20)),
  discount numeric(5,2) not null default 0
);

alter table public.quote_template_lines enable row level security;

create policy "template_lines_owner_all" on public.quote_template_lines
  for all using (
    template_id in (
      select t.id from public.quote_templates t
      join public.companies c on c.id = t.company_id
      where c.owner_id = auth.uid()
    )
  )
  with check (
    template_id in (
      select t.id from public.quote_templates t
      join public.companies c on c.id = t.company_id
      where c.owner_id = auth.uid()
    )
  );
