-- 0004 — RGPD : preuve d'acceptation des conditions + droit à l'effacement.

-- Preuve de l'acceptation des CGU / de la politique de confidentialité (date + version du texte).
alter table public.companies
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

-- Droit à l'effacement : l'utilisateur connecté supprime son propre compte.
-- La suppression de auth.users entraîne en cascade l'entreprise, les clients, devis, lignes,
-- modèles, catalogue, signatures, relances et journaux liés (clés étrangères ON DELETE CASCADE).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Non authentifié';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
