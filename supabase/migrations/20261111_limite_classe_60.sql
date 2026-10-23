-- Limite par classe de student_sign_in portée de 30 à 60 échecs sur 15 minutes (une classe qui se connecte
-- d'un coup avec quelques erreurs de frappe ne doit pas être bloquée). Reste identique : 5 échecs par élève.
-- (Rappel de la migration 20261109 : les codes faux sont comptés et renvoyés comme résultat, pas comme erreur.)
-- Avant : un code faux levait une erreur, ce qui annulait aussi l'enregistrement de l'essai dans
-- student_login_attempts (seules les connexions réussies étaient comptées). Maintenant les échecs sont
-- renvoyés comme résultat (ok = false) et enregistrés.
-- Limites : 5 échecs par élève (code de classe + pseudo) sur 15 minutes, 60 échecs par classe sur 15 minutes.
-- « Pseudo inconnu » et « code faux » donnent la même réponse (reason = 'bad_pin').
-- Une connexion réussie efface les échecs de cet élève. Le blocage refuse aussi le bon code.

create or replace function public.student_sign_in(p_code text, p_nickname text, p_pin text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare st record; v_code text; v_name text; v_n integer; v_class_n integer; v_wait integer;
begin
  v_code := upper(regexp_replace(
    translate(coalesce(p_code, ''), 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÁÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ',
                                    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^A-Za-z0-9]', '', 'g'));
  if v_code !~ '^[A-Z0-9]{4,20}$' or length(p_nickname) > 60 or p_pin !~ '^[0-9]{4,8}$' or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Identifiants invalides'; end if;
  v_name := lower(trim(p_nickname));

  delete from public.student_login_attempts where attempted_at < now() - interval '1 day';

  select count(*) into v_n from public.student_login_attempts
   where class_code = v_code and student_name = v_name and attempted_at > now() - interval '15 minutes';
  select count(*) into v_class_n from public.student_login_attempts
   where class_code = v_code and student_name not like 'pin:%' and attempted_at > now() - interval '15 minutes';
  if v_n >= 5 or v_class_n >= 60 then
    select greatest(1, ceil(extract(epoch from (min(attempted_at) + interval '15 minutes' - now())))::integer) into v_wait
      from public.student_login_attempts
     where class_code = v_code and attempted_at > now() - interval '15 minutes'
       and (student_name = v_name or student_name not like 'pin:%');
    return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_after', coalesce(v_wait, 900));
  end if;

  select s.id, s.nickname, s.teacher_id, s.ghosted_at as s_ghost, t.ghosted_at as t_ghost, c.ghosted_at as c_ghost into st
    from public.students s join public.classes c on c.id = s.class_id join public.teachers t on t.id = s.teacher_id
   where c.access_code = v_code and lower(s.nickname) = v_name
     and s.pin_hash is not null and s.pin_hash = extensions.crypt(p_pin, s.pin_hash) limit 1;
  if st.id is null then
    insert into public.student_login_attempts(class_code, student_name) values (v_code, v_name);
    return jsonb_build_object('ok', false, 'reason', 'bad_pin');
  end if;
  if st.s_ghost is not null or st.t_ghost is not null or st.c_ghost is not null then
    raise exception 'Compte suspendu. Demande à ton maître(sse).'; end if;

  delete from public.student_login_attempts where class_code = v_code and student_name = v_name;
  insert into public.student_sessions(token_hash, student_id, expires_at)
  values (encode(extensions.digest(p_token, 'sha256'), 'hex'), st.id, now() + interval '7 days');
  return jsonb_build_object('ok', true, 'student_id', st.id, 'nickname', st.nickname, 'expires_in', 604800);
end $function$;
