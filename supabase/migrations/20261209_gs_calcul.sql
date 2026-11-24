-- Parcours GS du Zoo de Calcul (étape E, docs/parcours-gs/avancement.md) — 24/11/2026
-- 1. lab_student_submit_round accepte l'activité « gs » : niveau = clé du palier (« chiffres-r1-2 », « collec-r3 », « compare-eq ») ou « rituel ».
--    Une série GS est rangée dans lab_calc_progress.progress.gs[clé] = {r, q, c, h, n, ok, ko, aid, val, last} avec la règle du parcours GS
--    (palier validé après `series` séries réussies d'affilée sans aide ; 2 ratées d'affilée → aide ; une série aidée ne valide jamais),
--    seuil et séries lus dans les réglages de l'enseignant (teacher_zoo_settings.settings.gs.calcul, comme le reste du parcours GS).
--    Pas de pièces pour une série GS (comme le GS Lecture) ; une roue par série réussie : progress.gsw (une seule fois par round_id).
--    progress.gsh = 60 dernières séries GS ; progress.hist reçoit aussi la série (clé « gs:… ») pour « dernière venue ». progress.gsr = date de la comptine.
--    Les séries CP (nombres, addition, soustraction) sont traitées exactement comme avant.
-- 2. lab__wheels_earned compte aussi progress.gsw (0 pour tous les élèves existants : aucune roue nouvelle).
-- 3. admin_set_class_pedagogy copie aussi « gs » (réglages GS Lecture et Calcul) quand l'admin applique ses réglages de lecture à une classe.
-- Retour arrière : réappliquer les définitions précédentes (20261203_pedagogie_par_classe.sql et 20261129_labo_roue_chaque_etoile.sql) ; les clés gs* restent inertes.

create or replace function public.lab__wheels_earned(p jsonb) returns integer
language sql immutable set search_path to '' as $$
  select coalesce((select sum(case when (l.value->>'ok')::integer >= 2 then 2 else 1 end)::integer
        from jsonb_each(case when jsonb_typeof(p->'levels') = 'object' then p->'levels' else '{}'::jsonb end) l
        where jsonb_typeof(l.value) = 'object' and coalesce(l.value->>'ok', '') ~ '^[0-9]{1,6}$' and (l.value->>'ok')::integer >= 1), 0)
    + case when coalesce(p->>'gsw', '') ~ '^[0-9]{1,6}$' then (p->>'gsw')::integer else 0 end
$$;

-- Série GS (appelée par lab_student_submit_round, ligne de l'élève déjà verrouillée et round_id déjà vérifié)
create or replace function public.lab__gs_round(v uuid, p_round uuid, p_level text, p_correct integer, p_total integer, p_stats jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_comp text := split_part(p_level, '-', 1); v_cfg jsonb; v_pass integer := 80; v_need integer := 2; v_ok boolean; v_aid boolean; v_was boolean;
  v_prog jsonb; v_gs jsonb; v_cur jsonb; v_new jsonb; v_gsh jsonb; v_hist jsonb; v_okn integer; v_ko integer; v_val text; v_validated boolean := false;
  v_h integer; v_now text := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF'); v_state public.lab_calc_progress;
begin
  select * into v_state from public.lab_calc_progress where student_id = v;
  v_prog := coalesce(v_state.progress, '{}'::jsonb);
  if p_level = 'rituel' then   -- comptine numérique : ne valide rien, pas de roue ; on retient seulement la date
    insert into public.lab_calc_rounds(student_id, round_id, activity, level, correct, total, coins) values (v, p_round, 'gs', p_level, 0, p_total, 0);
    update public.lab_calc_progress set progress = jsonb_set(v_prog, '{gsr}', to_jsonb(v_now)), updated_at = now() where student_id = v;
    return jsonb_build_object('inserted', true, 'coins', 0, 'success', false, 'rituel', v_now);
  end if;
  if v_comp not in ('chiffres', 'ordre', 'denombre', 'compare', 'collec') or p_level !~ '^[a-z]+-[a-z0-9-]{1,14}$' then
    raise exception 'Données invalides';
  end if;
  v_gs := case when jsonb_typeof(v_prog->'gs') = 'object' then v_prog->'gs' else '{}'::jsonb end;
  if not (v_gs ? p_level) and (select count(*) from jsonb_object_keys(v_gs)) >= 80 then raise exception 'Données invalides'; end if;
  -- réglages de l'enseignant (ou de la classe si l'admin lui a appliqué les siens), mêmes bornes que gs-data.js calcConfig
  select coalesce(public.zoo__reading_settings(s.teacher_id), '{}'::jsonb) || coalesce(cp.settings, '{}'::jsonb) into v_cfg
    from public.students s left join public.zoo_class_pedagogy cp on cp.class_id = s.class_id and cp.subject = 'lecture' where s.id = v;
  v_cfg := case when jsonb_typeof(v_cfg->'gs'->'calcul'->v_comp) = 'object' then v_cfg->'gs'->'calcul'->v_comp else '{}'::jsonb end;
  if coalesce(v_cfg->>'seuil', '') ~ '^[0-9]{1,3}$' and (v_cfg->>'seuil')::integer between 50 and 100 then v_pass := (v_cfg->>'seuil')::integer; end if;
  if coalesce(v_cfg->>'series', '') ~ '^[0-9]$' and (v_cfg->>'series')::integer between 1 and 4 then v_need := (v_cfg->>'series')::integer; end if;
  v_ok := p_correct * 100 >= v_pass * p_total;
  v_h := least(greatest(coalesce((p_stats->>'helps')::integer, 0), 0), 500);
  v_cur := case when jsonb_typeof(v_gs->p_level) = 'object' then v_gs->p_level else '{}'::jsonb end;
  v_okn := case when coalesce(v_cur->>'ok', '') ~ '^[0-9]{1,2}$' then (v_cur->>'ok')::integer else 0 end;
  v_ko := case when coalesce(v_cur->>'ko', '') ~ '^[0-9]{1,3}$' then (v_cur->>'ko')::integer else 0 end;
  v_val := nullif(v_cur->>'val', '');
  v_was := coalesce(v_cur->>'aid', '') = 'true' or coalesce(p_stats->>'aid', '') = 'true';
  v_aid := v_was;
  if v_val is null then
    if v_was then
      if v_ok then v_aid := false; v_ko := 0; end if;            -- une série aidée réussie : retour au niveau normal, jamais de validation
    elsif v_ok then
      v_ko := 0; v_okn := v_okn + 1;
      if v_okn >= v_need then v_val := v_now; v_okn := 0; v_validated := true; end if;
    else
      v_okn := 0; v_ko := least(v_ko + 1, 99);
      if v_ko >= 2 then v_aid := true; end if;
    end if;
  end if;
  v_new := jsonb_build_object('r', coalesce((v_cur->>'r')::integer, 0) + 1, 'q', coalesce((v_cur->>'q')::integer, 0) + p_total,
    'c', coalesce((v_cur->>'c')::integer, 0) + p_correct, 'h', coalesce((v_cur->>'h')::integer, 0) + v_h,
    'n', coalesce((v_cur->>'n')::integer, 0) + case when v_ok then 1 else 0 end, 'ok', v_okn, 'ko', v_ko, 'aid', v_aid, 'last', v_now)
    || case when v_val is null then '{}'::jsonb else jsonb_build_object('val', v_val) end;
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into v_gsh from (
    select e, o from jsonb_array_elements(case when jsonb_typeof(v_prog->'gsh') = 'array' then v_prog->'gsh' else '[]'::jsonb end || jsonb_build_array(
      jsonb_build_object('t', v_now, 'k', p_level, 'c', p_correct, 'n', p_total, 'ok', v_ok, 'aid', v_was, 'th', v_pass))) with ordinality t(e, o)
    order by o desc limit 60) s;
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into v_hist from (
    select e, o from jsonb_array_elements(coalesce(v_prog->'hist', '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('t', v_now, 'k', 'gs:' || p_level, 'c', p_correct, 'n', p_total, 'ok', v_ok))) with ordinality t(e, o)
    order by o desc limit 30) s;
  insert into public.lab_calc_rounds(student_id, round_id, activity, level, correct, total, coins) values (v, p_round, 'gs', p_level, p_correct, p_total, 0);
  v_prog := v_prog || jsonb_build_object('gs', v_gs || jsonb_build_object(p_level, v_new), 'gsh', v_gsh, 'hist', v_hist,
    'gsw', case when coalesce(v_prog->>'gsw', '') ~ '^[0-9]{1,6}$' then (v_prog->>'gsw')::integer else 0 end + case when v_ok then 1 else 0 end);
  update public.lab_calc_progress set progress = v_prog, updated_at = now() where student_id = v returning * into v_state;
  return jsonb_build_object('inserted', true, 'coins', 0, 'success', v_ok, 'validated', v_validated, 'gs', v_new,
    'wheels', greatest(0, public.lab__wheels_earned(v_state.progress) - coalesce(v_state.wheels_used, 0)),
    'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits);
end $$;
revoke all on function public.lab__gs_round(uuid, uuid, text, integer, integer, jsonb) from public, anon, authenticated;

-- Définition en ligne au 24/11/2026 (pg_get_functiondef), seules modifications : « gs » accepté, et renvoi vers lab__gs_round après l'anti-rejeu.
CREATE OR REPLACE FUNCTION public.lab_student_submit_round(p_token text, p_round uuid, p_activity text, p_level text, p_correct integer, p_total integer, p_stats jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v uuid; v_prog jsonb; v_cur jsonb; v_key text; v_pass integer; v_ok boolean; v_coins integer := 0; v_today integer; v_new jsonb; v_ins integer;
  v_rp integer; v_h integer; v_ms integer; v_state public.lab_calc_progress; v_hist jsonb; v_nums jsonb; v_calcs jsonb; x text; v_shared boolean := false;
begin
  v := public.lab__require_student(p_token);
  if p_round is null or p_activity not in ('nombres', 'addition', 'soustraction', 'gs') or p_level !~ '^[a-z0-9_-]{1,20}$'
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
  if p_activity = 'gs' then return public.lab__gs_round(v, p_round, p_level, p_correct, p_total, p_stats); end if;   -- parcours GS (20261209)
  select least(greatest(coalesce((public.zoo__calculation_settings(s.teacher_id,s.class_id)->>'pass')::integer, 80), 50), 100) into v_pass
    from public.students s where s.id = v;
  v_pass := coalesce(v_pass, 80);
  v_ok := p_correct * 100 >= v_pass * p_total;
  select count(*) into v_today from public.lab_calc_rounds
    where student_id = v and coins > 0 and (created_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date;
  if v_ok and p_total >= 5 and v_today < 10 then v_coins := case when p_correct = p_total then 2 else 1 end; end if;
  insert into public.lab_calc_rounds(student_id, round_id, activity, level, correct, total, coins) values (v, p_round, p_activity, p_level, p_correct, p_total, v_coins);
  -- Monnaie commune : si l'interrupteur « shared_wallet » est activé, les pièces gagnées en calcul vont dans le vrai portefeuille de l'élève
  -- (colonne pending_coins, reprise ensuite par student_claim_coins comme un cadeau). Le tour étant enregistré une seule fois (round_id),
  -- un tour rejoué ne crédite jamais deux fois. Sans l'interrupteur, les pièces restent des pièces de TEST (lab_calc_progress.test_coins).
  if v_coins > 0 and public.lab__shared_wallet() then
    insert into public.student_progress(student_id, teacher_id, progress, sync_version, pending_coins)
      select v, s.teacher_id, '{}'::jsonb, 0, v_coins from public.students s where s.id = v
      on conflict (student_id) do update set pending_coins = least(public.student_progress.pending_coins + v_coins, 10000);
    v_shared := true;
  end if;
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
  update public.lab_calc_progress set progress = v_prog, test_coins = test_coins + case when v_shared then 0 else v_coins end, updated_at = now() where student_id = v
    returning * into v_state;
  return jsonb_build_object('inserted', true, 'coins', v_coins, 'shared', v_shared, 'success', v_ok, 'level', v_new, 'test_coins', v_state.test_coins, 'test_credits', v_state.test_credits);
end $function$;

-- Définition en ligne au 24/11/2026, seule modification : « gs » (réglages des parcours GS) fait partie de la copie de lecture appliquée à une classe.
CREATE OR REPLACE FUNCTION public.admin_set_class_pedagogy(p_class uuid, p_subject text, p_apply boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare snapshot jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_zoo_admin(), false) then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_subject is null or p_subject not in ('lecture','calcul') or p_apply is null then raise exception 'Réglage inconnu'; end if;
  if not exists(select 1 from public.classes where id = p_class and ghosted_at is null) then raise exception 'Classe introuvable'; end if;
  if not p_apply then
    delete from public.zoo_class_pedagogy where class_id = p_class and subject = p_subject;
    return;
  end if;
  if p_subject = 'lecture' then
    snapshot := '{"thr":{"s":25,"m":20,"t":15},"lock":true,"texts":{},"sounds":[],"listenCfg":{},"dictee":{},"comprehension":{},"gs":{}}'::jsonb
      || coalesce((select jsonb_object_agg(k,v)
        from jsonb_each(public.zoo__reading_settings(auth.uid())) e(k,v)
        where k in ('thr','lock','texts','sounds','listenCfg','dictee','comprehension','gs')), '{}'::jsonb);
  else
    snapshot := '{"questions":10,"pass":80,"voice":true,"levels":{}}'::jsonb
      || public.zoo__calculation_settings(auth.uid(), null);
  end if;
  insert into public.zoo_class_pedagogy(class_id,subject,settings) values (p_class,p_subject,snapshot)
    on conflict (class_id,subject) do update set settings = excluded.settings;
end $function$;
