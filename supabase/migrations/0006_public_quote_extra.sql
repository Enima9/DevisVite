-- Phase 4 : informations complémentaires pour la page publique du devis
-- (remise globale, acompte, délai, date, forme juridique) — accès uniquement par jeton.
create or replace function public.get_public_quote_extra(p_token uuid)
returns table (
  global_discount numeric, deposit_amount numeric, execution_delay text,
  created_at timestamptz, company_legal_form text
)
language sql security definer set search_path = public stable
as $$
  select q.global_discount, q.deposit_amount, q.execution_delay, q.created_at, co.legal_form
  from public.quotes q
  join public.companies co on co.id = q.company_id
  where q.public_token = p_token
    and q.token_expires_at > now()
    and q.status <> 'draft';
$$;
grant execute on function public.get_public_quote_extra(uuid) to anon, authenticated;
