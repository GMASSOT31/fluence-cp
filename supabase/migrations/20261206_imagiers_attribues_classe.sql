-- Les enseignants voient les corpus collectifs de la classe qu’ils consultent.
create function public.teacher_class_vocabulary(p_class uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.classes c where c.id = p_class and c.ghosted_at is null
      and (c.teacher_id = auth.uid() or public.is_zoo_admin())
  ) then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(q.corpus_id order by q.assigned_at, q.corpus_id)
    from public.zoo_vocabulary_class_queue q where q.class_id = p_class
  ), '[]'::jsonb);
end $$;

revoke all on function public.teacher_class_vocabulary(uuid) from public, anon;
grant execute on function public.teacher_class_vocabulary(uuid) to authenticated;
