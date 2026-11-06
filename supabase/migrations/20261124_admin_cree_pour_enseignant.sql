-- L'administrateur peut créer une classe et inscrire un élève pour le compte d'un autre enseignant
-- (enseignant qui n'y arrive pas). Les limites d'élèves de l'enseignant choisi restent appliquées
-- (déclencheur check_student_quota) et le code de classe reste contrôlé (assign_class_code).
drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes for insert to authenticated
  with check (teacher_id = (select auth.uid()) or public.is_zoo_admin());

drop policy if exists students_insert on public.students;
create policy students_insert on public.students for insert to authenticated
  with check (teacher_id = (select auth.uid()) or public.is_zoo_admin());

-- Le PIN de départ d'un élève inscrit par l'administrateur doit pouvoir être créé.
create or replace function public.set_student_pin(p_student uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
 if p_pin !~ '^[0-9]{4,8}$' then raise exception 'PIN de 4 à 8 chiffres requis'; end if;
 update public.students set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',11))
 where id=p_student and (teacher_id=auth.uid() or public.is_zoo_admin());
 if not found then raise exception 'Élève non autorisé'; end if;
 delete from public.student_sessions where student_id=p_student;
end $function$;
