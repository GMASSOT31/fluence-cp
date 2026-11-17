-- Invitation d'un collègue par l'admin (17/11/2026) : un lien à usage unique (30 jours).
-- Le collègue tape 2 fois son e-mail et 2 fois son mot de passe : le compte est créé tout de suite,
-- adresse considérée comme validée (aucun e-mail de confirmation), avec 15 places d'élèves.
create table if not exists public.teacher_invites (
  token text primary key,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  seats integer not null default 15,
  used_at timestamptz,
  used_by uuid,
  used_email text
);
alter table public.teacher_invites enable row level security;   -- aucune politique : accès seulement par les fonctions ci-dessous
revoke all on public.teacher_invites from anon, authenticated;

-- Admin : fabrique un nouveau lien
create or replace function public.admin_create_invite()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text := encode(extensions.gen_random_bytes(16), 'hex'); v_exp timestamptz;
begin
  if not public.is_zoo_admin() then raise exception 'Réservé à l''administrateur'; end if;
  insert into public.teacher_invites(token, created_by) values (v_token, auth.uid()) returning expires_at into v_exp;
  return jsonb_build_object('token', v_token, 'expires_at', v_exp);
end $$;

-- Admin : les 20 dernières invitations (en attente / utilisées / expirées)
create or replace function public.admin_list_invites()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_zoo_admin() then raise exception 'Réservé à l''administrateur'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('token', token, 'created_at', created_at, 'expires_at', expires_at, 'used_at', used_at, 'used_email', used_email) order by created_at desc)
                     from (select * from public.teacher_invites order by created_at desc limit 20) i), '[]'::jsonb);
end $$;

-- Page d'invitation : le lien est-il encore valable ?
create or replace function public.invite_check(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.teacher_invites;
begin
  select * into v from public.teacher_invites where token = p_token;
  if v.token is null then return jsonb_build_object('ok', false, 'reason', 'unknown'); end if;
  if v.used_at is not null then return jsonb_build_object('ok', false, 'reason', 'used'); end if;
  if v.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Page d'invitation : crée le compte (adresse validée d'office), 15 places, lien consommé
create or replace function public.invite_signup(p_token text, p_email text, p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.teacher_invites; v_email text := lower(btrim(coalesce(p_email, ''))); v_id uuid := gen_random_uuid();
begin
  select * into v from public.teacher_invites where token = p_token for update;
  if v.token is null then return jsonb_build_object('ok', false, 'reason', 'unknown'); end if;
  if v.used_at is not null then return jsonb_build_object('ok', false, 'reason', 'used'); end if;
  if v.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then return jsonb_build_object('ok', false, 'reason', 'bad_email'); end if;
  if char_length(coalesce(p_password, '')) < 8 or char_length(p_password) > 72 then return jsonb_build_object('ok', false, 'reason', 'bad_password'); end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then return jsonb_build_object('ok', false, 'reason', 'email_taken'); end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, 'email',
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false), now(), now(), now());
  -- la ligne « teachers » est créée par le déclencheur create_teacher_after_signup ; on lui donne les places de l'invitation
  update public.teachers set student_limit = v.seats where id = v_id;
  update public.teacher_invites set used_at = now(), used_by = v_id, used_email = v_email where token = p_token;
  return jsonb_build_object('ok', true, 'email', v_email);
end $$;

revoke all on function public.admin_create_invite() from public, anon;
revoke all on function public.admin_list_invites() from public, anon;
revoke all on function public.invite_check(text) from public;
revoke all on function public.invite_signup(text, text, text) from public;
grant execute on function public.admin_create_invite() to authenticated;
grant execute on function public.admin_list_invites() to authenticated;
grant execute on function public.invite_check(text) to anon, authenticated;
grant execute on function public.invite_signup(text, text, text) to anon, authenticated;
