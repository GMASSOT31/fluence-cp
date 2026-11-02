-- « + niveau » / « − niveau » aussi pour les sons reconnus (écoute) : étape de type k = 'l'.
-- on = true : le son est marqué reconnu (progress.listen.done) ; on = false : retiré (done supprimé, passes remis à 0).
-- teacher_adjust_level accepte donc k in (s, m, t, l) ; student_claim_level applique les deux sortes et renvoie aussi `listen`.

create or replace function public.teacher_adjust_level(p_student uuid, p_steps jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_teacher uuid; e jsonb; v_clean jsonb := '[]'::jsonb; v_n integer;
begin
  if auth.uid() is null then raise exception 'Connexion enseignante requise'; end if;
  select s.teacher_id into v_teacher from public.students s where s.id = p_student;
  if v_teacher is null or v_teacher <> auth.uid() then raise exception 'Cet élève n''est pas dans tes classes'; end if;
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) < 1 or jsonb_array_length(p_steps) > 60 then
    raise exception 'Liste d''étapes invalide'; end if;
  for e in select * from jsonb_array_elements(p_steps) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'sound') <> 'string' or length(e->>'sound') not between 1 and 80
       or (e->>'k') not in ('s','m','t','l') or jsonb_typeof(e->'on') <> 'boolean'
       or ((e->>'on')::boolean and (e->>'k') <> 'l' and (jsonb_typeof(e->'mclm') <> 'number' or (e->>'mclm')::numeric not between 1 and 250)) then
      raise exception 'Étape invalide'; end if;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object('sound', e->>'sound', 'k', e->>'k', 'on', (e->>'on')::boolean,
                 'mclm', case when (e->>'on')::boolean and (e->>'k') <> 'l' then (e->>'mclm')::numeric else 0 end));
  end loop;
  insert into public.student_progress(student_id, teacher_id, progress, sync_version, pending_level)
  values (p_student, v_teacher, '{}'::jsonb, 0, v_clean)
  on conflict (student_id) do update
    set pending_level = case when jsonb_array_length(public.student_progress.pending_level) + jsonb_array_length(v_clean) <= 200
                             then public.student_progress.pending_level || v_clean else v_clean end
  returning jsonb_array_length(pending_level) into v_n;
  return v_n;
end $$;

create or replace function public.student_claim_level(p_token text, p_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_pending jsonb; v_version bigint; v_progress jsonb; v_results jsonb; v_listen jsonb; e jsonb; v_ts bigint;
begin
  select ss.student_id into v_student from public.student_sessions ss
   where ss.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and ss.expires_at > now();
  if v_student is null then raise exception 'Session expirée'; end if;
  select pending_level, sync_version, progress into v_pending, v_version, v_progress
    from public.student_progress where student_id = v_student for update;
  if not found or jsonb_array_length(coalesce(v_pending, '[]'::jsonb)) = 0 then
    return jsonb_build_object('claimed', 0, 'version', coalesce(v_version, 0));
  end if;
  if v_version is distinct from p_version then raise exception 'SYNC_CONFLICT'; end if;
  v_results := case when jsonb_typeof(v_progress->'results') = 'array' then v_progress->'results' else '[]'::jsonb end;
  v_listen := case when jsonb_typeof(v_progress->'listen') = 'object' then v_progress->'listen' else '{}'::jsonb end;
  if jsonb_typeof(v_listen->'done') is distinct from 'object' then v_listen := jsonb_set(v_listen, '{done}', '{}'::jsonb, true); end if;
  if jsonb_typeof(v_listen->'passes') is distinct from 'object' then v_listen := jsonb_set(v_listen, '{passes}', '{}'::jsonb, true); end if;
  v_ts := (extract(epoch from now()) * 1000)::bigint;
  for e in select * from jsonb_array_elements(v_pending) loop
    if e->>'k' = 'l' then
      if (e->>'on')::boolean then
        v_listen := jsonb_set(v_listen, '{done}', (v_listen->'done') || jsonb_build_object(e->>'sound', true), true);
      else
        v_listen := jsonb_set(jsonb_set(v_listen, '{done}', (v_listen->'done') - (e->>'sound'), true),
                              '{passes}', (v_listen->'passes') || jsonb_build_object(e->>'sound', 0), true);
      end if;
    elsif (e->>'on')::boolean then
      v_results := v_results || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'sid', v_student,
        'sound', e->>'sound', 'k', e->>'k', 'n', 0, 'e', 0, 't', 0, 'mclm', (e->>'mclm')::numeric, 'ts', v_ts, 'src', 'adj', 'adj', true));
    else
      select coalesce(jsonb_agg(case when r->>'sound' = e->>'sound' and r->>'k' = e->>'k' and coalesce(r->>'src', '') <> 'train'
                                     then r || '{"void": true}'::jsonb else r end), '[]'::jsonb)
        into v_results from jsonb_array_elements(v_results) r;
    end if;
  end loop;
  update public.student_progress
     set progress = progress || jsonb_build_object('results', v_results, 'listen', v_listen), pending_level = '[]'::jsonb,
         sync_version = sync_version + 1
   where student_id = v_student
  returning sync_version into v_version;
  return jsonb_build_object('claimed', jsonb_array_length(v_pending), 'results', v_results, 'listen', v_listen, 'version', v_version);
end $$;

revoke all on function public.teacher_adjust_level(uuid, jsonb) from public, anon;
grant execute on function public.teacher_adjust_level(uuid, jsonb) to authenticated;
revoke all on function public.student_claim_level(text, bigint) from public;
grant execute on function public.student_claim_level(text, bigint) to anon, authenticated;
