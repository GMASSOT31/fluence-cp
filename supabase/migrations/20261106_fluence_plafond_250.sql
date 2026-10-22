-- Plafond anti-triche : à l'enregistrement de la progression, tout résultat de lecture dont la fluence (mclm) dépasse
-- 250 corrects/min est mis à 0 et marqué `fraud` (valeur d'origine conservée) ; l'espace enseignant l'affiche avec 🚩.
-- Recrée student_save_progress_v2 à l'identique, avec ce seul ajout.
create or replace function public.student_save_progress_v2(p_token text, p_progress jsonb, p_version bigint)
 returns bigint language plpgsql security definer set search_path to ''
as $function$
declare v_student uuid; v_teacher uuid; v_version bigint;
begin
 if p_progress is null or jsonb_typeof(p_progress)<>'object' or pg_catalog.octet_length(p_progress::text)>100000 then raise exception 'Progression invalide'; end if;
 -- fluence impossible (> 250 corrects/min) : score mis à 0 et marqué « fraud » (valeur d'origine conservée pour l'enseignant)
 if jsonb_typeof(p_progress->'results')='array' then
  p_progress := jsonb_set(p_progress,'{results}', coalesce((select jsonb_agg(case when jsonb_typeof(e)='object' and jsonb_typeof(e->'mclm')='number' and (e->>'mclm')::numeric>250 then e || jsonb_build_object('fraud',(e->>'mclm')::numeric,'mclm',0) else e end order by o) from jsonb_array_elements(p_progress->'results') with ordinality t(e,o)),'[]'::jsonb));
 end if;
 select ss.student_id,s.teacher_id into v_student,v_teacher from public.student_sessions ss join public.students s on s.id=ss.student_id where ss.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and ss.expires_at>now();
 if v_student is null then raise exception 'Session expirée'; end if;
 insert into public.student_progress(student_id,teacher_id,progress,sync_version) values(v_student,v_teacher,p_progress,1)
 on conflict(student_id) do update set progress=excluded.progress,sync_version=public.student_progress.sync_version+1,updated_at=now()
 where public.student_progress.sync_version=p_version
 returning sync_version into v_version;
 if v_version is null then raise exception 'SYNC_CONFLICT'; end if;
 return v_version;
end $function$;
