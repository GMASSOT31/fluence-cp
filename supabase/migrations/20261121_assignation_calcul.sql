-- Un exercice de calcul par élève. Une série réussie après attribution le termine.
create table public.lab_calc_assignments (
  student_id uuid primary key references public.students(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  activity text not null check (activity in ('nombres', 'addition', 'soustraction')),
  level text not null,
  assigned_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);
alter table public.lab_calc_assignments enable row level security;
revoke all on public.lab_calc_assignments from public, anon, authenticated;
create function public.lab__assignment(p_student uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'activity', a.activity, 'level', a.level, 'assigned_at', a.assigned_at,
    'done', a.completed_at is not null
  )
  from public.lab_calc_assignments a
  join public.students s on s.id = a.student_id and s.teacher_id = a.teacher_id
  where a.student_id = p_student
$$;

create function public.lab__complete_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.total > 0 then
    update public.lab_calc_assignments a
    set completed_at = new.created_at
    from public.students s
    left join public.lab_calc_settings cs on cs.teacher_id = s.teacher_id
    where a.student_id = new.student_id and s.id = new.student_id and s.teacher_id = a.teacher_id
      and a.activity = new.activity and a.level = new.level
      and a.completed_at is null and new.created_at >= a.assigned_at
      and new.correct * 100 >= new.total * least(greatest(coalesce((cs.settings->>'pass')::integer, 80), 50), 100);
  end if;
  return new;
end $$;
create trigger lab_calc_complete_assignment after insert on public.lab_calc_rounds
for each row execute function public.lab__complete_assignment();

create function public.lab_student_assignment(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.lab__assignment(public.lab__require_student(p_token))
$$;

create function public.lab_teacher_assignments() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.lab__teacher_allowed() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(a.student_id, public.lab__assignment(a.student_id))
    from public.lab_calc_assignments a
    join public.students s on s.id = a.student_id and s.teacher_id = a.teacher_id
    where a.teacher_id = auth.uid() and s.ghosted_at is null
  ), '{}'::jsonb);
end $$;

create function public.lab_teacher_assign(p_student uuid, p_activity text, p_level text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.lab__teacher_allowed() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  perform 1 from public.students s
    where s.id = p_student and s.teacher_id = auth.uid() and s.ghosted_at is null for share;
  if not found then raise exception 'Élève hors de votre classe' using errcode = '42501'; end if;
  if p_activity is null and p_level is null then
    delete from public.lab_calc_assignments where student_id = p_student and teacher_id = auth.uid();
    return null;
  end if;
  if not coalesce(case p_activity
    when 'nombres' then p_level in ('n0','n1','n2','n3','d20','d30','d40','d50','n4','n5','n6','n7','n8','n9','n10','n11')
    when 'addition' then p_level in ('a0','a1','a2','ad10','a3','a4','a6','a5','a7','ap20','ap30','ac30','ap40','ap50','ap60','ap70','ap80','ap90','a8')
    when 'soustraction' then p_level in ('s0','s1','s2','s3','s4','s5','sp20','sp30','sc30','sp40','sp50','sp60','sp70','sp80','sp90')
    else false end, false)
  then raise exception 'Exercice inconnu'; end if;
  insert into public.lab_calc_assignments(student_id, teacher_id, activity, level)
    values (p_student, auth.uid(), p_activity, p_level)
    on conflict (student_id) do update
      set teacher_id = excluded.teacher_id, activity = excluded.activity, level = excluded.level,
          assigned_at = excluded.assigned_at, completed_at = null;
  return public.lab__assignment(p_student);
end $$;
revoke all on function public.lab__assignment(uuid), public.lab__complete_assignment(), public.lab_student_assignment(text),
  public.lab_teacher_assignments(), public.lab_teacher_assign(uuid,text,text) from public, anon, authenticated;
grant execute on function public.lab_student_assignment(text) to anon, authenticated;
grant execute on function public.lab_teacher_assignments(), public.lab_teacher_assign(uuid,text,text) to authenticated;
