-- 0008 — Durcissement sécurité (revue du 2026-11-14).
--  1. create_invoice_document() ne fait plus confiance aux données envoyées par le navigateur :
--     date d'émission imposée, appartenance des identifiants vérifiée, lignes / vendeur / acheteur
--     relus en base, totaux recalculés en base.
--  4. Une facture ne peut passer que de « émise » à « payée » (jamais l'inverse).
--  5. Journal des événements Stripe : marque « traité » distincte de « reçu », pour qu'un événement
--     interrompu (timeout) puisse être retraité au lieu d'être ignoré comme doublon.

-- =====================================================================
-- 1. Calcul des totaux (même règle que src/lib/money.ts → computeQuoteTotals)
-- =====================================================================
-- Arrondi au centime « à la JavaScript » : Math.round arrondit les demis vers +∞,
-- d'où floor(x + 0.5) plutôt que round() (qui arrondit les demis en s'éloignant de zéro).
create or replace function public.document_totals(
  p_lines jsonb,             -- [{quantity, unit_price_ht, vat_rate, discount}, …] dans l'ordre des positions
  p_global_discount numeric, -- remise globale en euros
  p_deposit numeric,         -- acompte en euros
  out global_discount_cents integer,
  out deposit_cents integer,
  out total_ht_cents integer,
  out total_vat_cents integer,
  out total_ttc_cents integer,
  out net_ttc_cents integer
)
language plpgsql immutable set search_path = public as $$
declare
  v_n integer := coalesce(jsonb_array_length(p_lines), 0);
  v_ht numeric[] := '{}';
  v_rate numeric[] := '{}';
  v_raw numeric := 0;
  v_remaining numeric;
  v_line jsonb;
  v_gross numeric;
  v_disc numeric;
  v_share numeric;
  i integer;
begin
  for i in 0 .. v_n - 1 loop
    v_line := p_lines -> i;
    v_gross := floor((v_line->>'quantity')::numeric * (v_line->>'unit_price_ht')::numeric * 100 + 0.5);
    v_disc := floor(v_gross * least(greatest(coalesce((v_line->>'discount')::numeric, 0), 0), 100) / 100 + 0.5);
    v_ht := v_ht || (v_gross - v_disc);
    v_rate := v_rate || (v_line->>'vat_rate')::numeric;
    v_raw := v_raw + (v_gross - v_disc);
  end loop;

  global_discount_cents := least(floor(coalesce(p_global_discount, 0) * 100 + 0.5), v_raw)::integer;

  -- Remise globale répartie au prorata, la dernière ligne prend le reste.
  v_remaining := global_discount_cents;
  for i in 1 .. v_n loop
    v_share := 0;
    if global_discount_cents > 0 and v_raw > 0 then
      if i = v_n then
        v_share := v_remaining;
      else
        v_share := floor(v_ht[i] * global_discount_cents / v_raw + 0.5);
        v_remaining := v_remaining - v_share;
      end if;
    end if;
    v_ht[i] := v_ht[i] - v_share;
  end loop;

  -- TVA agrégée par taux sur les bases HT nettes.
  select coalesce(sum(b.base), 0), coalesce(sum(floor(b.base * b.rate / 100 + 0.5)), 0)
    into total_ht_cents, total_vat_cents
  from (
    select t.rate, sum(t.ht) as base
    from unnest(v_ht, v_rate) as t(ht, rate)
    group by t.rate
  ) b;

  total_ttc_cents := total_ht_cents + total_vat_cents;
  deposit_cents := least(floor(coalesce(p_deposit, 0) * 100 + 0.5), total_ttc_cents)::integer;
  net_ttc_cents := total_ttc_cents - deposit_cents;
end $$;

revoke all on function public.document_totals(jsonb, numeric, numeric) from public, anon, authenticated;

-- =====================================================================
-- 1. Création d'une facture / d'un avoir : tout est relu et vérifié en base
-- =====================================================================
-- Seules les saisies propres à la facture viennent de l'appelant (adresse de facturation,
-- SIREN de l'acheteur, date de prestation, délai de paiement). Le reste est lu dans les tables.
-- Paramètres attendus dans p :
--   facture : kind='invoice', company_id, quote_id, service_date, due_days,
--             buyer_is_company, buyer_siren, buyer_address, late_penalty_text
--   avoir   : kind='credit_note', company_id, credits_invoice_id
create or replace function public.create_invoice_document(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := (p->>'company_id')::uuid;
  v_kind text := coalesce(p->>'kind', 'invoice');
  v_issue date := (now() at time zone 'Europe/Paris')::date;
  v_year integer := extract(year from (now() at time zone 'Europe/Paris'))::integer;
  v_number integer;
  v_prefix text;
  v_id uuid := gen_random_uuid();
  v_co companies%rowtype;
  v_quote quotes%rowtype;
  v_client clients%rowtype;
  v_orig invoices%rowtype;
  v_lines jsonb;
  v_tot record;
  v_siret text;
  v_vat_number text;
  v_service date;
  v_due_days integer;
  v_buyer_is_company boolean;
  v_buyer_siren text;
  v_buyer_address text;
  v_delivery text;
begin
  if auth.uid() is null then raise exception 'Accès refusé'; end if;
  select * into v_co from companies where id = v_company and owner_id = auth.uid();
  if not found then raise exception 'Accès refusé'; end if;
  if v_kind not in ('invoice', 'credit_note') then raise exception 'Type de document invalide'; end if;

  if v_kind = 'invoice' then
    -- Devis : appartient à l'entreprise et est accepté.
    select * into v_quote from quotes
      where id = nullif(p->>'quote_id', '')::uuid and company_id = v_company;
    if not found then raise exception 'Devis introuvable'; end if;
    if v_quote.status::text <> 'accepted' then raise exception 'Seul un devis accepté peut être facturé'; end if;

    select * into v_client from clients where id = v_quote.client_id and company_id = v_company;
    if not found then raise exception 'Client introuvable'; end if;

    -- Mentions obligatoires du vendeur.
    v_siret := regexp_replace(coalesce(v_co.siret, ''), '\s', '', 'g');
    if v_siret !~ '^\d{14}$' then raise exception 'SIRET du vendeur manquant ou invalide'; end if;
    if coalesce(btrim(v_co.address), '') = '' then raise exception 'Adresse du vendeur manquante'; end if;
    v_vat_number := nullif(regexp_replace(coalesce(v_co.vat_number, ''), '\s', '', 'g'), '');
    if not v_co.vat_exemption and v_vat_number is null then
      raise exception 'Numéro de TVA du vendeur manquant';
    end if;

    -- Saisies de l'utilisateur, bornées.
    v_service := coalesce(nullif(p->>'service_date', '')::date, v_issue);
    if v_service < v_issue - interval '10 years' or v_service > v_issue + interval '1 year' then
      raise exception 'Date de prestation invalide';
    end if;
    v_due_days := coalesce(nullif(p->>'due_days', '')::integer, 30);
    if v_due_days < 0 or v_due_days > 60 then raise exception 'Délai de paiement invalide'; end if;
    v_buyer_is_company := coalesce((p->>'buyer_is_company')::boolean, false);
    v_buyer_siren := nullif(regexp_replace(coalesce(p->>'buyer_siren', ''), '\s', '', 'g'), '');
    if v_buyer_is_company and (v_buyer_siren is null or v_buyer_siren !~ '^\d{9}$') then
      raise exception 'SIREN de l''acheteur invalide';
    end if;
    v_buyer_address := btrim(coalesce(p->>'buyer_address', ''));
    if v_buyer_address = '' or char_length(v_buyer_address) > 500 then
      raise exception 'Adresse de facturation invalide';
    end if;
    v_delivery := nullif(btrim(coalesce(v_client.site_address, '')), '');
    if v_delivery = v_buyer_address then v_delivery := null; end if;

    -- Lignes relues depuis le devis (franchise en base : TVA forcée à 0).
    select coalesce(jsonb_agg(jsonb_build_object(
             'label', l.label, 'unit', l.unit, 'quantity', l.quantity, 'unit_price_ht', l.unit_price_ht,
             'vat_rate', case when v_co.vat_exemption then 0 else l.vat_rate end, 'discount', l.discount)
             order by l.position), '[]'::jsonb)
      into v_lines
      from quote_lines l where l.quote_id = v_quote.id;
    if jsonb_array_length(v_lines) = 0 then raise exception 'Le devis ne contient aucune ligne'; end if;

    select * into v_tot from document_totals(v_lines, v_quote.global_discount, v_quote.deposit_amount);
  else
    -- Avoir : annule intégralement une facture de l'entreprise.
    select * into v_orig from invoices
      where id = nullif(p->>'credits_invoice_id', '')::uuid and company_id = v_company and kind = 'invoice';
    if not found then raise exception 'Facture d''origine introuvable'; end if;

    select coalesce(jsonb_agg(jsonb_build_object(
             'label', l.label, 'unit', l.unit, 'quantity', l.quantity, 'unit_price_ht', l.unit_price_ht,
             'vat_rate', l.vat_rate, 'discount', l.discount)
             order by l.position), '[]'::jsonb)
      into v_lines
      from invoice_lines l where l.invoice_id = v_orig.id;

    select * into v_tot from document_totals(v_lines, v_orig.global_discount_cents / 100.0, 0);
  end if;

  -- Une seule facture par devis et un seul avoir par facture : garanti par les index uniques
  -- invoices_one_invoice_per_quote / invoices_one_credit_per_invoice (erreur 23505, compteur annulé).

  insert into invoice_counters (company_id, year, kind, last_number)
    values (v_company, v_year, v_kind, 1)
    on conflict (company_id, year, kind) do update set last_number = invoice_counters.last_number + 1
    returning last_number into v_number;

  v_prefix := case when v_kind = 'credit_note' then 'AV' else 'FAC' end;

  if v_kind = 'invoice' then
    insert into invoices (
      id, company_id, quote_id, client_id, kind, reference, year, number,
      issue_date, service_date, due_date, operation_category, title,
      seller_name, seller_legal_form, seller_siret, seller_vat_number, seller_vat_exemption,
      seller_vat_on_debits, seller_address, seller_email, seller_phone, seller_iban,
      buyer_name, buyer_is_company, buyer_siren, buyer_address, buyer_email, delivery_address,
      payment_terms, late_penalty_text,
      global_discount_cents, deposit_cents, total_ht_cents, total_vat_cents, total_ttc_cents, amount_due_cents
    ) values (
      v_id, v_company, v_quote.id, v_client.id, 'invoice',
      v_prefix || '-' || v_year || '-' || lpad(v_number::text, 4, '0'), v_year, v_number,
      v_issue, v_service, v_issue + v_due_days, 'services', nullif(v_quote.title, ''),
      v_co.name, nullif(v_co.legal_form, ''), v_siret,
      case when v_co.vat_exemption then null else v_vat_number end, v_co.vat_exemption,
      coalesce(v_co.vat_on_debits, false), v_co.address,
      nullif(v_co.email, ''), nullif(v_co.phone, ''), nullif(v_co.iban, ''),
      v_client.name, v_buyer_is_company, case when v_buyer_is_company then v_buyer_siren end,
      v_buyer_address, nullif(v_client.email, ''), v_delivery,
      nullif(v_co.payment_terms, ''), nullif(p->>'late_penalty_text', ''),
      v_tot.global_discount_cents, v_tot.deposit_cents, v_tot.total_ht_cents, v_tot.total_vat_cents,
      v_tot.total_ttc_cents, v_tot.net_ttc_cents
    );
  else
    insert into invoices (
      id, company_id, quote_id, client_id, kind, credits_invoice_id, credits_reference,
      reference, year, number, issue_date, service_date, due_date, operation_category, title,
      seller_name, seller_legal_form, seller_siret, seller_vat_number, seller_vat_exemption,
      seller_vat_on_debits, seller_address, seller_email, seller_phone, seller_iban,
      buyer_name, buyer_is_company, buyer_siren, buyer_address, buyer_email, delivery_address,
      payment_terms, late_penalty_text,
      global_discount_cents, deposit_cents, total_ht_cents, total_vat_cents, total_ttc_cents, amount_due_cents
    ) values (
      v_id, v_company, null, v_orig.client_id, 'credit_note', v_orig.id, v_orig.reference,
      v_prefix || '-' || v_year || '-' || lpad(v_number::text, 4, '0'), v_year, v_number,
      v_issue, v_orig.service_date, v_issue, v_orig.operation_category, v_orig.title,
      v_orig.seller_name, v_orig.seller_legal_form, v_orig.seller_siret, v_orig.seller_vat_number,
      v_orig.seller_vat_exemption, v_orig.seller_vat_on_debits, v_orig.seller_address,
      v_orig.seller_email, v_orig.seller_phone, v_orig.seller_iban,
      v_orig.buyer_name, v_orig.buyer_is_company, v_orig.buyer_siren, v_orig.buyer_address,
      v_orig.buyer_email, v_orig.delivery_address,
      null, null,
      v_tot.global_discount_cents, 0, v_tot.total_ht_cents, v_tot.total_vat_cents,
      v_tot.total_ttc_cents, v_tot.total_ttc_cents
    );
  end if;

  insert into invoice_lines (invoice_id, position, label, unit, quantity, unit_price_ht, vat_rate, discount)
  select v_id, (t.ord - 1)::integer, t.l->>'label', t.l->>'unit', (t.l->>'quantity')::numeric,
         (t.l->>'unit_price_ht')::numeric, (t.l->>'vat_rate')::numeric, coalesce((t.l->>'discount')::numeric, 0)
  from jsonb_array_elements(v_lines) with ordinality as t(l, ord);

  return v_id;
end $$;

revoke all on function public.create_invoice_document(jsonb) from public, anon;
grant execute on function public.create_invoice_document(jsonb) to authenticated;

-- =====================================================================
-- 4. Facture émise : seul le passage « émise » → « payée » est permis
-- =====================================================================
create or replace function public.invoices_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if (to_jsonb(new) - array['status', 'paid_at', 'payment_method'])
     is distinct from (to_jsonb(old) - array['status', 'paid_at', 'payment_method']) then
    raise exception 'Une facture émise ne peut plus être modifiée : émettez un avoir.';
  end if;

  if (new.status, new.paid_at, new.payment_method) is distinct from (old.status, old.paid_at, old.payment_method) then
    if not (
      old.kind = 'invoice'
      and old.status = 'issued'
      and new.status = 'paid'
      and new.paid_at is not null
      and new.payment_method in ('virement', 'cheque', 'especes', 'carte', 'autre')
    ) then
      raise exception 'Seul l''enregistrement du paiement d''une facture émise est autorisé.';
    end if;
  end if;

  return new;
end $$;
-- Le trigger invoices_guard_trg (0007) appelle déjà cette fonction : rien à recréer.

-- =====================================================================
-- 5. Événements Stripe : « reçu » ≠ « traité »
-- =====================================================================
alter table public.stripe_events add column if not exists processed_at timestamptz;
-- Les événements déjà présents ont été traités avec succès (les échecs étaient supprimés).
update public.stripe_events set processed_at = received_at where processed_at is null;
