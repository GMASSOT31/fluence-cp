-- Fonction « ping » : appel léger en lecture seule, utilisé par le workflow GitHub « Réveil Supabase »
-- pour que le projet gratuit ne soit pas mis en pause pendant les vacances. Ne lit aucune donnée.

create or replace function public.ping()
returns jsonb
language sql
stable
set search_path = ''
as $$ select jsonb_build_object('ok', true, 'at', now()) $$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
