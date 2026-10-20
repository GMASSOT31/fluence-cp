-- Code de classe choisi par l'enseignante
-- 4 à 20 lettres ou chiffres ; majuscules, accents, espaces et tirets ignorés (« CP Massot » = CPMASSOT).
-- Code vide à la création : tirage au hasard comme avant. Les anciens codes hexadécimaux restent valables.

create or replace function public.assign_class_code()
returns trigger language plpgsql security definer set search_path = '' as $$
declare candidate text;
begin
  if new.access_code is not null then
    new.access_code := upper(regexp_replace(
      translate(new.access_code, 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÁÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ',
                                 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^A-Za-z0-9]', '', 'g'));
    if new.access_code = '' then new.access_code := null; end if;
  end if;
  if new.access_code is null then
    if tg_op = 'UPDATE' then new.access_code := old.access_code; return new; end if;
    loop
      candidate := upper(encode(extensions.gen_random_bytes(5), 'hex'));
      exit when not exists (select 1 from public.classes where access_code = candidate);
    end loop;
    new.access_code := candidate;
  elsif new.access_code !~ '^[A-Z0-9]{4,20}$' then
    raise exception 'Le code de classe doit faire de 4 à 20 lettres ou chiffres.' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists assign_class_code_before_update on public.classes;
create trigger assign_class_code_before_update
  before update of access_code on public.classes
  for each row execute function public.assign_class_code();

create or replace function public.student_sign_in(p_code text, p_nickname text, p_pin text, p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare st record; attempts integer; v_code text;
begin
  v_code := upper(regexp_replace(
    translate(coalesce(p_code, ''), 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÁÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ',
                                    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^A-Za-z0-9]', '', 'g'));
  if v_code !~ '^[A-Z0-9]{4,20}$' or length(p_nickname) > 60 or p_pin !~ '^[0-9]{4,8}$' or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Identifiants invalides'; end if;
  select count(*) into attempts from public.student_login_attempts
   where class_code = v_code and student_name = lower(trim(p_nickname)) and attempted_at > now() - interval '15 minutes';
  if attempts >= 5 then raise exception 'Trop de tentatives. Réessaie dans 15 minutes'; end if;
  insert into public.student_login_attempts(class_code, student_name) values (v_code, lower(trim(p_nickname)));
  select s.id, s.nickname, s.teacher_id into st from public.students s join public.classes c on c.id = s.class_id
   where c.access_code = v_code and lower(s.nickname) = lower(trim(p_nickname))
     and s.pin_hash is not null and s.pin_hash = extensions.crypt(p_pin, s.pin_hash) limit 1;
  if st.id is null then raise exception 'Identifiants invalides'; end if;
  insert into public.student_sessions(token_hash, student_id, expires_at)
  values (encode(extensions.digest(p_token, 'sha256'), 'hex'), st.id, now() + interval '7 days');
  return jsonb_build_object('student_id', st.id, 'nickname', st.nickname, 'expires_in', 604800);
end $$;
