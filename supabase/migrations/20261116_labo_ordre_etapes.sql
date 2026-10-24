-- Labo Zoo de Calcul : l'ordre des étapes choisi par l'enseignant est conservé.
-- Avant : « select distinct » triait les identifiants par ordre alphabétique (n1, n10, n11, n2…), donc l'ordre voulu était perdu.
-- Après : doublons retirés en gardant la PREMIÈRE position de chaque identifiant. Rien d'autre ne change (mêmes bornes, mêmes droits).
-- Aucune suppression ; les réglages déjà enregistrés ne sont pas modifiés (l'enseignant les réenregistre dans l'ordre voulu).
create or replace function public.lab_teacher_settings_set(p_settings jsonb) returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v jsonb := '{}'::jsonb; k text; begin
  if not public.lab__teacher_allowed() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' or pg_catalog.octet_length(p_settings::text) > 4000 then raise exception 'Données invalides'; end if;
  if jsonb_typeof(p_settings->'pass') = 'number' then v := v || jsonb_build_object('pass', least(greatest((p_settings->>'pass')::numeric, 50), 100)::integer); end if;
  if jsonb_typeof(p_settings->'questions') = 'number' then v := v || jsonb_build_object('questions', least(greatest((p_settings->>'questions')::numeric, 5), 20)::integer); end if;
  if jsonb_typeof(p_settings->'voice') = 'boolean' then v := v || jsonb_build_object('voice', p_settings->'voice'); end if;
  foreach k in array array['nombres', 'addition', 'soustraction'] loop
    if jsonb_typeof(p_settings->'levels'->k) = 'array' then
      v := jsonb_set(v, '{levels}', coalesce(v->'levels', '{}'::jsonb) || jsonb_build_object(k,
        (select coalesce(jsonb_agg(q.x order by q.o), '[]'::jsonb) from (
           select t.x, min(t.o) as o from jsonb_array_elements_text(p_settings->'levels'->k) with ordinality as t(x, o)
           where t.x ~ '^[a-z0-9_-]{1,20}$' group by t.x order by min(t.o) limit 40) q)));
    end if;
  end loop;
  insert into public.lab_calc_settings(teacher_id, settings) values (auth.uid(), v)
    on conflict (teacher_id) do update set settings = excluded.settings, updated_at = now();
  return v;
end $$;
-- (les droits d'exécution de la fonction ne changent pas : create or replace les conserve)

-- Réglages déjà enregistrés : leur ordre était perdu (aléatoire) ; on les remet une fois dans l'ordre des étapes (n1, n2… n10, n11), que l'enseignant peut ensuite changer.
-- Mise à jour seulement (aucune suppression), identique si on la rejoue.
update public.lab_calc_settings set settings = jsonb_set(settings, '{levels}', (
  select coalesce(jsonb_object_agg(k.key, case when jsonb_typeof(k.value) = 'array' then
    (select coalesce(jsonb_agg(x order by coalesce(nullif(regexp_replace(x, '\D', '', 'g'), '')::int, 0), x), '[]'::jsonb) from jsonb_array_elements_text(k.value) x) else k.value end), '{}'::jsonb)
  from jsonb_each(settings->'levels') k))
where jsonb_typeof(settings->'levels') = 'object';
