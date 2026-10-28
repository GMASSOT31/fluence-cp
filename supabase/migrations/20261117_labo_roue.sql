-- Labo Zoo de Calcul : une roue à tourner quand une étape est MAÎTRISÉE (2e étoile = 2 séries réussies de la même étape).
-- * Roues gagnées = nombre d'étapes maîtrisées (progress.levels.*.ok >= 2) ; roues utilisées = lab_calc_progress.wheels_used. Rien à modifier dans lab_student_submit_round.
-- * Les roues déjà « gagnées » avant cette migration sont considérées comme utilisées (pas de cadeau rétroactif).
-- * lab_student_spin_wheel(p_token) : sous verrou de ligne, retire une roue, tire la case AU SERVEUR (anti-triche) et crédite des pièces
--   (vrai portefeuille via pending_coins si « shared_wallet », sinon pièces de test). Aucune suppression nulle part.
-- * lab_student_state renvoie en plus « wheels » (roues à tourner).
alter table public.lab_calc_progress add column wheels_used integer not null default 0 check (wheels_used >= 0 and wheels_used <= 1000);

create function public.lab__wheels_earned(p jsonb) returns integer language sql immutable set search_path to ''
as $$ select coalesce((select count(*)::integer from jsonb_each(case when jsonb_typeof(p->'levels') = 'object' then p->'levels' else '{}'::jsonb end) l
        where jsonb_typeof(l.value) = 'object' and coalesce(l.value->>'ok', '') ~ '^[0-9]{1,6}$' and (l.value->>'ok')::integer >= 2), 0) $$;
revoke all on function public.lab__wheels_earned(jsonb) from public, anon, authenticated;

update public.lab_calc_progress set wheels_used = least(public.lab__wheels_earned(progress), 1000);

create or replace function public.lab_student_state(p_token text) returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v uuid; v_row public.lab_calc_progress; v_set jsonb; begin
  v := public.lab__require_student(p_token);
  select * into v_row from public.lab_calc_progress where student_id = v;
  select cs.settings into v_set from public.lab_calc_settings cs join public.students s on s.teacher_id = cs.teacher_id where s.id = v;
  return jsonb_build_object('progress', coalesce(v_row.progress, '{}'::jsonb), 'test_coins', coalesce(v_row.test_coins, 0),
    'test_credits', coalesce(v_row.test_credits, 0), 'settings', coalesce(v_set, '{}'::jsonb),
    'wheels', greatest(0, public.lab__wheels_earned(coalesce(v_row.progress, '{}'::jsonb)) - coalesce(v_row.wheels_used, 0)));
end $$;

create function public.lab_student_spin_wheel(p_token text) returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v uuid; v_state public.lab_calc_progress; v_slice integer; v_coins integer; v_shared boolean := false; v_left integer;
  v_prizes integer[] := array[1, 2, 1, 3, 5, 2, 10, 3];   -- 8 cases (même nombre que la roue du Zoo de Lecture)
begin
  v := public.lab__require_student(p_token);
  insert into public.lab_calc_progress(student_id) values (v) on conflict (student_id) do nothing;
  select * into v_state from public.lab_calc_progress where student_id = v for update;   -- une roue à la fois, jamais deux fois la même
  if public.lab__wheels_earned(v_state.progress) - v_state.wheels_used <= 0 then raise exception 'Aucune roue à tourner'; end if;
  v_slice := floor(random() * 8)::integer; v_coins := v_prizes[v_slice + 1];
  if public.lab__shared_wallet() then
    insert into public.student_progress(student_id, teacher_id, progress, sync_version, pending_coins)
      select v, s.teacher_id, '{}'::jsonb, 0, v_coins from public.students s where s.id = v
      on conflict (student_id) do update set pending_coins = least(public.student_progress.pending_coins + v_coins, 10000);
    v_shared := true;
  end if;
  update public.lab_calc_progress set wheels_used = wheels_used + 1, test_coins = least(test_coins + case when v_shared then 0 else v_coins end, 100000), updated_at = now()
    where student_id = v returning * into v_state;
  v_left := greatest(0, public.lab__wheels_earned(v_state.progress) - v_state.wheels_used);
  return jsonb_build_object('slice', v_slice, 'coins', v_coins, 'shared', v_shared, 'wheels', v_left, 'test_coins', v_state.test_coins);
end $$;
revoke all on function public.lab_student_spin_wheel(text) from public;
grant execute on function public.lab_student_spin_wheel(text) to anon, authenticated;
