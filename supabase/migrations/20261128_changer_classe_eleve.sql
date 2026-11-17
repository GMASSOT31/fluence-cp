-- Changer un élève de classe (admin, 17/11/2026) : vers une autre classe du même enseignant ou d'un autre enseignant.
-- Rien n'est effacé : progression, lectures, animaux, pièces et historique suivent l'élève (on change seulement classe et enseignant).
-- L'élève se connecte ensuite avec le code de sa nouvelle classe (même prénom, même code secret).
create or replace function public.admin_move_student(p_student uuid, p_class uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_st public.students; v_cl public.classes;
begin
  if not public.is_zoo_admin() then raise exception 'Réservé à l''administrateur'; end if;
  select * into v_st from public.students where id = p_student for update;
  if v_st.id is null then raise exception 'Élève introuvable'; end if;
  select * into v_cl from public.classes where id = p_class;
  if v_cl.id is null then raise exception 'Classe introuvable'; end if;
  if v_st.class_id = v_cl.id then return jsonb_build_object('ok', true, 'same', true); end if;
  if exists (select 1 from public.students where class_id = v_cl.id and id <> p_student and lower(btrim(nickname)) = lower(btrim(v_st.nickname))) then
    raise exception 'Un élève de cette classe a déjà ce prénom : renommez-le d''abord';
  end if;
  update public.students set class_id = v_cl.id, teacher_id = v_cl.teacher_id where id = p_student;
  update public.student_progress set teacher_id = v_cl.teacher_id where student_id = p_student;
  update public.evaluation_attempts set teacher_id = v_cl.teacher_id where student_id = p_student;
  return jsonb_build_object('ok', true, 'class', v_cl.name, 'access_code', v_cl.access_code);
end $$;
revoke all on function public.admin_move_student(uuid, uuid) from public, anon;
grant execute on function public.admin_move_student(uuid, uuid) to authenticated;
