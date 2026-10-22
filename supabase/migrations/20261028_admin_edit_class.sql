-- L'admin peut renommer une classe et changer son code, même si elle appartient à un autre enseignant.
-- Les enseignant(e)s gardent leurs droits actuels (écriture directe sur leurs propres classes) ; la règle classes_update ne change pas.
-- Le trigger assign_class_code (avant UPDATE du code) normalise le code et exige 4 à 20 lettres ou chiffres ; la contrainte d'unicité reste en place.

create or replace function public.admin_edit_class(p_class uuid, p_name text default null, p_access_code text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text;
begin
  if auth.uid() is null or not public.is_zoo_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if not exists (select 1 from public.classes where id = p_class) then raise exception 'Classe introuvable'; end if;
  if p_name is null and p_access_code is null then raise exception 'Rien à modifier'; end if;
  if p_name is not null then
    v_name := btrim(p_name);
    if char_length(v_name) < 1 or char_length(v_name) > 80 then
      raise exception 'Le nom de la classe doit faire entre 1 et 80 caractères.' using errcode = '22023';
    end if;
  end if;
  if p_access_code is not null and btrim(p_access_code) = '' then
    raise exception 'Le code de classe doit faire de 4 à 20 lettres ou chiffres.' using errcode = '22023';
  end if;
  update public.classes
     set name = coalesce(v_name, name),
         access_code = coalesce(p_access_code, access_code)
   where id = p_class;
  return 'ok';
end $$;

revoke execute on function public.admin_edit_class(uuid, text, text) from public, anon;
grant execute on function public.admin_edit_class(uuid, text, text) to authenticated;
