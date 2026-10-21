-- Bons « remis » : l'enseignant(e) marque une récompense comme remise, le Zoo de l'élève la retire de « Mes bons ».
-- Même principe que le cadeau de pièces : la remise attend à côté de la progression (given_vouchers),
-- puis le Zoo la récupère avec le bon numéro de version (pas de conflit de synchronisation).

alter table public.student_progress
  add column if not exists given_vouchers jsonb not null default '[]'::jsonb;

-- Enseignant(e) connecté(e) : seulement pour SES élèves
create or replace function public.teacher_give_voucher(p_student uuid, p_voucher text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_teacher uuid; v_list jsonb;
begin
  if auth.uid() is null then raise exception 'Connexion enseignante requise'; end if;
  if p_voucher is null or length(p_voucher) < 1 or length(p_voucher) > 80 then raise exception 'Bon invalide'; end if;
  select s.teacher_id into v_teacher from public.students s where s.id = p_student;
  if v_teacher is null or v_teacher <> auth.uid() then raise exception 'Cet élève n''est pas dans tes classes'; end if;
  insert into public.student_progress(student_id, teacher_id, progress, sync_version, given_vouchers)
  values (p_student, v_teacher, '{}'::jsonb, 0, jsonb_build_array(p_voucher))
  on conflict (student_id) do update
    set given_vouchers = case when public.student_progress.given_vouchers ? p_voucher
                              then public.student_progress.given_vouchers
                              else public.student_progress.given_vouchers || jsonb_build_array(p_voucher) end
  returning given_vouchers into v_list;
  return jsonb_array_length(v_list);
end $$;

-- Zoo de l'élève : récupère les bons remis (même contrôle de version que la sauvegarde)
create or replace function public.student_claim_vouchers(p_token text, p_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_given jsonb; v_version bigint; v_progress jsonb; v_vouchers jsonb;
begin
  select ss.student_id into v_student from public.student_sessions ss
   where ss.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and ss.expires_at > now();
  if v_student is null then raise exception 'Session expirée'; end if;
  select given_vouchers, sync_version, progress into v_given, v_version, v_progress
    from public.student_progress where student_id = v_student for update;
  if not found or jsonb_array_length(coalesce(v_given, '[]'::jsonb)) = 0 then
    return jsonb_build_object('claimed', 0, 'version', coalesce(v_version, 0));
  end if;
  if v_version is distinct from p_version then raise exception 'SYNC_CONFLICT'; end if;
  select coalesce(jsonb_agg(case when v ? 'id' and v_given ? (v->>'id') then v || '{"done": true}'::jsonb else v end), '[]'::jsonb)
    into v_vouchers
    from jsonb_array_elements(case when jsonb_typeof(v_progress->'vouchers') = 'array' then v_progress->'vouchers' else '[]'::jsonb end) v;
  update public.student_progress
     set progress = progress || jsonb_build_object('vouchers', v_vouchers), given_vouchers = '[]'::jsonb,
         sync_version = sync_version + 1
   where student_id = v_student
  returning sync_version into v_version;
  return jsonb_build_object('claimed', jsonb_array_length(v_given), 'ids', v_given, 'version', v_version);
end $$;

revoke all on function public.teacher_give_voucher(uuid, text) from public, anon;
revoke all on function public.student_claim_vouchers(text, bigint) from public;
grant execute on function public.teacher_give_voucher(uuid, text) to authenticated;
grant execute on function public.student_claim_vouchers(text, bigint) to anon, authenticated;
