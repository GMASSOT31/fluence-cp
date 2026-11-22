insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('vocabulaire-zoo','vocabulaire-zoo',true,300000,array['image/jpeg'])
on conflict (id) do nothing;

create policy vocabulaire_zoo_import on storage.objects for insert to authenticated
with check (bucket_id = 'vocabulaire-zoo' and public.is_zoo_admin()
  and name ~ '^[0-9a-f-]{36}/[0-9]{3}[.]jpg$');

create table public.zoo_vocabulary_corpora (
  id uuid primary key,
  title text not null,
  words jsonb not null
);
create unique index zoo_vocabulary_title_unique on public.zoo_vocabulary_corpora(lower(title));

create table public.zoo_vocabulary_class_queue (
  class_id uuid references public.classes(id) on delete cascade,
  corpus_id uuid references public.zoo_vocabulary_corpora(id) on delete cascade,
  assigned_at bigint not null default floor(extract(epoch from clock_timestamp()) * 1000),
  primary key (class_id, corpus_id)
);

alter table public.zoo_vocabulary_corpora enable row level security;
alter table public.zoo_vocabulary_class_queue enable row level security;
revoke all on public.zoo_vocabulary_corpora, public.zoo_vocabulary_class_queue from public, anon, authenticated;

create function public.get_vocabulary_corpora() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.title,c.id),'[]'::jsonb) from public.zoo_vocabulary_corpora c
$$;

create function public.admin_create_vocabulary_corpus(p_id uuid,p_title text,p_words jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i integer := 0; word jsonb; label text; labels text[] := '{}'; originals text[] := '{}';
begin
  if auth.uid() is null or not coalesce(public.is_zoo_admin(),false) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_id is null or coalesce(char_length(btrim(p_title)),0) not between 1 and 80
    or coalesce(jsonb_typeof(p_words),'null') <> 'array' then raise exception 'Imagier invalide'; end if;
  if jsonb_array_length(p_words) not between 6 and 60 then raise exception 'Il faut de 6 à 60 cartes'; end if;
  for word in select value from jsonb_array_elements(p_words) loop
    i := i + 1;
    label := btrim(word->>'label');
    if jsonb_typeof(word->'label') is distinct from 'string' or coalesce(char_length(label),0) not between 1 and 80
      or lower(label) = any(labels) then raise exception 'Libellé vide ou en double (carte %)', i; end if;
    labels := array_append(labels, lower(label));
    originals := array_append(originals, label);
    if not exists (select 1 from storage.objects where bucket_id = 'vocabulaire-zoo'
        and name = p_id::text || '/' || lpad(i::text,3,'0') || '.jpg') then
      raise exception 'Image manquante (carte %)',i;
    end if;
  end loop;
  insert into public.zoo_vocabulary_corpora(id,title,words)
    values(p_id,btrim(p_title),to_jsonb(originals)) on conflict(id) do nothing;
  return p_id;
end $$;

create function public.teacher_queue_vocabulary(p_class uuid,p_corpus uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.classes c where c.id=p_class and c.ghosted_at is null
    and (c.teacher_id=auth.uid() or public.is_zoo_admin())) then raise exception 'Accès refusé' using errcode='42501'; end if;
  insert into public.zoo_vocabulary_class_queue(class_id,corpus_id) values(p_class,p_corpus) on conflict do nothing;
  return found;
end $$;

create function public.student_vocabulary_queue(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('type','vocabulaire','corpus',q.corpus_id,'ts',q.assigned_at,'collective',true)
    order by q.assigned_at,q.corpus_id),'[]'::jsonb)
  from public.student_sessions ss join public.students s on s.id=ss.student_id
  join public.zoo_vocabulary_class_queue q on q.class_id=s.class_id
  where ss.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    and ss.expires_at>now() and s.ghosted_at is null
$$;

revoke all on function public.get_vocabulary_corpora(),public.admin_create_vocabulary_corpus(uuid,text,jsonb),
  public.teacher_queue_vocabulary(uuid,uuid),public.student_vocabulary_queue(text) from public,anon,authenticated;
grant execute on function public.get_vocabulary_corpora(),public.student_vocabulary_queue(text) to anon,authenticated;
grant execute on function public.admin_create_vocabulary_corpus(uuid,text,jsonb),public.teacher_queue_vocabulary(uuid,uuid) to authenticated;
