-- Labo Zoo de Calcul : un enseignant peut DEMANDER l'accès ; l'admin voit les demandes en attente (pastille) et les accepte ou refuse.
-- * lab_requests : une ligne par enseignant (jamais supprimée : traitée = handled_at renseigné).
-- * lab_request_access() : appelable par un enseignant connecté, seulement si le labo est activé et qu'il n'a pas déjà accès.
-- * lab_my_access() : ajoute « requestable » / « requested » pour un enseignant (rien de nouveau pour les élèves).
-- * lab_admin_state() : ajoute « requests » ; lab_admin_grant() marque la demande comme traitée ; lab_admin_decline() la refuse.
-- Aucune suppression (« delete ») nulle part. Fonctions de départ : pg_get_functiondef en ligne.

create table public.lab_requests (
  teacher_id uuid primary key,
  requested_at timestamptz not null default now(),
  handled_at timestamptz   -- accordée, refusée : ligne conservée
);
alter table public.lab_requests enable row level security;
revoke all on public.lab_requests from public, anon, authenticated;

create function public.lab_request_access() returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v timestamptz; begin
  if auth.uid() is null or not exists (select 1 from public.teachers t where t.id = auth.uid()) then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if not public.lab__enabled() then raise exception 'Laboratoire fermé'; end if;
  if public.lab__teacher_allowed() then return jsonb_build_object('requested', false, 'allowed', true); end if;
  insert into public.lab_requests(teacher_id) values (auth.uid())
    on conflict (teacher_id) do update set requested_at = now(), handled_at = null
      where public.lab_requests.handled_at is not null and public.lab_requests.handled_at < now() - interval '1 day';
  select requested_at into v from public.lab_requests where teacher_id = auth.uid() and handled_at is null;
  return jsonb_build_object('requested', v is not null, 'allowed', false);
end $$;

create or replace function public.lab_my_access(p_token text default null) returns jsonb language plpgsql stable security definer set search_path to ''
as $$ declare v uuid; a boolean; begin
  if p_token is not null then
    v := public.lab__student_from_token(p_token);
    return jsonb_build_object('allowed', public.lab__student_allowed(v), 'role', 'student');
  end if;
  if auth.uid() is null then return jsonb_build_object('allowed', false); end if;
  a := public.lab__teacher_allowed();
  return jsonb_build_object('allowed', a, 'role', case when public.is_zoo_admin() then 'admin' else 'teacher' end,
    'requestable', (not a) and public.lab__enabled() and exists (select 1 from public.teachers t where t.id = auth.uid()),
    'requested', (not a) and exists (select 1 from public.lab_requests r where r.teacher_id = auth.uid() and r.handled_at is null));
end $$;

create or replace function public.lab_admin_state() returns jsonb language plpgsql stable security definer set search_path to ''
as $$ begin
  if auth.uid() is null or not public.is_zoo_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object('enabled', public.lab__enabled(),
    'access', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.subject_kind, 'subject_id', a.subject_id, 'scope', a.scope, 'note', a.note,
        'label', case when a.subject_kind = 'teacher' then (select coalesce(t.display_name, t.email) from public.teachers t where t.id = a.subject_id)
                      else (select s.nickname from public.students s where s.id = a.subject_id) end) order by a.created_at) from public.lab_access a where a.revoked_at is null), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('teacher_id', r.teacher_id, 'label', coalesce(t.display_name, t.email), 'requested_at', r.requested_at) order by r.requested_at)
        from public.lab_requests r join public.teachers t on t.id = r.teacher_id
        where r.handled_at is null and t.ghosted_at is null
          and not exists (select 1 from public.lab_access a where a.subject_kind = 'teacher' and a.subject_id = r.teacher_id and a.revoked_at is null)), '[]'::jsonb),
    'teachers', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'label', coalesce(t.display_name, t.email)) order by coalesce(t.display_name, t.email)) from public.teachers t where t.ghosted_at is null), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.nickname, 'class_name', c.name) order by c.name, s.nickname)
        from (select * from public.students where ghosted_at is null order by created_at desc limit 500) s join public.classes c on c.id = s.class_id), '[]'::jsonb));
end $$;

create or replace function public.lab_admin_grant(p_kind text, p_subject uuid, p_scope text default 'self', p_note text default null) returns uuid language plpgsql security definer set search_path to ''
as $$ declare v uuid; begin
  if auth.uid() is null or not public.is_zoo_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_kind not in ('teacher', 'student') or p_subject is null or p_scope not in ('self', 'self_and_students') or (p_kind = 'student' and p_scope <> 'self') then raise exception 'Données invalides'; end if;
  if (p_kind = 'teacher' and not exists (select 1 from public.teachers where id = p_subject)) or (p_kind = 'student' and not exists (select 1 from public.students where id = p_subject)) then raise exception 'Compte introuvable'; end if;
  insert into public.lab_access(subject_kind, subject_id, scope, note) values (p_kind, p_subject, p_scope, nullif(pg_catalog.left(btrim(p_note), 200), ''))
    on conflict (subject_kind, subject_id) do update set scope = excluded.scope, note = excluded.note, revoked_at = null returning id into v;
  if p_kind = 'teacher' then update public.lab_requests set handled_at = now() where teacher_id = p_subject and handled_at is null; end if;
  return v;
end $$;

create function public.lab_admin_decline(p_teacher uuid) returns void language plpgsql security definer set search_path to ''
as $$ begin
  if auth.uid() is null or not public.is_zoo_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  update public.lab_requests set handled_at = now() where teacher_id = p_teacher and handled_at is null;
end $$;

revoke all on function public.lab_request_access(), public.lab_admin_decline(uuid) from public, anon, authenticated;
grant execute on function public.lab_request_access(), public.lab_admin_decline(uuid) to authenticated;
