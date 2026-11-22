alter table public.zoo_vocabulary_corpora
  add column images jsonb not null default '{}',
  add column revision integer not null default 0;

create policy vocabulaire_zoo_remplacement on storage.objects for insert to authenticated
with check (bucket_id = 'vocabulaire-zoo' and public.is_zoo_admin()
  and name ~ '^[0-9a-f-]{36}/[0-9]{3}-[0-9a-f]{32}[.]jpg$');

create function public.admin_update_vocabulary_corpus(
  p_id uuid, p_revision integer, p_title text, p_words jsonb, p_images jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  corpus public.zoo_vocabulary_corpora%rowtype;
  card record;
  label text;
  labels text[] := '{}';
  clean_words text[] := '{}';
begin
  if auth.uid() is null or not coalesce(public.is_zoo_admin(), false) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  select * into corpus from public.zoo_vocabulary_corpora where id = p_id for update;
  if not found then raise exception 'Ce corpus est introuvable.'; end if;
  if corpus.revision is distinct from p_revision then
    raise exception 'Ce corpus a été modifié ailleurs. Rechargez la page avant de réessayer.';
  end if;
  if coalesce(char_length(btrim(p_title)), 0) not between 1 and 80
    or jsonb_typeof(p_words) is distinct from 'array'
    or jsonb_typeof(p_images) is distinct from 'object' then
    raise exception 'Imagier invalide.';
  end if;
  if jsonb_array_length(p_words) <> jsonb_array_length(corpus.words) then
    raise exception 'Le nombre de cartes doit rester le même.';
  end if;

  for card in select value, ordinality from jsonb_array_elements(p_words) with ordinality loop
    label := btrim(card.value #>> '{}');
    if jsonb_typeof(card.value) is distinct from 'string'
      or coalesce(char_length(label), 0) not between 1 and 80
      or lower(label) = any(labels) then
      raise exception 'Libellé invalide ou en double (carte %).', card.ordinality;
    end if;
    labels := array_append(labels, lower(label));
    clean_words := array_append(clean_words, label);
  end loop;

  for card in select key, value from jsonb_each(p_images) loop
    if card.key !~ '^[0-9]{3}$' or jsonb_typeof(card.value) is distinct from 'string'
      or (card.value #>> '{}') !~ '^[0-9a-f]{32}$' then
      raise exception 'Référence d’image invalide.';
    end if;
    if card.key::integer not between 1 and cardinality(clean_words)
      or not exists (
        select 1 from storage.objects where bucket_id = 'vocabulaire-zoo'
          and name = p_id::text || '/' || card.key || '-' || (card.value #>> '{}') || '.jpg'
      ) then raise exception 'Image introuvable (carte %).', card.key; end if;
  end loop;

  update public.zoo_vocabulary_corpora
  set title = btrim(p_title), words = to_jsonb(clean_words),
    images = corpus.images || p_images, revision = corpus.revision + 1
  where id = p_id returning * into corpus;
  return to_jsonb(corpus);
end $$;

revoke all on function public.admin_update_vocabulary_corpus(uuid,integer,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_vocabulary_corpus(uuid,integer,text,jsonb,jsonb) to authenticated;
