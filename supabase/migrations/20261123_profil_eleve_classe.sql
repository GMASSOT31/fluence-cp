-- Le Zoo de l'élève a besoin de connaître sa classe (récompenses de la boutique réservées à une classe).
-- Ajout seul : la fonction renvoie en plus class_id ; le reste est identique.
create or replace function public.student_session_profile(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare st record;
begin
 select s.id,s.nickname,s.class_id into st from public.student_sessions ss join public.students s on s.id=ss.student_id
 where ss.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and ss.expires_at>now();
 if st.id is null then raise exception 'Session expirée'; end if;
 return jsonb_build_object('student_id',st.id,'nickname',st.nickname,'class_id',st.class_id);
end $function$;
