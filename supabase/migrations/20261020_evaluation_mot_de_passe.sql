-- Le mot de passe du compte enseignant sert de code d'évaluation dans le Zoo connecté.
-- Limite : 5 essais ratés par élève et 20 par enseignante sur 10 minutes.
-- L'ancien réglage (set_evaluation_code, teachers.evaluation_code_hash) est supprimé.

-- Essais ratés, pour limiter les tentatives (aucun accès direct depuis les pages)
create table if not exists public.evaluation_attempts (
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists evaluation_attempts_recent on public.evaluation_attempts (teacher_id, attempted_at);
alter table public.evaluation_attempts enable row level security;
revoke all on public.evaluation_attempts from anon, authenticated;

create or replace function public.verify_evaluation_code(p_token text, p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_student uuid; v_teacher uuid; v_hash text; v_ok boolean;
begin
  select s.id, s.teacher_id into v_student, v_teacher
  from public.student_sessions ss join public.students s on s.id = ss.student_id
  where ss.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and ss.expires_at > now();
  if v_student is null or p_code is null or p_code = '' then return false; end if;
  -- 5 essais ratés par élève, 20 par enseignante, sur 10 minutes
  if (select count(*) from public.evaluation_attempts
       where student_id = v_student and attempted_at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.evaluation_attempts
       where teacher_id = v_teacher and attempted_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Trop d''essais. Attends 10 minutes avant de réessayer.';
  end if;
  select u.encrypted_password into v_hash from auth.users u where u.id = v_teacher;
  v_ok := v_hash is not null and v_hash <> '' and v_hash = extensions.crypt(p_code, v_hash);
  if v_ok then
    delete from public.evaluation_attempts where student_id = v_student;
  else
    insert into public.evaluation_attempts(student_id, teacher_id) values (v_student, v_teacher);
  end if;
  return v_ok;
end $$;

-- L'ancien réglage disparaît
drop function if exists public.set_evaluation_code(text);
alter table public.teachers drop column if exists evaluation_code_hash;

