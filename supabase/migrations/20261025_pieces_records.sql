-- Pièces des jeux : record personnel battu = 3 pièces, record absolu de la classe = 10 pièces (au lieu de 1 et 5).
-- Un premier score n'est pas un record battu : 0 pièce côté serveur (la pièce de l'objectif du jeu reste donnée par le Zoo).
-- Le Zoo garde la plus haute récompense seulement (1, 3 ou 10, jamais additionnées).
-- Recrée student_submit_score à l'identique, seule la ligne v_gain change.

create or replace function public.student_submit_score(p_token text, p_game text, p_value numeric, p_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid; v_teacher uuid; v_class uuid; v_mode text; v_lo numeric; v_hi numeric;
  v_progress jsonb; v_version bigint; v_old jsonb; v_prev numeric; v_better boolean;
  v_count int; v_abs_val numeric; v_abs_nick text; v_abs_avatar text; v_abs_mine boolean;
  v_absolute boolean := false; v_gain int := 0; v_coins int; v_entry jsonb;
begin
  select s.id, s.teacher_id, s.class_id into v_student, v_teacher, v_class
  from public.student_sessions ss join public.students s on s.id = ss.student_id
  where ss.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and ss.expires_at > now();
  if v_student is null then raise exception 'Session expirée'; end if;

  select g.mode, g.lo, g.hi into v_mode, v_lo, v_hi from (values
    ('memory', 'min', 6, 500), ('order', 'min', 0, 600), ('safari', 'min', 1, 600000),
    ('catch', 'max', 0, 200), ('count', 'max', 0, 6000), ('simon', 'max', 0, 12),
    ('stack', 'max', 0, 200), ('ballons', 'max', 0, 200), ('snake', 'max', 0, 200)) g(id, mode, lo, hi)
  where g.id = p_game;
  if v_mode is null then raise exception 'Jeu inconnu'; end if;
  if p_value is null or p_value <> trunc(p_value) or p_value < v_lo or p_value > v_hi then
    raise exception 'Score invalide';
  end if;

  -- un seul « record absolu » à la fois par classe et par jeu
  perform pg_advisory_xact_lock(hashtextextended(v_class::text || ':' || p_game, 0));

  select progress, sync_version into v_progress, v_version
  from public.student_progress where student_id = v_student for update;
  if not found then
    if coalesce(p_version, 0) <> 0 then raise exception 'SYNC_CONFLICT'; end if;
    v_progress := '{}'::jsonb; v_version := 0;
  elsif v_version is distinct from p_version then
    raise exception 'SYNC_CONFLICT';
  end if;

  v_old := v_progress->'hi'->p_game;
  v_prev := case when jsonb_typeof(v_old->'best') = 'number' then (v_old->>'best')::numeric end;
  v_better := case when v_prev is null then (v_mode = 'min' or p_value > 0)
                   when v_mode = 'min' then p_value < v_prev
                   else p_value > v_prev end;

  -- record de la classe AVANT ce score (même règle que student_get_class_records)
  select count(*) into v_count from public.students where class_id = v_class;
  if v_better and v_count >= 2 then
    select x.val, x.nickname, x.avatar, x.mine into v_abs_val, v_abs_nick, v_abs_avatar, v_abs_mine
    from (
      select (p.progress->'hi'->p_game->>'best')::numeric as val, s.nickname,
             coalesce(nullif(p.progress->>'avatar', ''), s.avatar) as avatar, s.id = v_student as mine,
             case when jsonb_typeof(p.progress->'hi'->p_game->'bts') = 'number'
                  then (p.progress->'hi'->p_game->>'bts')::numeric else 0 end as ts
      from public.students s join public.student_progress p on p.student_id = s.id
      where s.class_id = v_class
        and jsonb_typeof(p.progress->'hi'->p_game->'best') = 'number'
    ) x
    where x.val between v_lo and v_hi and (v_mode = 'min' or x.val > 0)
    order by case when v_mode = 'min' then x.val end asc,
             case when v_mode = 'max' then x.val end desc,
             x.ts asc
    limit 1;
    v_absolute := v_abs_val is not null and
      case when v_mode = 'min' then p_value < v_abs_val else p_value > v_abs_val end;
  end if;
  v_gain := case when v_absolute then 10 when v_better and v_prev is not null then 3 else 0 end;   -- 10 record absolu, 3 record perso battu ; un premier score n'est pas un record battu

  v_entry := jsonb_build_object(
    'best', case when v_better then p_value else v_prev end,
    'last', p_value,
    'n', case when jsonb_typeof(v_old->'n') = 'number' then floor((v_old->>'n')::numeric)::int else 0 end + 1,
    'bts', case when v_better then floor(extract(epoch from clock_timestamp()) * 1000)::bigint
                when jsonb_typeof(v_old->'bts') = 'number' then (v_old->>'bts')::numeric end);
  v_coins := case when jsonb_typeof(v_progress->'coins') = 'number' then floor((v_progress->>'coins')::numeric)::int else 0 end + v_gain;
  v_progress := v_progress || jsonb_build_object(
    'hi', coalesce(v_progress->'hi', '{}'::jsonb) || jsonb_build_object(p_game, v_entry),
    'coins', v_coins);

  insert into public.student_progress(student_id, teacher_id, progress, sync_version)
  values (v_student, v_teacher, v_progress, 1)
  on conflict (student_id) do update
    set progress = excluded.progress, sync_version = public.student_progress.sync_version + 1, updated_at = now()
  returning sync_version into v_version;

  return jsonb_build_object(
    'record', v_better, 'first', v_better and v_prev is null, 'prev', v_prev,
    'absolute', v_absolute, 'gain', v_gain, 'coins', v_coins, 'entry', v_entry, 'version', v_version,
    'prevAbs', case when v_absolute then jsonb_build_object(
      'value', v_abs_val, 'nickname', v_abs_nick, 'avatar', v_abs_avatar, 'mine', v_abs_mine) end);
end $$;

revoke all on function public.student_submit_score(text, text, numeric, bigint) from public;
grant execute on function public.student_submit_score(text, text, numeric, bigint) to anon, authenticated;
