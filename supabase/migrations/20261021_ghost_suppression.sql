-- Ghoster (suspendre) ou supprimer un élève ou un compte enseignant.
-- Ghosté : plus de connexion, données gardées, réactivable. Supprimé : tout part en cascade.
-- Ajoute deux colonnes et deux fonctions, ajoute un refus dans student_sign_in ; aucune politique ne change.

alter table public.students add column if not exists ghosted_at timestamptz;
alter table public.teachers add column if not exists ghosted_at timestamptz;

-- Connexion élève : identique, avec un refus si l'élève ou son enseignant(e) est ghosté(e)
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
  select s.id, s.nickname, s.teacher_id, s.ghosted_at as s_ghost, t.ghosted_at as t_ghost into st
    from public.students s join public.classes c on c.id = s.class_id join public.teachers t on t.id = s.teacher_id
   where c.access_code = v_code and lower(s.nickname) = lower(trim(p_nickname))
     and s.pin_hash is not null and s.pin_hash = extensions.crypt(p_pin, s.pin_hash) limit 1;
  if st.id is null then raise exception 'Identifiants invalides'; end if;
  if st.s_ghost is not null or st.t_ghost is not null then
    raise exception 'Compte suspendu. Demande à ton maître(sse).'; end if;
  insert into public.student_sessions(token_hash, student_id, expires_at)
  values (encode(extensions.digest(p_token, 'sha256'), 'hex'), st.id, now() + interval '7 days');
  return jsonb_build_object('student_id', st.id, 'nickname', st.nickname, 'expires_in', 604800);
end $$;

-- Élève : son enseignant(e) ou l'admin. Actions : ghost, unghost, delete.
create or replace function public.manage_student(p_student uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_teacher uuid;
begin
  if auth.uid() is null then raise exception 'Connexion enseignante requise'; end if;
  select teacher_id into v_teacher from public.students where id = p_student;
  if v_teacher is null then raise exception 'Élève introuvable'; end if;
  if v_teacher <> auth.uid() and not public.is_zoo_admin() then raise exception 'Cet élève n''est pas dans tes classes'; end if;
  if p_action = 'ghost' then
    update public.students set ghosted_at = coalesce(ghosted_at, now()) where id = p_student;
    delete from public.student_sessions where student_id = p_student;
  elsif p_action = 'unghost' then
    update public.students set ghosted_at = null where id = p_student;
  elsif p_action = 'delete' then
    delete from public.students where id = p_student;
  else raise exception 'Action inconnue'; end if;
  return p_action;
end $$;

-- Compte enseignant : admin seulement, jamais soi-même ni un autre admin. Actions : ghost, unghost, delete.
create or replace function public.admin_manage_teacher(p_teacher uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  if auth.uid() is null or not public.is_zoo_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if p_teacher = auth.uid() then raise exception 'Impossible sur ton propre compte'; end if;
  select role into v_role from public.teachers where id = p_teacher;
  if v_role is null then raise exception 'Compte enseignant introuvable'; end if;
  if v_role = 'admin' then raise exception 'Impossible sur un compte administrateur'; end if;
  if p_action = 'ghost' then
    update public.teachers set ghosted_at = coalesce(ghosted_at, now()) where id = p_teacher;
    update auth.users set banned_until = '2999-01-01 00:00:00+00' where id = p_teacher;
    delete from public.student_sessions ss using public.students s where s.id = ss.student_id and s.teacher_id = p_teacher;
  elsif p_action = 'unghost' then
    update public.teachers set ghosted_at = null where id = p_teacher;
    update auth.users set banned_until = null where id = p_teacher;
  elsif p_action = 'delete' then
    delete from auth.users where id = p_teacher;
  else raise exception 'Action inconnue'; end if;
  return p_action;
end $$;

revoke all on function public.manage_student(uuid, text) from public, anon;
revoke all on function public.admin_manage_teacher(uuid, text) from public, anon;
grant execute on function public.manage_student(uuid, text) to authenticated;
grant execute on function public.admin_manage_teacher(uuid, text) to authenticated;
