-- Schéma FACTICE minimal pour essayer 20261112_labo_calcul.sql sur un PostgreSQL local (jamais sur la vraie base).
-- Reproduit seulement ce dont le labo a besoin : rôles, auth.uid(), pgcrypto, comptes, classes, élèves, sessions, student_progress, app_settings.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth; create schema extensions;
create extension pgcrypto schema extensions;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth, extensions to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create table public.teachers (id uuid primary key, email text, display_name text, role text not null default 'teacher', ghosted_at timestamptz);
create table public.classes (id uuid primary key, teacher_id uuid not null, name text not null);
create table public.students (id uuid primary key default gen_random_uuid(), teacher_id uuid not null, class_id uuid not null, nickname text not null, ghosted_at timestamptz, created_at timestamptz not null default now());
create table public.student_sessions (token_hash text primary key, student_id uuid not null, expires_at timestamptz not null);
create table public.student_progress (student_id uuid primary key, teacher_id uuid, progress jsonb not null default '{}', sync_version bigint not null default 0, pending_coins int not null default 0);
create table public.app_settings (key text primary key, value jsonb not null default '{}', updated_at timestamptz not null default now());
alter table public.teachers enable row level security; alter table public.classes enable row level security; alter table public.students enable row level security;
alter table public.student_sessions enable row level security; alter table public.student_progress enable row level security; alter table public.app_settings enable row level security;
create function public.is_zoo_admin() returns boolean language sql stable security definer set search_path to '' as $$ select exists (select 1 from public.teachers where id = auth.uid() and role = 'admin') $$;
grant execute on function public.is_zoo_admin() to anon, authenticated;
