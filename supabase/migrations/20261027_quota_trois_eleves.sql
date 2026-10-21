-- Un nouveau compte enseignant peut inscrire 3 élèves (au lieu de 10). Les comptes existants gardent leur quota.
alter table public.teachers alter column student_limit set default 3;
