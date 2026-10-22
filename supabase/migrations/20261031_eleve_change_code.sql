-- Un élève connecté peut changer son code secret (PIN).
-- student_change_pin : session valide, ancien code vérifié, nouveau code de 4 à 8 chiffres et différent,
-- réglage de l'enseignant « pinChange » respecté (autorisé par défaut), 5 essais ratés par 15 minutes au plus.
-- Les échecs de l'ancien code sont renvoyés comme résultat (ok = false) et non comme erreur : une erreur annulerait
-- aussi l'enregistrement de l'essai et la limitation ne compterait jamais.
-- Les autres sessions de l'élève (autres appareils) sont fermées ; la session en cours est gardée.

create or replace function public.student_change_pin(p_token text, p_old_pin text, p_new_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  st record; v_hash text; v_name text; attempts integer; v_allowed boolean;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Session expirée'; end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select s.id, s.nickname, s.pin_hash, s.teacher_id, c.access_code,
         s.ghosted_at as s_ghost, t.ghosted_at as t_ghost, c.ghosted_at as c_ghost into st
    from public.student_sessions ss
    join public.students s on s.id = ss.student_id
    join public.classes c on c.id = s.class_id
    join public.teachers t on t.id = s.teacher_id
   where ss.token_hash = v_hash and ss.expires_at > now();
  if st.id is null then raise exception 'Session expirée'; end if;
  if st.s_ghost is not null or st.t_ghost is not null or st.c_ghost is not null then
    raise exception 'Compte suspendu. Demande à ton maître(sse).'; end if;

  select coalesce(not (ts.settings->'pinChange' = 'false'::jsonb), true) into v_allowed
    from public.teacher_zoo_settings ts where ts.teacher_id = st.teacher_id;
  if coalesce(v_allowed, true) is not true then
    raise exception 'Ton maître(sse) a désactivé ce changement.'; end if;

  if p_old_pin is null or p_new_pin is null or p_old_pin !~ '^[0-9]{4,8}$' or p_new_pin !~ '^[0-9]{4,8}$' then
    raise exception 'Le code doit avoir de 4 à 8 chiffres.'; end if;
  if p_old_pin = p_new_pin then raise exception 'Le nouveau code doit être différent de l''ancien.'; end if;

  v_name := 'pin:' || lower(trim(st.nickname));
  select count(*) into attempts from public.student_login_attempts
   where class_code = st.access_code and student_name = v_name and attempted_at > now() - interval '15 minutes';
  if attempts >= 5 then return jsonb_build_object('ok', false, 'code', 'locked'); end if;

  if st.pin_hash is null or st.pin_hash <> extensions.crypt(p_old_pin, st.pin_hash) then
    insert into public.student_login_attempts(class_code, student_name) values (st.access_code, v_name);
    return jsonb_build_object('ok', false, 'code', 'bad_old');
  end if;

  update public.students set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 11)) where id = st.id;
  delete from public.student_sessions where student_id = st.id and token_hash <> v_hash;
  delete from public.student_login_attempts where class_code = st.access_code and student_name = v_name;
  return jsonb_build_object('ok', true);
end $function$;

revoke execute on function public.student_change_pin(text, text, text) from public;
grant execute on function public.student_change_pin(text, text, text) to anon, authenticated;
