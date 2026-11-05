-- Renommer un élève (réorthographier un prénom) : l'enseignant propriétaire ou l'admin.
-- Le prénom sert à se connecter (comparé sans majuscules) : refus si un autre élève de la même classe porte déjà ce prénom.
create or replace function public.rename_student(p_student uuid, p_nickname text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare v_teacher uuid; v_class uuid; v_name text := btrim(coalesce(p_nickname, ''));
begin
  if auth.uid() is null then raise exception 'Connexion enseignante requise'; end if;
  select teacher_id, class_id into v_teacher, v_class from public.students where id = p_student;
  if v_teacher is null then raise exception 'Élève introuvable'; end if;
  if v_teacher <> auth.uid() and not public.is_zoo_admin() then raise exception 'Cet élève n''est pas dans tes classes'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then raise exception 'Le prénom doit faire de 1 à 60 caractères'; end if;
  if exists (select 1 from public.students where class_id = v_class and id <> p_student and lower(btrim(nickname)) = lower(v_name)) then
    raise exception 'Un autre élève de cette classe a déjà ce prénom';
  end if;
  update public.students set nickname = v_name where id = p_student;
  return v_name;
end $function$;
revoke all on function public.rename_student(uuid, text) from public, anon;
grant execute on function public.rename_student(uuid, text) to authenticated;
