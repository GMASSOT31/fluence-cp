create table public.zoo_vocabulary_class_exclusions (
  class_id uuid not null,
  corpus_id uuid not null,
  student_id uuid references public.students(id) on delete cascade,
  primary key (class_id, corpus_id, student_id),
  foreign key (class_id, corpus_id) references public.zoo_vocabulary_class_queue(class_id, corpus_id) on delete cascade
);
alter table public.zoo_vocabulary_class_exclusions enable row level security;
revoke all on public.zoo_vocabulary_class_exclusions from public, anon, authenticated;

create function public.teacher_remove_class_vocabulary(p_class uuid, p_corpus uuid, p_student uuid default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.classes c where c.id = p_class and c.ghosted_at is null
      and (c.teacher_id = auth.uid() or public.is_zoo_admin())
  ) then raise exception 'Accès refusé' using errcode = '42501'; end if;

  perform 1 from public.zoo_vocabulary_class_queue q
  where q.class_id = p_class and q.corpus_id = p_corpus for update;
  if not found then return false; end if;

  if p_student is null then
    delete from public.zoo_vocabulary_class_queue where class_id = p_class and corpus_id = p_corpus;
  else
    perform 1 from public.students s where s.id = p_student and s.class_id = p_class and s.ghosted_at is null for share;
    if not found then raise exception 'Cet élève ne fait pas partie de cette classe' using errcode = '42501'; end if;
    insert into public.zoo_vocabulary_class_exclusions(class_id, corpus_id, student_id)
    values(p_class, p_corpus, p_student) on conflict do nothing;
  end if;
  return found;
end $$;

revoke all on function public.teacher_remove_class_vocabulary(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.teacher_remove_class_vocabulary(uuid,uuid,uuid) to authenticated;

create or replace function public.student_vocabulary_queue(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('type','vocabulaire','corpus',q.corpus_id,'ts',q.assigned_at,'collective',true)
    order by q.assigned_at,q.corpus_id),'[]'::jsonb)
  from public.student_sessions ss join public.students s on s.id=ss.student_id
  join public.zoo_vocabulary_class_queue q on q.class_id=s.class_id
  where ss.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    and ss.expires_at>now() and s.ghosted_at is null
    and not exists (
      select 1 from public.zoo_vocabulary_class_exclusions x
      where x.class_id=q.class_id and x.corpus_id=q.corpus_id and x.student_id=s.id
    )
$$;
