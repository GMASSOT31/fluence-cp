-- Essai de la migration 20261209_gs_calcul.sql sur une base LOCALE jetable (sh tools/sql/run_gs_calcul_tests.sh), jamais sur Supabase.
-- Schéma réduit aux objets utilisés par les fonctions modifiées ; fonctions voisines remplacées par des bouchons.
\set ON_ERROR_STOP on
\set QUIET on
create schema if not exists auth; create schema if not exists extensions;
create function auth.uid() returns uuid language sql as $$ select 'aaaaaaaa-0000-0000-0000-000000000001'::uuid $$;
create table public.classes(id uuid primary key, ghosted_at timestamptz);
create table public.students(id uuid primary key, teacher_id uuid, class_id uuid);
create table public.student_progress(student_id uuid primary key, teacher_id uuid, progress jsonb, sync_version int, pending_coins int default 0, pending_credits int default 0);
create table public.lab_calc_progress(student_id uuid primary key, progress jsonb not null default '{}', test_coins int not null default 0, test_credits int not null default 0, wheels_used int not null default 0, updated_at timestamptz default now());
create table public.lab_calc_rounds(student_id uuid not null, round_id uuid not null, activity text not null, level text not null, correct int not null, total int not null, coins int not null default 0, created_at timestamptz not null default now(), primary key(student_id, round_id));
create table public.zoo_class_pedagogy(class_id uuid, subject text, settings jsonb, primary key(class_id, subject));
create table stub_reading(teacher_id uuid primary key, s jsonb);
create function public.lab__require_student(p text) returns uuid language sql as $$ select p::uuid $$;
create function public.zoo__reading_settings(t uuid) returns jsonb language sql as $$ select coalesce((select s from public.stub_reading where teacher_id = t), '{}'::jsonb) $$;
create function public.zoo__calculation_settings(t uuid, c uuid) returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.lab__shared_wallet() returns boolean language sql as $$ select false $$;
create function public.is_zoo_admin() returns boolean language sql as $$ select true $$;
create role anon; create role authenticated;
insert into public.classes values ('11111111-0000-0000-0000-000000000001', null);
insert into public.students values ('51000000-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000001');
insert into public.lab_calc_progress(student_id, progress, wheels_used) values ('51000000-0000-0000-0000-000000000001', '{"levels":{"nombres:n1":{"ok":2,"r":2}}}', 2);
\ir ../../supabase/migrations/20261209_gs_calcul.sql
\o /dev/null
create function pg_temp.ok(c boolean, l text) returns void language plpgsql as $$ begin if c is not true then raise exception 'ECHEC : %', l; end if; raise notice 'OK  %', l; end $$;
create function pg_temp.r(round text, lvl text, c int, n int, st jsonb default '{}') returns jsonb language sql as $$
  select public.lab_student_submit_round('51000000-0000-0000-0000-000000000001', round::uuid, 'gs', lvl, c, n, st) $$;
create function pg_temp.p() returns jsonb language sql as $$ select progress from public.lab_calc_progress where student_id = '51000000-0000-0000-0000-000000000001' $$;
create function pg_temp.w() returns int language sql as $$ select public.lab__wheels_earned(progress) - wheels_used from public.lab_calc_progress where student_id = '51000000-0000-0000-0000-000000000001' $$;
select pg_temp.ok(pg_temp.w() = 0, 'élève existant : aucune roue nouvelle après la migration');
select pg_temp.ok((pg_temp.r('00000000-0000-0000-0000-000000000001','chiffres-r1-2',8,10)->>'validated') = 'false', 'T07 : une série à 80 % ne valide pas');
select pg_temp.ok(pg_temp.w() = 1, 'T10 : série réussie = une roue');
select pg_temp.ok((pg_temp.r('00000000-0000-0000-0000-000000000001','chiffres-r1-2',10,10)->>'inserted') = 'false' and pg_temp.w() = 1, 'T11 : même série renvoyée = rien de plus');
select pg_temp.ok((pg_temp.r('00000000-0000-0000-0000-000000000002','chiffres-r1-2',9,10)->>'validated') = 'true', 'T08 : deuxième série réussie d''affilée = palier validé');
select pg_temp.ok(pg_temp.p()->'gs'->'chiffres-r1-2' ? 'val' and pg_temp.w() = 2, 'validation rangée, deux roues');
select pg_temp.r('00000000-0000-0000-0000-000000000003','chiffres-r1-3',9,10);
select pg_temp.r('00000000-0000-0000-0000-000000000004','chiffres-r1-3',6,10);
select pg_temp.ok((pg_temp.p()->'gs'->'chiffres-r1-3'->>'ok') = '0' and not (pg_temp.p()->'gs'->'chiffres-r1-3' ? 'val'), '9/10 puis 6/10 ne valide pas');
select pg_temp.ok(pg_temp.w() = 3, 'T10 : série ratée = pas de roue');
select pg_temp.r('00000000-0000-0000-0000-000000000005','chiffres-r1-3',5,10);
select pg_temp.ok((pg_temp.p()->'gs'->'chiffres-r1-3'->>'aid') = 'true', 'T09 : deux séries ratées = aide');
select pg_temp.ok((pg_temp.r('00000000-0000-0000-0000-000000000006','chiffres-r1-3',10,10)->>'validated') = 'false'
  and (pg_temp.p()->'gs'->'chiffres-r1-3'->>'aid') = 'false' and pg_temp.w() = 4, 'série aidée réussie : retour normal, roue, jamais de validation');
select pg_temp.ok((pg_temp.r('00000000-0000-0000-0000-000000000016','chiffres-r1-3',10,10,'{"aid":true}')->>'validated') = 'false', 'série annoncée aidée par l''appareil : ne valide pas');
select pg_temp.ok(jsonb_array_length(pg_temp.p()->'gsh') = 7 and (pg_temp.p()->'hist'->-1->>'k') = 'gs:chiffres-r1-3', 'historique GS et dernière venue');
select pg_temp.ok((select count(*) from public.lab_calc_rounds where coins > 0) = 0 and (select test_coins from public.lab_calc_progress) = 0, 'aucune pièce pour une série GS');
-- seuil et séries de l'enseignant
insert into stub_reading values ('cccccccc-0000-0000-0000-000000000003', '{"gs":{"calcul":{"collec":{"seuil":100,"series":1}}}}');
select pg_temp.ok((pg_temp.r('00000000-0000-0000-0000-000000000007','collec-r1',5,6)->>'success') = 'false', 'seuil de l''enseignant (100 %) appliqué');
select pg_temp.ok((pg_temp.r('00000000-0000-0000-0000-000000000008','collec-r1',6,6)->>'validated') = 'true', 'une série suffit si l''enseignant le règle');
update stub_reading set s = '{"gs":{"calcul":{"collec":{"seuil":10,"series":9}}}}';
select pg_temp.ok((pg_temp.r('00000000-0000-0000-0000-000000000009','collec-r2',1,6)->>'success') = 'false', 'réglage hors limites ignoré (80 %)');
-- la classe : réglages appliqués par l'admin prioritaires
insert into public.zoo_class_pedagogy values ('11111111-0000-0000-0000-000000000001','lecture','{"gs":{"calcul":{"ordre":{"seuil":50}}}}');
select pg_temp.ok((pg_temp.r('00000000-0000-0000-0000-000000000010','ordre-r1-3',3,6)->>'success') = 'true', 'réglage de la classe appliqué');
-- comptine
select pg_temp.ok((pg_temp.r('00000000-0000-0000-0000-000000000011','rituel',0,1)->>'rituel') is not null and pg_temp.p() ? 'gsr', 'comptine : date retenue');
select pg_temp.ok((select count(*) from public.lab_calc_rounds where level = 'rituel') = 1, 'comptine : une ligne, sans roue');
-- refus
do $$ begin perform pg_temp.r('00000000-0000-0000-0000-000000000012','triche-r1',1,1); raise exception 'ECHEC : activité inconnue acceptée'; exception when others then if sqlerrm like 'ECHEC%' then raise; end if; raise notice 'OK  refus activité inconnue'; end $$;
do $$ begin perform public.lab_student_submit_round('51000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013'::uuid, 'multiplication', 'x1', 1, 1, '{}'); raise exception 'ECHEC'; exception when others then if sqlerrm like 'ECHEC%' then raise; end if; raise notice 'OK  refus activité CP inconnue'; end $$;
-- CP inchangé
select pg_temp.ok((public.lab_student_submit_round('51000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000014'::uuid,'nombres','n2',9,10,'{"nums":[1,2]}')->>'coins') = '1'
  and (pg_temp.p()->'levels'->'nombres:n2'->>'ok') = '1' and pg_temp.p()->'nums' ? '2', 'CP : série de nombres comme avant (pièce, niveau, nombres reconnus)');
select pg_temp.ok(pg_temp.p()->'gs' ? 'chiffres-r1-2', 'CP : les résultats GS restent');
-- copie admin vers une classe
insert into public.zoo_class_pedagogy values ('11111111-0000-0000-0000-000000000001','calcul','{}') on conflict do nothing;
insert into stub_reading values ('aaaaaaaa-0000-0000-0000-000000000001', '{"thr":{"s":30},"gs":{"lecture":{"prenom":false}},"tracks":{"x":{"lecture":"gs"}}}');
select public.admin_set_class_pedagogy('11111111-0000-0000-0000-000000000001','lecture',true);
select pg_temp.ok((select settings->'gs'->'lecture'->>'prenom' = 'false' and not settings ? 'tracks' from public.zoo_class_pedagogy where subject='lecture'), 'copie admin : gs copié, parcours des élèves jamais copiés');
\echo === CONTROLES GS CALCUL OK ===
