-- Les nouveaux enseignants reçoivent une copie du modèle au moment de l’inscription.
-- Une classe peut recevoir une copie manuelle qui prime sur le réglage de son enseignant.
create table public.zoo_pedagogy_defaults (
  teacher_id uuid primary key references public.teachers(id) on delete cascade,
  reading jsonb not null default '{}',
  calculation jsonb not null default '{}'
);
create table public.zoo_class_pedagogy (
  class_id uuid not null references public.classes(id) on delete cascade,
  subject text not null check (subject in ('lecture', 'calcul')),
  settings jsonb not null,
  primary key (class_id, subject)
);
alter table public.zoo_pedagogy_defaults enable row level security;
alter table public.zoo_class_pedagogy enable row level security;
revoke all on public.zoo_pedagogy_defaults, public.zoo_class_pedagogy from public, anon, authenticated;

create function public.zoo__pedagogy_model(p_subject text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when p_subject = 'lecture' then
    coalesce((select value from public.app_settings where key = 'exo_defaults'), '{}'::jsonb)
    || jsonb_build_object('comprehension',
      coalesce((select value from public.app_settings where key = 'comprehension_exercises'), '{}'::jsonb))
    else coalesce((select value from public.app_settings where key = 'calc_pedagogy_defaults'), '{}'::jsonb) end
$$;

lock table public.teachers in share row exclusive mode;

insert into public.zoo_pedagogy_defaults(teacher_id, reading, calculation)
select id, public.zoo__pedagogy_model('lecture'), '{}'::jsonb from public.teachers;

-- Le modèle des prochaines inscriptions reprend les réglages admin déjà enregistrés.
insert into public.app_settings(key,value,updated_at)
select 'calc_pedagogy_defaults', cs.settings, now()
from public.lab_calc_settings cs join public.teachers t on t.id = cs.teacher_id
where t.role = 'admin' order by cs.updated_at desc limit 1
on conflict (key) do nothing;

insert into public.app_settings(key,value,updated_at)
select 'exo_defaults', public.zoo__pedagogy_model('lecture') - 'comprehension'
  || coalesce((select jsonb_object_agg(k,v) from jsonb_each(ts.settings) e(k,v)
    where k in ('thr','lock')), '{}'::jsonb), now()
from public.teacher_zoo_settings ts join public.teachers t on t.id = ts.teacher_id
where t.role = 'admin' order by ts.updated_at desc limit 1
on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;

create function public.zoo__freeze_pedagogy_model() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.zoo_pedagogy_defaults(teacher_id, reading, calculation)
    values (new.id, public.zoo__pedagogy_model('lecture'), public.zoo__pedagogy_model('calcul'));
  return new;
end $$;
create trigger zoo_freeze_pedagogy_model after insert on public.teachers
for each row execute function public.zoo__freeze_pedagogy_model();

create function public.zoo__publish_calculation_model() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.teachers t where t.id = new.teacher_id and t.role = 'admin') then
    insert into public.app_settings(key,value,updated_at)
      values ('calc_pedagogy_defaults',new.settings,now())
      on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  end if;
  return new;
end $$;
create trigger zoo_publish_calculation_model after insert or update of settings on public.lab_calc_settings
for each row execute function public.zoo__publish_calculation_model();

create or replace function public.get_exo_defaults() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.is_zoo_admin() then public.zoo__pedagogy_model('lecture')
    else coalesce((select reading from public.zoo_pedagogy_defaults where teacher_id = auth.uid()), '{}'::jsonb) end
  where auth.uid() is not null
$$;

create function public.zoo__reading_settings(p_teacher uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when t.role = 'admin' then public.zoo__pedagogy_model('lecture')
    else coalesce(d.reading, '{}'::jsonb) end
    || coalesce((
      select jsonb_object_agg(k, v) from jsonb_each(coalesce(ts.settings, '{}'::jsonb)) e(k,v)
      where k not in ('texts','sounds','listenCfg','dictee') or v not in ('{}'::jsonb,'[]'::jsonb,'null'::jsonb)
    ), '{}'::jsonb)
  from public.teachers t
  left join public.zoo_pedagogy_defaults d on d.teacher_id = t.id
  left join public.teacher_zoo_settings ts on ts.teacher_id = t.id
  where t.id = p_teacher
$$;

create function public.zoo__calculation_settings(p_teacher uuid, p_class uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(d.calculation, '{}'::jsonb) || coalesce(cs.settings, '{}'::jsonb)
    || coalesce(cp.settings, '{}'::jsonb)
  from public.teachers t
  left join public.zoo_pedagogy_defaults d on d.teacher_id = t.id
  left join public.lab_calc_settings cs on cs.teacher_id = t.id
  left join public.zoo_class_pedagogy cp on cp.class_id = p_class and cp.subject = 'calcul'
  where t.id = p_teacher
$$;

create or replace function public.student_get_teacher_settings(p_token text) returns jsonb
language sql security definer set search_path = '' as $$
  select coalesce(public.zoo__reading_settings(s.teacher_id), '{}'::jsonb) || coalesce(cp.settings, '{}'::jsonb)
  from public.student_sessions ss join public.students s on s.id = ss.student_id
  left join public.zoo_class_pedagogy cp on cp.class_id = s.class_id and cp.subject = 'lecture'
  where ss.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and ss.expires_at > now()
  limit 1
$$;

create or replace function public.lab_teacher_settings_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.lab__teacher_allowed() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce(public.zoo__calculation_settings(auth.uid(), null), '{}'::jsonb);
end $$;

create function public.admin_set_class_pedagogy(p_class uuid, p_subject text, p_apply boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
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
    snapshot := '{"thr":{"s":25,"m":20,"t":15},"lock":true,"texts":{},"sounds":[],"listenCfg":{},"dictee":{},"comprehension":{}}'::jsonb
      || coalesce((select jsonb_object_agg(k,v)
        from jsonb_each(public.zoo__reading_settings(auth.uid())) e(k,v)
        where k in ('thr','lock','texts','sounds','listenCfg','dictee','comprehension')), '{}'::jsonb);
  else
    snapshot := '{"questions":10,"pass":80,"voice":true,"levels":{}}'::jsonb
      || public.zoo__calculation_settings(auth.uid(), null);
  end if;
  insert into public.zoo_class_pedagogy(class_id,subject,settings) values (p_class,p_subject,snapshot)
    on conflict (class_id,subject) do update set settings = excluded.settings;
end $$;

revoke all on function public.zoo__pedagogy_model(text), public.zoo__freeze_pedagogy_model(),
  public.zoo__publish_calculation_model(), public.zoo__reading_settings(uuid), public.zoo__calculation_settings(uuid,uuid)
from public, anon, authenticated;
revoke all on function public.admin_set_class_pedagogy(uuid,text,boolean) from public, anon;
grant execute on function public.admin_set_class_pedagogy(uuid,text,boolean) to authenticated;

create or replace function public.lab_student_state(p_token text) returns jsonb language plpgsql security definer set search_path to ''
as $$ declare v uuid; v_row public.lab_calc_progress; v_set jsonb; begin
  v := public.lab__require_student(p_token);
  select * into v_row from public.lab_calc_progress where student_id = v;
  select public.zoo__calculation_settings(s.teacher_id,s.class_id) into v_set from public.students s where s.id = v;
  return jsonb_build_object('progress', coalesce(v_row.progress, '{}'::jsonb), 'test_coins', coalesce(v_row.test_coins, 0),
    'test_credits', coalesce(v_row.test_credits, 0), 'settings', coalesce(v_set, '{}'::jsonb),
    'wheels', greatest(0, public.lab__wheels_earned(coalesce(v_row.progress, '{}'::jsonb)) - coalesce(v_row.wheels_used, 0)));
end $$;

create or replace function public.lab_student_submit_round(p_token text, p_round uuid, p_activity text, p_level text, p_correct integer, p_total integer, p_stats jsonb default '{}'::jsonb)
 returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v uuid; v_prog jsonb; v_cur jsonb; v_key text; v_pass integer; v_ok boolean; v_coins integer := 0; v_today integer; v_new jsonb; v_ins integer;
  v_rp integer; v_h integer; v_ms integer; v_state public.lab_calc_progress; v_hist jsonb; v_nums jsonb; v_calcs jsonb; x text; v_shared boolean := false;
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
end $$;
create or replace function public.lab__complete_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.total > 0 then
    update public.lab_calc_assignments a
    set completed_at = new.created_at
    from public.students s
    where a.student_id = new.student_id and s.id = new.student_id and s.teacher_id = a.teacher_id
      and a.activity = new.activity and a.level = new.level
      and a.completed_at is null and new.created_at >= a.assigned_at
      and new.correct * 100 >= new.total * least(greatest(coalesce((public.zoo__calculation_settings(s.teacher_id,s.class_id)->>'pass')::integer, 80), 50), 100);
  end if;
  return new;
end $$;
