-- Formulaire de contact public (sans compte) : messages lus par l'admin.
-- Nouvelle table + une fonction ; rien d'existant ne change.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 5 and 254 and email like '%_@_%._%'),
  message text not null check (char_length(btrim(message)) between 10 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists contact_messages_created_idx on public.contact_messages(created_at desc);

alter table public.contact_messages enable row level security;
create policy contact_admin_select on public.contact_messages for select to authenticated using (public.is_zoo_admin());
create policy contact_admin_update on public.contact_messages for update to authenticated
  using (public.is_zoo_admin()) with check (public.is_zoo_admin());
create policy contact_admin_delete on public.contact_messages for delete to authenticated using (public.is_zoo_admin());

revoke all on public.contact_messages from public, anon, authenticated;
grant select, delete on public.contact_messages to authenticated;
grant update (read_at) on public.contact_messages to authenticated;

-- Envoi depuis le site : renvoie un résultat (jamais d'erreur) ; limites contre le courrier indésirable.
create or replace function public.submit_contact_message(p_email text, p_message text, p_website text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_msg text := btrim(coalesce(p_message, ''));
begin
  -- Champ piège rempli par un robot : on fait comme si tout allait bien
  if btrim(coalesce(p_website, '')) <> '' then
    return jsonb_build_object('ok', true);
  end if;
  if char_length(v_email) < 5 or char_length(v_email) > 254 or v_email not like '%_@_%._%' then
    return jsonb_build_object('ok', false, 'reason', 'email');
  end if;
  if char_length(v_msg) < 10 then
    return jsonb_build_object('ok', false, 'reason', 'short');
  end if;
  if char_length(v_msg) > 4000 then
    return jsonb_build_object('ok', false, 'reason', 'long');
  end if;
  -- 3 messages par adresse et par jour, 30 au total par heure
  if (select count(*) from public.contact_messages where email = v_email and created_at > now() - interval '1 day') >= 3
     or (select count(*) from public.contact_messages where created_at > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'limit');
  end if;
  insert into public.contact_messages(email, message) values (v_email, v_msg);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.submit_contact_message(text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text) to anon, authenticated;
