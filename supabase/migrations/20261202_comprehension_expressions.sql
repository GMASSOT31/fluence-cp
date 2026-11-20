-- Autoriser les courtes expressions illustrées, sans modifier les données existantes.
create or replace function public.admin_save_comprehension_exercise(p_sound text, p_entries jsonb, p_previous jsonb)
returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.is_zoo_admin() then
    raise exception 'Réservé à l''administrateur';
  end if;
  if p_sound is null or p_sound !~ '^[[:alnum:]_-]{1,40}$'
      or jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'Exercice invalide';
  end if;
  if jsonb_array_length(p_entries) > 16 or octet_length(p_entries::text) > 4096 then
    raise exception 'L’exercice est trop long';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_entries) as e(item)
    where jsonb_typeof(item) is distinct from 'object'
      or item - 'word' - 'path' <> '{}'::jsonb
      or coalesce(item->>'word', '') !~ '^[a-zàâäçéèêëîïôöùûüÿœæ]+([ ’''-][a-zàâäçéèêëîïôöùûüÿœæ]+)*$'
      or length(item->>'word') > 40
      or coalesce(item->>'path', '') !~ '^[a-z0-9-]{16,60}\.jpg$'
      or not exists (select 1 from storage.objects where bucket_id = 'comprehension-zoo' and name = item->>'path')
  ) or (
    select count(distinct item->>'word') from jsonb_array_elements(p_entries) as e(item)
  ) <> jsonb_array_length(p_entries) then
    raise exception 'Chaque mot ou expression doit être différent et associé à une image déposée';
  end if;

  update public.app_settings
  set value = case when p_entries = '[]'::jsonb then value - p_sound
                   else jsonb_set(value, array[p_sound], p_entries) end
  where key = 'comprehension_exercises' and coalesce(value->p_sound, '[]'::jsonb) = p_previous;
  if not found then
    raise exception 'Cet exercice a changé ailleurs. Rechargez la page avant de réessayer.';
  end if;
end
$function$;
revoke all on function public.admin_save_comprehension_exercise(text, jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_comprehension_exercise(text, jsonb, jsonb) to authenticated;
