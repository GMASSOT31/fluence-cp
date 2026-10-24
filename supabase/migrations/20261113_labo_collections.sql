-- Labo calcul : « Mes nombres lus » et « Mes calculs gagnés ». Remplace UNIQUEMENT lab_student_submit_round (fonction du labo, créée par 20261112).
-- Ajoute à lab_calc_progress.progress deux compteurs : nums {"73": 2} (nombres reconnus du premier coup) et calcs {"7+5": 1} (calculs gagnés du premier coup).
-- Rien d'autre ne change : mêmes règles de pièces de test, mêmes contrôles, mêmes droits d'exécution.
create or replace function public.lab_student_submit_round(p_token text, p_round uuid, p_activity text, p_level text, p_correct integer, p_total integer, p_stats jsonb default '{}'::jsonb)
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v uuid; v_prog jsonb; v_cur jsonb; v_key text; v_pass integer; v_ok boolean; v_coins integer := 0; v_today integer; v_new jsonb; v_ins integer;
  v_rp integer; v_h integer; v_ms integer; v_state public.lab_calc_progress; v_hist jsonb; v_nums jsonb; v_calcs jsonb; x text;
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
  -- Collections « nombres reconnus » et « calculs gagnés » : au plus autant d'éléments que de bonnes réponses du premier coup,
  -- nombres de 0 à 100, calculs « a+b » / « a-b » cohérents avec l'activité (le résultat n'est jamais envoyé : il se déduit de a et b).
  v_nums := case when jsonb_typeof(v_prog->'nums') = 'object' then v_prog->'nums' else '{}'::jsonb end;
  v_calcs := case when jsonb_typeof(v_prog->'calcs') = 'object' then v_prog->'calcs' else '{}'::jsonb end;
  if p_activity = 'nombres' and jsonb_typeof(p_stats->'nums') = 'array' and jsonb_array_length(p_stats->'nums') <= p_correct then
    for x in select jsonb_array_elements_text(p_stats->'nums') loop
      if x ~ '^[0-9]{1,3}$' and x::integer <= 100 then v_nums := v_nums || jsonb_build_object(x, least(coalesce((v_nums->>x)::integer, 0) + 1, 99)); end if;
    end loop;
  elsif p_activity <> 'nombres' and jsonb_typeof(p_stats->'calcs') = 'array' and jsonb_array_length(p_stats->'calcs') <= p_correct then
    for x in select jsonb_array_elements_text(p_stats->'calcs') loop
      if x ~ '^[0-9]{1,3}[+-][0-9]{1,3}$' and ((p_activity = 'addition' and x ~ '[+]') or (p_activity = 'soustraction' and x ~ '[-]'))
         and (v_calcs ? x or (select count(*) from jsonb_object_keys(v_calcs)) < 400) then
        v_calcs := v_calcs || jsonb_build_object(x, least(coalesce((v_calcs->>x)::integer, 0) + 1, 99));
      end if;
    end loop;
  end if;
  v_prog := jsonb_set(jsonb_set(jsonb_set(jsonb_set(v_prog, '{nums}', v_nums), '{calcs}', v_calcs), '{levels}', coalesce(v_prog->'levels', '{}'::jsonb) || jsonb_build_object(v_key, v_new)), '{hist}', v_hist);
  update public.lab_calc_progress set progress = v_prog, test_coins = test_coins + v_coins, updated_at = now() where student_id = v
    returning * into v_state;
  return jsonb_build_object('inserted', true, 'coins', v_coins, 'success', v_ok, 'level', v_new, 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits);
end $$;
