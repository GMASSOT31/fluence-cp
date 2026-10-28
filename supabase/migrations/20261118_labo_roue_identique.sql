-- Labo Zoo de Calcul : la roue du calcul a EXACTEMENT les 8 cases de la roue du Zoo de Lecture
--   (1 jeu, 5 pièces, 2 jeux, 1 jeu, 10 pièces, 3 jeux, 1 jeu, 2 jeux). Les « parties de jeu » ne vivent pas dans une colonne :
--   elles sont dans student_progress.progress->'credits'. Comme pour les pièces (pending_coins), un gain venu du calcul attend donc
--   dans pending_credits et est repris par student_claim_credits avec le contrôle de version de la sauvegarde (aucun conflit avec une session ouverte).
-- * student_progress.pending_credits : parties de jeu en attente (0 à 1000).
-- * student_claim_credits(p_token, p_version) : même principe que student_claim_coins (qui n'est PAS modifiée).
-- * lab_student_spin_wheel : même signature, mêmes garde-fous (verrou de ligne, tirage au serveur, une roue à la fois) ; renvoie en plus
--   « kind » ('plays' | 'coins') et « plays » ; « coins » vaut 0 quand le lot est une partie de jeu. Hors monnaie commune : pièces et parties de TEST
--   (test_coins / test_credits). Aucune suppression nulle part.
alter table public.student_progress add column if not exists pending_credits integer not null default 0 check (pending_credits between 0 and 1000);

create function public.student_claim_credits(p_token text, p_version bigint) returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v_student uuid; v_pending integer; v_version bigint; v_progress jsonb; v_credits integer;
begin
  select ss.student_id into v_student from public.student_sessions ss
   where ss.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and ss.expires_at > now();
  if v_student is null then raise exception 'Session expirée'; end if;
  select pending_credits, sync_version, progress into v_pending, v_version, v_progress
    from public.student_progress where student_id = v_student for update;
  if not found or v_pending = 0 then
    return jsonb_build_object('claimed', 0, 'version', coalesce(v_version, 0));
  end if;
  if v_version is distinct from p_version then raise exception 'SYNC_CONFLICT'; end if;
  v_credits := case when jsonb_typeof(v_progress->'credits') = 'number'
                    then floor((v_progress->>'credits')::numeric)::int else 0 end + v_pending;
  update public.student_progress
     set progress = progress || jsonb_build_object('credits', v_credits), pending_credits = 0, sync_version = sync_version + 1
   where student_id = v_student
  returning sync_version into v_version;
  return jsonb_build_object('claimed', v_pending, 'credits', v_credits, 'version', v_version);
end $$;
revoke all on function public.student_claim_credits(text, bigint) from public;
grant execute on function public.student_claim_credits(text, bigint) to anon, authenticated;

create or replace function public.lab_student_spin_wheel(p_token text) returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v uuid; v_state public.lab_calc_progress; v_slice integer; v_n integer; v_plays boolean; v_shared boolean := false; v_left integer;
  v_kinds boolean[] := array[true, false, true, true, false, true, true, true];   -- true = parties de jeu, false = pièces d'or
  v_amounts integer[] := array[1, 5, 2, 1, 10, 3, 1, 2];                            -- mêmes 8 cases que SLICES dans zoo-connecte.html
begin
  v := public.lab__require_student(p_token);
  insert into public.lab_calc_progress(student_id) values (v) on conflict (student_id) do nothing;
  select * into v_state from public.lab_calc_progress where student_id = v for update;   -- une roue à la fois, jamais deux fois la même
  if public.lab__wheels_earned(v_state.progress) - v_state.wheels_used <= 0 then raise exception 'Aucune roue à tourner'; end if;
  v_slice := floor(random() * 8)::integer; v_plays := v_kinds[v_slice + 1]; v_n := v_amounts[v_slice + 1];
  if public.lab__shared_wallet() then
    if v_plays then
      insert into public.student_progress(student_id, teacher_id, progress, sync_version, pending_credits)
        select v, s.teacher_id, '{}'::jsonb, 0, v_n from public.students s where s.id = v
        on conflict (student_id) do update set pending_credits = least(public.student_progress.pending_credits + v_n, 1000);
    else
      insert into public.student_progress(student_id, teacher_id, progress, sync_version, pending_coins)
        select v, s.teacher_id, '{}'::jsonb, 0, v_n from public.students s where s.id = v
        on conflict (student_id) do update set pending_coins = least(public.student_progress.pending_coins + v_n, 10000);
    end if;
    v_shared := true;
  end if;
  update public.lab_calc_progress set wheels_used = wheels_used + 1,
      test_coins = least(test_coins + case when v_shared or v_plays then 0 else v_n end, 100000),
      test_credits = least(test_credits + case when v_shared or not v_plays then 0 else v_n end, 1000), updated_at = now()
    where student_id = v returning * into v_state;
  v_left := greatest(0, public.lab__wheels_earned(v_state.progress) - v_state.wheels_used);
  return jsonb_build_object('slice', v_slice, 'kind', case when v_plays then 'plays' else 'coins' end, 'coins', case when v_plays then 0 else v_n end,
    'plays', case when v_plays then v_n else 0 end, 'shared', v_shared, 'wheels', v_left, 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits);
end $$;
