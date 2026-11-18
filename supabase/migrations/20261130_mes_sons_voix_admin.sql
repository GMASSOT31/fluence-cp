-- « 🎙 Mes sons » (18/11/2026) : l'admin enregistre lui-même la prononciation des sons du Zoo.
--  * fichiers WAV dans le bucket public « voix-zoo » (lecture publique par adresse ; écriture, liste et suppression réservées à l'admin) ;
--  * app_settings.voice_overrides = {« clip » d'audio/syllabes.json : « nom du fichier »} ;
--  * admin_set_voice(clip, fichier) : l'admin remplace (ou retire avec null) la voix d'un son ;
--  * get_voice_overrides() : lecture seule, pour le Zoo des élèves (sans compte) et l'espace enseignant.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voix-zoo', 'voix-zoo', true, 300000, array['audio/wav', 'audio/x-wav', 'audio/wave'])
on conflict (id) do nothing;

create policy voix_zoo_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'voix-zoo' and public.is_zoo_admin());
create policy voix_zoo_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'voix-zoo' and public.is_zoo_admin());
create policy voix_zoo_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'voix-zoo' and public.is_zoo_admin()) with check (bucket_id = 'voix-zoo' and public.is_zoo_admin());
create policy voix_zoo_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'voix-zoo' and public.is_zoo_admin());

insert into public.app_settings (key, value) values ('voice_overrides', '{}'::jsonb) on conflict (key) do nothing;

create or replace function public.admin_set_voice(p_clip text, p_path text)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v jsonb;
begin
  if auth.uid() is null or not public.is_zoo_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if p_clip is null or length(p_clip) < 1 or length(p_clip) > 40 then raise exception 'Son inconnu'; end if;
  if p_path is not null and p_path !~ '^[a-z0-9_-]{1,60}\.wav$' then raise exception 'Fichier invalide'; end if;
  insert into public.app_settings (key, value) values ('voice_overrides', '{}'::jsonb) on conflict (key) do nothing;
  update public.app_settings
     set value = case when p_path is null then coalesce(value, '{}'::jsonb) - p_clip
                      else coalesce(value, '{}'::jsonb) || jsonb_build_object(p_clip, p_path) end
   where key = 'voice_overrides'
  returning value into v;
  return v;
end
$function$;
revoke all on function public.admin_set_voice(text, text) from public, anon;
grant execute on function public.admin_set_voice(text, text) to authenticated;

create or replace function public.get_voice_overrides()
 returns jsonb language sql stable security definer set search_path to ''
as $function$
  select coalesce((select value from public.app_settings where key = 'voice_overrides'), '{}'::jsonb)
$function$;
revoke all on function public.get_voice_overrides() from public;
grant execute on function public.get_voice_overrides() to anon, authenticated;
