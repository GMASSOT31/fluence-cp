-- Demande de places d'élèves : l'enseignant(e) demande des places en plus, l'admin les accorde.
-- Ajoute deux colonnes et une fonction ; aucune politique existante n'est modifiée.

alter table public.teachers
  add column if not exists seat_request integer check (seat_request between 1 and 500),
  add column if not exists seat_request_at timestamptz;

-- Enseignant(e) connecté(e) : sa propre ligne seulement. 1 à 500 places, 0 ou null pour annuler.
create or replace function public.teacher_request_seats(p_count integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_count integer; v_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Connexion enseignante requise'; end if;
  if p_count is not null and p_count <> 0 and (p_count < 1 or p_count > 500) then
    raise exception 'Nombre de places invalide (1 à 500)';
  end if;
  update public.teachers
     set seat_request = nullif(p_count, 0),
         seat_request_at = case when coalesce(p_count, 0) = 0 then null else now() end
   where id = auth.uid()
  returning seat_request, seat_request_at into v_count, v_at;
  if not found then raise exception 'Compte enseignant introuvable'; end if;
  return jsonb_build_object('seat_request', v_count, 'seat_request_at', v_at);
end $$;

revoke all on function public.teacher_request_seats(integer) from public;
grant execute on function public.teacher_request_seats(integer) to authenticated;
