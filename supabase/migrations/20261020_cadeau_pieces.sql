-- Cadeau de pièces d'or : l'enseignante donne des pièces, le Zoo de l'élève les récupère.
-- Les pièces attendent dans pending_coins pour éviter tout conflit avec une sauvegarde en cours.

alter table public.student_progress
  add column if not exists pending_coins integer not null default 0
  check (pending_coins between 0 and 10000);

-- Enseignante connectée : seulement pour SES élèves, 1 à 100 pièces par don
create or replace function public.teacher_give_coins(p_student uuid, p_amount integer default 10)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_teacher uuid; v_pending integer;
begin
  if auth.uid() is null then raise exception 'Connexion enseignante requise'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 100 then raise exception 'Nombre de pièces invalide'; end if;
  select s.teacher_id into v_teacher from public.students s where s.id = p_student;
  if v_teacher is null or v_teacher <> auth.uid() then raise exception 'Cet élève n''est pas dans tes classes'; end if;
  insert into public.student_progress(student_id, teacher_id, progress, sync_version, pending_coins)
  values (p_student, v_teacher, '{}'::jsonb, 0, p_amount)
  on conflict (student_id) do update
    set pending_coins = least(public.student_progress.pending_coins + p_amount, 10000)
  returning pending_coins into v_pending;
  return v_pending;
end $$;

-- Zoo de l'élève : récupère les pièces en attente (même contrôle de version que la sauvegarde)
create or replace function public.student_claim_coins(p_token text, p_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_pending integer; v_version bigint; v_progress jsonb; v_coins integer;
begin
  select ss.student_id into v_student from public.student_sessions ss
   where ss.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and ss.expires_at > now();
  if v_student is null then raise exception 'Session expirée'; end if;
  select pending_coins, sync_version, progress into v_pending, v_version, v_progress
    from public.student_progress where student_id = v_student for update;
  if not found or v_pending = 0 then
    return jsonb_build_object('claimed', 0, 'version', coalesce(v_version, 0));
  end if;
  if v_version is distinct from p_version then raise exception 'SYNC_CONFLICT'; end if;
  v_coins := case when jsonb_typeof(v_progress->'coins') = 'number'
                  then floor((v_progress->>'coins')::numeric)::int else 0 end + v_pending;
  update public.student_progress
     set progress = progress || jsonb_build_object('coins', v_coins), pending_coins = 0,
         sync_version = sync_version + 1
   where student_id = v_student
  returning sync_version into v_version;
  return jsonb_build_object('claimed', v_pending, 'coins', v_coins, 'version', v_version);
end $$;

revoke all on function public.teacher_give_coins(uuid, integer) from public, anon;
grant execute on function public.teacher_give_coins(uuid, integer) to authenticated;
revoke all on function public.student_claim_coins(text, bigint) from public;
grant execute on function public.student_claim_coins(text, bigint) to anon, authenticated;

