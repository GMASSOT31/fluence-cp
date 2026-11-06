-- Dictée : exercices par défaut choisis par l'admin (app_settings.dictee_defaults).
-- Ils servent aux enseignants qui n'ont pas encore de réglage « dictee » dans teacher_zoo_settings (nouveaux comptes) :
--  * l'espace enseignant les lit avec get_dictee_defaults() et les affiche ;
--  * le Zoo élève les reçoit directement dans student_get_teacher_settings (clé « dictee » ajoutée si l'enseignant n'en a pas).
-- Dès que l'enseignant enregistre ses propres réglages, sa copie prend le relais. Vide ({}) = exercices automatiques du Zoo.
-- L'admin écrit dans app_settings (politique admin_manage_app_settings existante) : aucune fonction d'écriture à ajouter.
insert into public.app_settings(key, value) values ('dictee_defaults', '{}'::jsonb) on conflict (key) do nothing;

create or replace function public.get_dictee_defaults()
 returns jsonb language sql stable security definer set search_path to ''
as $function$
  select coalesce((select value from public.app_settings where key = 'dictee_defaults'), '{}'::jsonb)
   where auth.uid() is not null
$function$;
revoke all on function public.get_dictee_defaults() from public, anon;
grant execute on function public.get_dictee_defaults() to authenticated;

create or replace function public.student_get_teacher_settings(p_token text)
 returns jsonb language sql security definer set search_path to ''
as $function$
select case
         when jsonb_exists(coalesce(ts.settings, '{}'::jsonb), 'dictee') or d.value is null or d.value = '{}'::jsonb
           then coalesce(ts.settings, '{}'::jsonb)
         else coalesce(ts.settings, '{}'::jsonb) || jsonb_build_object('dictee', d.value)
       end
from public.student_sessions ss
join public.students s on s.id = ss.student_id
left join public.teacher_zoo_settings ts on ts.teacher_id = s.teacher_id
left join public.app_settings d on d.key = 'dictee_defaults'
where ss.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and ss.expires_at > now()
limit 1
$function$;
