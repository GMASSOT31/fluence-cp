-- Laboratoire privé « Zoo de Calcul » (phase 1) — NON APPLIQUÉE à la base réelle : à essayer d'abord dans une transaction annulée.
-- Principe : tout est ajouté à côté ; aucune table ni fonction existante n'est modifiée (student_progress, students, teachers… intacts).
-- * lab_access : liste blanche (identifiants internes) des enseignants / élèves autorisés. Rien n'est ouvert sans une ligne ici.
-- * app_settings « lab_calcul » : interrupteur général côté serveur (désactivé à la création).
-- * Aucun droit direct sur les tables (RLS + revoke) : tout passe par des fonctions SECURITY DEFINER qui vérifient l'autorisation.
-- * Pièces et droits de jeu de TEST : colonnes test_coins / test_credits de lab_calc_progress, sans lien avec les vrais soldes.
-- * Idempotence : un tour (round_id) ou une opération (op_id) rejoué ne crédite jamais deux fois.
-- Pour tout désactiver : update public.app_settings set value = '{"enabled": false}' where key = 'lab_calcul';
-- Pour tout retirer : drop des 5 tables lab_* et des fonctions lab_* (voir labo-calcul/README.md).

insert into public.app_settings(key, value) values ('lab_calcul', '{"enabled": false}'::jsonb)
  on conflict (key) do nothing;

-- Pas de clé étrangère volontairement : la suppression d'un vrai compte ne doit jamais être bloquée par le labo.
create table public.lab_access (
  id uuid primary key default gen_random_uuid(),
  subject_kind text not null check (subject_kind in ('teacher', 'student')),
  subject_id uuid not null,
  scope text not null default 'self' check (scope in ('self', 'self_and_students')),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (subject_kind, subject_id)
);
create table public.lab_calc_progress (
  student_id uuid primary key,
  progress jsonb not null default '{}'::jsonb,
  test_coins integer not null default 0 check (test_coins >= 0 and test_coins <= 100000),
  test_credits integer not null default 0 check (test_credits >= 0 and test_credits <= 1000),
  updated_at timestamptz not null default now()
);
create table public.lab_calc_rounds (
  student_id uuid not null,
  round_id uuid not null,
  activity text not null,
  level text not null,
  correct integer not null,
  total integer not null,
  coins integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (student_id, round_id)
);
create table public.lab_calc_ops (
  student_id uuid not null,
  op_id uuid not null,
  kind text not null,
  delta_coins integer not null default 0,
  delta_credits integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (student_id, op_id)
);
create table public.lab_calc_settings (
  teacher_id uuid primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.lab_access enable row level security;
alter table public.lab_calc_progress enable row level security;
alter table public.lab_calc_rounds enable row level security;
alter table public.lab_calc_ops enable row level security;
alter table public.lab_calc_settings enable row level security;
revoke all on public.lab_access, public.lab_calc_progress, public.lab_calc_rounds, public.lab_calc_ops, public.lab_calc_settings from public, anon, authenticated;

-- ===== Fonctions internes (jamais appelables par un client) =====
create function public.lab__enabled() returns boolean language sql stable security definer set search_path to ''
as $$ select coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'lab_calcul'), false) $$;

create function public.lab__student_from_token(p_token text) returns uuid language sql stable security definer set search_path to ''
as $$ select ss.student_id from public.student_sessions ss join public.students s on s.id = ss.student_id
      where p_token ~ '^[a-f0-9]{64}$' and ss.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
        and ss.expires_at > now() and s.ghosted_at is null $$;

create function public.lab__student_allowed(p_student uuid) returns boolean language sql stable security definer set search_path to ''
as $$ select p_student is not null and public.lab__enabled() and (
        exists (select 1 from public.lab_access a where a.subject_kind = 'student' and a.subject_id = p_student)
     or exists (select 1 from public.students s join public.lab_access a on a.subject_kind = 'teacher' and a.subject_id = s.teacher_id and a.scope = 'self_and_students'
                where s.id = p_student)) $$;

create function public.lab__teacher_allowed() returns boolean language sql stable security definer set search_path to ''
as $$ select auth.uid() is not null and public.lab__enabled() and (
        public.is_zoo_admin()
     or exists (select 1 from public.lab_access a where a.subject_kind = 'teacher' and a.subject_id = auth.uid())) $$;

-- Élève autorisé (via son jeton) ou erreur uniforme
create function public.lab__require_student(p_token text) returns uuid language plpgsql stable security definer set search_path to ''
as $$ declare v uuid; begin
  v := public.lab__student_from_token(p_token);
  if v is null or not public.lab__student_allowed(v) then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return v;
end $$;

revoke all on function public.lab__enabled(), public.lab__student_from_token(text), public.lab__student_allowed(uuid),
  public.lab__teacher_allowed(), public.lab__require_student(text) from public, anon, authenticated;

-- ===== Accès : répond toujours sans erreur (faux pour tout inconnu) =====
create function public.lab_my_access(p_token text default null) returns jsonb language plpgsql stable security definer set search_path to ''
as $$ declare v uuid; begin
  if p_token is not null then
    v := public.lab__student_from_token(p_token);
    return jsonb_build_object('allowed', public.lab__student_allowed(v), 'role', 'student');
  end if;
  if auth.uid() is null then return jsonb_build_object('allowed', false); end if;
  return jsonb_build_object('allowed', public.lab__teacher_allowed(), 'role', case when public.is_zoo_admin() then 'admin' else 'teacher' end);
end $$;

-- ===== Élève =====
create function public.lab_student_state(p_token text) returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v uuid; v_row public.lab_calc_progress; v_set jsonb; begin
  v := public.lab__require_student(p_token);
  select * into v_row from public.lab_calc_progress where student_id = v;
  select cs.settings into v_set from public.lab_calc_settings cs join public.students s on s.teacher_id = cs.teacher_id where s.id = v;
  return jsonb_build_object('progress', coalesce(v_row.progress, '{}'::jsonb), 'test_coins', coalesce(v_row.test_coins, 0),
    'test_credits', coalesce(v_row.test_credits, 0), 'settings', coalesce(v_set, '{}'::jsonb));
end $$;

-- Fin d'une série. Le client donne seulement {bonnes réponses du 1er essai, total, aides}; les pièces de test sont calculées ici.
create function public.lab_student_submit_round(p_token text, p_round uuid, p_activity text, p_level text, p_correct integer, p_total integer, p_stats jsonb default '{}'::jsonb)
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v uuid; v_prog jsonb; v_cur jsonb; v_key text; v_pass integer; v_ok boolean; v_coins integer := 0; v_today integer; v_new jsonb; v_ins integer;
  v_rp integer; v_h integer; v_ms integer; v_state public.lab_calc_progress; v_hist jsonb;
begin
  v := public.lab__require_student(p_token);
  if p_round is null or p_activity not in ('nombres', 'addition', 'soustraction') or p_level !~ '^[a-z0-9_-]{1,20}$'
     or p_total is null or p_total < 1 or p_total > 20 or p_correct is null or p_correct < 0 or p_correct > p_total
     or p_stats is null or jsonb_typeof(p_stats) <> 'object' or pg_catalog.octet_length(p_stats::text) > 500 then
    raise exception 'Données invalides';
  end if;
  v_rp := least(greatest(coalesce((p_stats->>'replays')::integer, 0), 0), 500);
  v_h := least(greatest(coalesce((p_stats->>'helps')::integer, 0), 0), 500);
  v_ms := least(greatest(coalesce((p_stats->>'ms')::integer, 0), 0), 120000);
  insert into public.lab_calc_progress(student_id) values (v) on conflict (student_id) do nothing;
  select * into v_state from public.lab_calc_progress where student_id = v for update;   -- sérialise les appels d'un même élève
  if exists (select 1 from public.lab_calc_rounds where student_id = v and round_id = p_round) then
    return jsonb_build_object('inserted', false, 'coins', 0, 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits);
  end if;
  select least(greatest(coalesce((cs.settings->>'pass')::integer, 80), 50), 100) into v_pass
    from public.lab_calc_settings cs join public.students s on s.teacher_id = cs.teacher_id where s.id = v;
  v_pass := coalesce(v_pass, 80);
  v_ok := p_correct * 100 >= v_pass * p_total;
  select count(*) into v_today from public.lab_calc_rounds
    where student_id = v and coins > 0 and (created_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;
  if v_ok and p_total >= 5 and v_today < 10 then v_coins := case when p_correct = p_total then 2 else 1 end; end if;
  insert into public.lab_calc_rounds(student_id, round_id, activity, level, correct, total, coins) values (v, p_round, p_activity, p_level, p_correct, p_total, v_coins);
  v_key := p_activity || ':' || p_level;
  v_prog := coalesce(v_state.progress, '{}'::jsonb);
  v_cur := coalesce(v_prog->'levels'->v_key, '{}'::jsonb);
  v_new := jsonb_build_object(
    'r', coalesce((v_cur->>'r')::integer, 0) + 1, 'q', coalesce((v_cur->>'q')::integer, 0) + p_total,
    'c', coalesce((v_cur->>'c')::integer, 0) + p_correct, 'rp', coalesce((v_cur->>'rp')::integer, 0) + v_rp,
    'h', coalesce((v_cur->>'h')::integer, 0) + v_h, 'ms', v_ms,
    'ok', coalesce((v_cur->>'ok')::integer, 0) + case when v_ok then 1 else 0 end,
    'best', greatest(coalesce((v_cur->>'best')::integer, 0), p_correct * 100 / p_total), 'last', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'));
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into v_hist from (
    select e, o from jsonb_array_elements(coalesce(v_prog->'hist', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('t', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'), 'k', v_key, 'c', p_correct, 'n', p_total, 'ok', v_ok))) with ordinality t(e, o)
    order by o desc limit 30) s;
  v_prog := jsonb_set(jsonb_set(v_prog, '{levels}', coalesce(v_prog->'levels', '{}'::jsonb) || jsonb_build_object(v_key, v_new)), '{hist}', v_hist);
  update public.lab_calc_progress set progress = v_prog, test_coins = test_coins + v_coins, updated_at = now() where student_id = v
    returning * into v_state;
  return jsonb_build_object('inserted', true, 'coins', v_coins, 'success', v_ok, 'level', v_new, 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits);
end $$;

-- Boutique de test : 3 pièces de test = 1 droit de jeu de test ; démarrer une partie de test consomme 1 droit.
create function public.lab_student_buy_play(p_token text, p_op uuid) returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v uuid; v_state public.lab_calc_progress; begin
  v := public.lab__require_student(p_token);
  if p_op is null then raise exception 'Données invalides'; end if;
  insert into public.lab_calc_progress(student_id) values (v) on conflict (student_id) do nothing;
  select * into v_state from public.lab_calc_progress where student_id = v for update;
  if exists (select 1 from public.lab_calc_ops where student_id = v and op_id = p_op) then
    return jsonb_build_object('done', false, 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits);
  end if;
  if v_state.test_coins < 3 then return jsonb_build_object('done', false, 'reason', 'not_enough', 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits); end if;
  insert into public.lab_calc_ops(student_id, op_id, kind, delta_coins, delta_credits) values (v, p_op, 'buy_play', -3, 1);
  update public.lab_calc_progress set test_coins = test_coins - 3, test_credits = test_credits + 1, updated_at = now() where student_id = v returning * into v_state;
  return jsonb_build_object('done', true, 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits);
end $$;

create function public.lab_student_use_play(p_token text, p_op uuid) returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v uuid; v_state public.lab_calc_progress; begin
  v := public.lab__require_student(p_token);
  if p_op is null then raise exception 'Données invalides'; end if;
  insert into public.lab_calc_progress(student_id) values (v) on conflict (student_id) do nothing;
  select * into v_state from public.lab_calc_progress where student_id = v for update;
  if exists (select 1 from public.lab_calc_ops where student_id = v and op_id = p_op) then
    return jsonb_build_object('done', false, 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits);
  end if;
  if v_state.test_credits < 1 then return jsonb_build_object('done', false, 'reason', 'no_play', 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits); end if;
  insert into public.lab_calc_ops(student_id, op_id, kind, delta_coins, delta_credits) values (v, p_op, 'use_play', 0, -1);
  update public.lab_calc_progress set test_credits = test_credits - 1, updated_at = now() where student_id = v returning * into v_state;
  return jsonb_build_object('done', true, 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits);
end $$;

-- ===== Enseignant =====
create function public.lab_teacher_settings_get() returns jsonb language plpgsql stable security definer set search_path to ''
as $$ begin
  if not public.lab__teacher_allowed() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((select settings from public.lab_calc_settings where teacher_id = auth.uid()), '{}'::jsonb);
end $$;

-- Seules les clés connues sont gardées, bornées : pass 50–100, questions 5–20, listes de niveaux (identifiants courts), voice booléen.
create function public.lab_teacher_settings_set(p_settings jsonb) returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v jsonb := '{}'::jsonb; k text; begin
  if not public.lab__teacher_allowed() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' or pg_catalog.octet_length(p_settings::text) > 4000 then raise exception 'Données invalides'; end if;
  if jsonb_typeof(p_settings->'pass') = 'number' then v := v || jsonb_build_object('pass', least(greatest((p_settings->>'pass')::numeric, 50), 100)::integer); end if;
  if jsonb_typeof(p_settings->'questions') = 'number' then v := v || jsonb_build_object('questions', least(greatest((p_settings->>'questions')::numeric, 5), 20)::integer); end if;
  if jsonb_typeof(p_settings->'voice') = 'boolean' then v := v || jsonb_build_object('voice', p_settings->'voice'); end if;
  foreach k in array array['nombres', 'addition', 'soustraction'] loop
    if jsonb_typeof(p_settings->'levels'->k) = 'array' then
      v := jsonb_set(v, '{levels}', coalesce(v->'levels', '{}'::jsonb) || jsonb_build_object(k,
        (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select distinct x from jsonb_array_elements_text(p_settings->'levels'->k) x where x ~ '^[a-z0-9_-]{1,20}$' limit 40) q)));
    end if;
  end loop;
  insert into public.lab_calc_settings(teacher_id, settings) values (auth.uid(), v)
    on conflict (teacher_id) do update set settings = excluded.settings, updated_at = now();
  return v;
end $$;

-- Résultats de calcul des élèves de l'enseignant (l'admin voit tous les élèves) — jamais mélangés aux résultats de lecture.
create function public.lab_teacher_results() returns jsonb language plpgsql stable security definer set search_path to ''
as $$ declare v_admin boolean; begin
  if not public.lab__teacher_allowed() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  v_admin := public.is_zoo_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('student_id', s.id, 'nickname', s.nickname, 'class_id', s.class_id, 'class_name', c.name,
      'progress', coalesce(p.progress, '{}'::jsonb)) order by c.name, s.nickname)
    from public.students s join public.classes c on c.id = s.class_id left join public.lab_calc_progress p on p.student_id = s.id
    where s.ghosted_at is null and (v_admin or s.teacher_id = auth.uid())), '[]'::jsonb);
end $$;

-- ===== Administration (réservée à l'admin, fonctionne même si le labo est désactivé) =====
create function public.lab_admin_state() returns jsonb language plpgsql stable security definer set search_path to ''
as $$ begin
  if auth.uid() is null or not public.is_zoo_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object('enabled', public.lab__enabled(),
    'access', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.subject_kind, 'subject_id', a.subject_id, 'scope', a.scope, 'note', a.note,
        'label', case when a.subject_kind = 'teacher' then (select coalesce(t.display_name, t.email) from public.teachers t where t.id = a.subject_id)
                      else (select s.nickname from public.students s where s.id = a.subject_id) end) order by a.created_at) from public.lab_access a), '[]'::jsonb),
    'teachers', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'label', coalesce(t.display_name, t.email)) order by coalesce(t.display_name, t.email)) from public.teachers t where t.ghosted_at is null), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'label', s.nickname, 'class_name', c.name) order by c.name, s.nickname)
        from (select * from public.students where ghosted_at is null order by created_at desc limit 500) s join public.classes c on c.id = s.class_id), '[]'::jsonb));
end $$;

create function public.lab_admin_grant(p_kind text, p_subject uuid, p_scope text default 'self', p_note text default null) returns uuid language plpgsql security definer set search_path to ''
as $$ declare v uuid; begin
  if auth.uid() is null or not public.is_zoo_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_kind not in ('teacher', 'student') or p_subject is null or p_scope not in ('self', 'self_and_students') or (p_kind = 'student' and p_scope <> 'self') then raise exception 'Données invalides'; end if;
  if (p_kind = 'teacher' and not exists (select 1 from public.teachers where id = p_subject)) or (p_kind = 'student' and not exists (select 1 from public.students where id = p_subject)) then raise exception 'Compte introuvable'; end if;
  insert into public.lab_access(subject_kind, subject_id, scope, note) values (p_kind, p_subject, p_scope, nullif(pg_catalog.left(btrim(p_note), 200), ''))
    on conflict (subject_kind, subject_id) do update set scope = excluded.scope, note = excluded.note returning id into v;
  return v;
end $$;

create function public.lab_admin_revoke(p_id uuid) returns void language plpgsql security definer set search_path to ''
as $$ begin
  if auth.uid() is null or not public.is_zoo_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  delete from public.lab_access where id = p_id;
end $$;

create function public.lab_admin_set_enabled(p_enabled boolean) returns void language plpgsql security definer set search_path to ''
as $$ begin
  if auth.uid() is null or not public.is_zoo_admin() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  insert into public.app_settings(key, value) values ('lab_calcul', jsonb_build_object('enabled', coalesce(p_enabled, false)))
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

-- ===== Droits d'exécution =====
revoke all on function public.lab_my_access(text), public.lab_student_state(text), public.lab_student_submit_round(text, uuid, text, text, integer, integer, jsonb),
  public.lab_student_buy_play(text, uuid), public.lab_student_use_play(text, uuid), public.lab_teacher_settings_get(), public.lab_teacher_settings_set(jsonb),
  public.lab_teacher_results(), public.lab_admin_state(), public.lab_admin_grant(text, uuid, text, text), public.lab_admin_revoke(uuid), public.lab_admin_set_enabled(boolean)
  from public, anon, authenticated;
grant execute on function public.lab_my_access(text), public.lab_student_state(text), public.lab_student_submit_round(text, uuid, text, text, integer, integer, jsonb),
  public.lab_student_buy_play(text, uuid), public.lab_student_use_play(text, uuid) to anon, authenticated;
grant execute on function public.lab_teacher_settings_get(), public.lab_teacher_settings_set(jsonb), public.lab_teacher_results(),
  public.lab_admin_state(), public.lab_admin_grant(text, uuid, text, text), public.lab_admin_revoke(uuid), public.lab_admin_set_enabled(boolean) to authenticated;
