-- Les dons utilisent la même réserve que les parties gagnées à la roue du Calcul.
create function public.teacher_give_credits(p_student uuid, p_amount integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_teacher uuid := auth.uid();
  v_pending integer;
begin
  if v_teacher is null then raise exception 'Connexion enseignante requise'; end if;
  if p_amount is null or p_amount not between 1 and 20 then
    raise exception 'Nombre de parties invalide';
  end if;

  perform 1 from public.students s
  where s.id = p_student and s.teacher_id = v_teacher and s.ghosted_at is null
  for share;
  if not found then raise exception 'Cet élève actif ne fait pas partie de vos classes'; end if;

  insert into public.student_progress as progress (student_id, teacher_id, progress, sync_version, pending_credits)
  values (p_student, v_teacher, '{}'::jsonb, 0, p_amount)
  on conflict (student_id) do update
    set pending_credits = progress.pending_credits + excluded.pending_credits
    where progress.pending_credits + excluded.pending_credits <= 1000
  returning pending_credits into v_pending;
  if v_pending is null then raise exception 'Trop de parties sont déjà en attente pour cet élève'; end if;
  return v_pending;
end $$;

revoke all on function public.teacher_give_credits(uuid, integer) from public, anon;
grant execute on function public.teacher_give_credits(uuid, integer) to authenticated;
