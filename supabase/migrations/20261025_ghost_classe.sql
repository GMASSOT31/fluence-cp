-- Ghoster (suspendre) ou supprimer une classe entière.
-- Ghostée : plus de connexion pour ses élèves, données gardées, réactivable. Supprimée : la classe et ses élèves partent en cascade.
-- Ajoute une colonne et une fonction, ajoute un refus dans student_sign_in ; aucune politique ne change.

alter table public.classes add column if not exists ghosted_at timestamptz;

-- Connexion élève : identique, avec un refus si la classe est ghostée
create or replace function public.student_sign_in(p_code text, p_nickname text, p_pin text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare st record; attempts integer; v_code text;
begin
  v_code := upper(regexp_replace(
    translate(coalesce(p_code, ''), 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÁÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ',
                                    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^A-Za-z0-9]', '', 'g'));
  if v_code !~ '^[A-Z0-9]{4,20}$' or length(p_nickname) > 60 or p_pin !~ '^[0-9]{4,8}$' or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Identifiants invalides'; end if;
  select count(*) into attempts from public.student_login_attempts
   where class_code = v_code and student_name = lower(trim(p_nickname)) and attempted_at > now() - interval '15 minutes';
  if attempts >= 5 then raise exception 'Trop de tentatives. Réessaie dans 15 minutes'; end if;
  insert into public.student_login_attempts(class_code, student_name) values (v_code, lower(trim(p_nickname)));
  select s.id, s.nickname, s.teacher_id, s.ghosted_at as s_ghost, t.ghosted_at as t_ghost, c.ghosted_at as c_ghost into st
    from public.students s join public.classes c on c.id = s.class_id join public.teachers t on t.id = s.teacher_id
   where c.access_code = v_code and lower(s.nickname) = lower(trim(p_nickname))
     and s.pin_hash is not null and s.pin_hash = extensions.crypt(p_pin, s.pin_hash) limit 1;
  if st.id is null then raise exception 'Identifiants invalides'; end if;
  if st.s_ghost is not null or st.t_ghost is not null or st.c_ghost is not null then
    raise exception 'Compte suspendu. Demande à ton maître(sse).'; end if;
  insert into public.student_sessions(token_hash, student_id, expires_at)
  values (encode(extensions.digest(p_token, 'sha256'), 'hex'), st.id, now() + interval '7 days');
  return jsonb_build_object('student_id', st.id, 'nickname', st.nickname, 'expires_in', 604800);
end $$;

-- Classe : son enseignant(e) ou l'admin. Actions : ghost, unghost, delete.
create or replace function public.manage_class(p_class uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_teacher uuid;
begin
  if auth.uid() is null then raise exception 'Connexion enseignante requise'; end if;
  select teacher_id into v_teacher from public.classes where id = p_class;
  if v_teacher is null then raise exception 'Classe introuvable'; end if;
  if v_teacher <> auth.uid() and not public.is_zoo_admin() then raise exception 'Cette classe n''est pas à toi'; end if;
  if p_action = 'ghost' then
    update public.classes set ghosted_at = coalesce(ghosted_at, now()) where id = p_class;
    delete from public.student_sessions ss using public.students s where s.id = ss.student_id and s.class_id = p_class;
  elsif p_action = 'unghost' then
    update public.classes set ghosted_at = null where id = p_class;
  elsif p_action = 'delete' then
    delete from public.classes where id = p_class;
  else raise exception 'Action inconnue'; end if;
  return p_action;
end $$;

revoke all on function public.manage_class(uuid, text) from public, anon;
grant execute on function public.manage_class(uuid, text) to authenticated;
