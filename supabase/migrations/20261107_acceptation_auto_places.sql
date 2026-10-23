-- Acceptation automatique des demandes de places (réglage admin, activé d'office, réservé à l'admin par RLS).
-- Règle cachée aux enseignants : si limite actuelle + places demandées <= max (25), la demande est accordée tout de suite.
-- Au-delà (ou si le réglage est désactivé), elle reste en attente de l'admin comme avant.
create table public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy admin_manage_app_settings on public.app_settings for all to authenticated
  using (public.is_zoo_admin()) with check (public.is_zoo_admin());
insert into public.app_settings(key, value) values ('auto_seats', '{"enabled": true, "max": 25}'::jsonb);

create or replace function public.teacher_request_seats(p_count integer)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_count integer; v_at timestamptz; v_limit integer; v_ghost timestamptz; v_cfg jsonb; v_max integer;
begin
  if auth.uid() is null then raise exception 'Connexion enseignante requise'; end if;
  if p_count is not null and p_count <> 0 and (p_count < 1 or p_count > 500) then
    raise exception 'Nombre de places invalide (1 à 500)';
  end if;
  select student_limit, ghosted_at into v_limit, v_ghost from public.teachers where id = auth.uid() for update;
  if not found then raise exception 'Compte enseignant introuvable'; end if;

  -- acceptation automatique (réglage admin « auto_seats ») : si le total reste dans la limite, les places sont accordées tout de suite
  select value into v_cfg from public.app_settings where key = 'auto_seats';
  v_max := coalesce((v_cfg->>'max')::integer, 25);
  if coalesce(p_count, 0) > 0 and v_ghost is null and coalesce((v_cfg->>'enabled')::boolean, false)
     and coalesce(v_limit, 0) > 0 and v_limit + p_count <= v_max then
    update public.teachers set student_limit = v_limit + p_count, seat_request = null, seat_request_at = null
     where id = auth.uid() returning student_limit into v_limit;
    return jsonb_build_object('seat_request', null, 'seat_request_at', null, 'granted', true, 'student_limit', v_limit);
  end if;

  update public.teachers
     set seat_request = nullif(p_count, 0),
         seat_request_at = case when coalesce(p_count, 0) = 0 then null else now() end
   where id = auth.uid()
  returning seat_request, seat_request_at into v_count, v_at;
  return jsonb_build_object('seat_request', v_count, 'seat_request_at', v_at, 'granted', false);
end $function$;
