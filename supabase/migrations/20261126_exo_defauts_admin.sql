-- Exercices : tout ce que l'admin règle dans les exos (lecture « texts », écoute « listenCfg », dictée « dictee ») et l'ordre des sons « sounds »
-- devient le réglage par défaut des enseignants qui n'ont pas encore les leurs (nouveaux comptes compris).
--  * l'espace de l'admin enregistre ses réglages dans app_settings.exo_defaults (politique admin_manage_app_settings existante) ;
--  * get_exo_defaults() les donne aux enseignants connectés (l'espace enseignant les affiche tant qu'ils n'ont rien modifié) ;
--  * student_get_teacher_settings les ajoute pour le Zoo élève, clé par clé : la valeur de l'enseignant gagne si elle est présente et non vide
--    ({} , [] et null comptent comme « absent »), sinon celle de exo_defaults. Les autres réglages (seuils, boutique…) ne bougent pas.
-- Remplace dictee_defaults (migration 20261125) : sa valeur éventuelle est reprise dans exo_defaults.dictee.
insert into public.app_settings(key, value)
select 'exo_defaults',
       case when d.value is not null and d.value <> '{}'::jsonb then jsonb_build_object('dictee', d.value) else '{}'::jsonb end
  from (select (select value from public.app_settings where key = 'dictee_defaults') as value) d
on conflict (key) do nothing;

create or replace function public.get_exo_defaults()
 returns jsonb language sql stable security definer set search_path to ''
as $function$
  select coalesce((select value from public.app_settings where key = 'exo_defaults'), '{}'::jsonb)
   where auth.uid() is not null
$function$;
revoke all on function public.get_exo_defaults() from public, anon;
grant execute on function public.get_exo_defaults() to authenticated;

create or replace function public.student_get_teacher_settings(p_token text)
 returns jsonb language sql security definer set search_path to ''
as $function$
select coalesce(ts.settings, '{}'::jsonb)
       || coalesce((
            select jsonb_object_agg(k.key, d.value -> k.key)
              from unnest(array['texts', 'listenCfg', 'dictee', 'sounds']) as k(key)
             where jsonb_exists(coalesce(d.value, '{}'::jsonb), k.key)
               and (d.value -> k.key) not in ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)
               and (not jsonb_exists(coalesce(ts.settings, '{}'::jsonb), k.key)
                    or (ts.settings -> k.key) in ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb))
          ), '{}'::jsonb)
from public.student_sessions ss
join public.students s on s.id = ss.student_id
left join public.teacher_zoo_settings ts on ts.teacher_id = s.teacher_id
left join lateral (select value from public.app_settings where key = 'exo_defaults') d on true
where ss.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and ss.expires_at > now()
limit 1
$function$;
