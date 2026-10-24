-- Essai du laboratoire sur la base FACTICE (voir tools/sql/run_labo_tests.sh). Chaque contrôle affiche OK ou fait échouer le script.
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\o /dev/null
-- Comptes factices : A admin, B enseignant non autorisé (élèves S2 non autorisé, S3 autorisé nommément), C enseignant autorisé avec ses élèves (S1)
insert into public.teachers values ('aaaaaaaa-0000-0000-0000-000000000001','a@x.test','Admin','admin'),('bbbbbbbb-0000-0000-0000-000000000002','b@x.test','B','teacher'),('cccccccc-0000-0000-0000-000000000003','c@x.test','C','teacher');
insert into public.classes values ('11111111-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Classe B'),('22222222-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000003','Classe C');
insert into public.students(id,teacher_id,class_id,nickname) values
 ('51000000-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000002','S1'),
 ('52000000-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','S2'),
 ('53000000-0000-0000-0000-000000000003','bbbbbbbb-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','S3');
insert into public.student_sessions select encode(extensions.digest(t.tok,'sha256'),'hex'), t.sid, now()+interval '1 day'
  from (values (repeat('1',64),'51000000-0000-0000-0000-000000000001'::uuid),(repeat('2',64),'52000000-0000-0000-0000-000000000002'::uuid),(repeat('3',64),'53000000-0000-0000-0000-000000000003'::uuid)) t(tok,sid);
insert into public.student_progress values ('51000000-0000-0000-0000-000000000001',null,'{"coins":7}',3,0),('52000000-0000-0000-0000-000000000002',null,'{"coins":9}',5,0);
create temp table before_hash as select md5(string_agg(t::text, '|' order by student_id)) h from public.student_progress t;
grant all on before_hash to public;
\ir ../../supabase/migrations/20261112_labo_calcul.sql

create function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'OK  refus  : % (%)', label, sqlerrm; return; end;
  raise exception 'ECHEC : % aurait dû être refusé', label;
end $$;
create function pg_temp.expect(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'OK         : %', label; else raise exception 'ECHEC : %', label; end if; end $$;
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set C '''cccccccc-0000-0000-0000-000000000003'''
create function pg_temp.as_anon() returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub','',false); end $$;

-- 1. Labo désactivé par défaut : personne n'a accès, même s'il est dans la liste
reset role; select set_config('request.jwt.claim.sub', :A, false) \gset
insert into public.lab_access(subject_kind, subject_id, scope) values ('teacher','cccccccc-0000-0000-0000-000000000003','self_and_students'),('student','53000000-0000-0000-0000-000000000003','self');
set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select pg_temp.expect((public.lab_my_access(repeat('1',64))->>'allowed')::boolean = false, 'labo désactivé : S1 (classe autorisée) sans accès');
select pg_temp.expect((public.lab_my_access(repeat('3',64))->>'allowed')::boolean = false, 'labo désactivé : S3 (nommé) sans accès');
select pg_temp.expect(public.lab_my_access(null)->>'allowed' = 'false', 'anonyme sans jeton : faux');
select pg_temp.expect((public.lab_my_access('zzz')->>'allowed')::boolean = false, 'jeton invalide : faux');
reset role;
-- l'admin active l'interrupteur
select set_config('request.jwt.claim.sub', :A, false) \gset
set role authenticated;
select public.lab_admin_set_enabled(true);
reset role;

-- 2. Accès direct aux tables et aux fonctions internes refusé
set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select pg_temp.expect_fail('select * from public.lab_calc_progress', 'anon lit lab_calc_progress');
select pg_temp.expect_fail('select * from public.lab_access', 'anon lit lab_access');
select pg_temp.expect_fail('insert into public.lab_calc_progress(student_id,test_coins) values (gen_random_uuid(),99999)', 'anon écrit des pièces');
select pg_temp.expect_fail('select public.lab__student_allowed(''51000000-0000-0000-0000-000000000001'')', 'anon appelle une fonction interne');
select pg_temp.expect_fail('select public.lab_admin_state()', 'anon appelle lab_admin_state');
select pg_temp.expect_fail('select public.lab_teacher_results()', 'anon appelle lab_teacher_results');
reset role;
select set_config('request.jwt.claim.sub', :B, false) \gset
set role authenticated;
select pg_temp.expect_fail('select * from public.lab_calc_settings', 'enseignant lit lab_calc_settings');
select pg_temp.expect_fail('select public.lab_admin_state()', 'enseignant non admin : lab_admin_state');
select pg_temp.expect_fail('select public.lab_admin_grant(''teacher'',''bbbbbbbb-0000-0000-0000-000000000002'')', 'enseignant s''autorise lui-même');
select pg_temp.expect_fail('select public.lab_admin_set_enabled(false)', 'enseignant coupe l''interrupteur');
select pg_temp.expect_fail('select public.lab_teacher_settings_get()', 'enseignant B non autorisé : réglages');
select pg_temp.expect_fail('select public.lab_teacher_results()', 'enseignant B non autorisé : résultats');
select pg_temp.expect_fail('update public.app_settings set value = ''{"enabled":false}'' where key=''lab_calcul''', 'enseignant modifie app_settings (RLS)');
select pg_temp.expect(public.lab_my_access()->>'allowed' = 'false', 'enseignant B : lab_my_access faux');
reset role;

-- 3. Élève non autorisé : refus sur toutes les actions
set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select pg_temp.expect_fail('select public.lab_student_state(repeat(''2'',64))', 'S2 non autorisé : état');
select pg_temp.expect_fail('select public.lab_student_submit_round(repeat(''2'',64), gen_random_uuid(), ''nombres'', ''n1'', 10, 10)', 'S2 non autorisé : série');
select pg_temp.expect_fail('select public.lab_student_buy_play(repeat(''2'',64), gen_random_uuid())', 'S2 non autorisé : boutique');
select pg_temp.expect_fail('select public.lab_student_state(repeat(''9'',64))', 'jeton inconnu : état');
reset role;

-- 4. Élèves testeurs : S1 (par la classe de C) et S3 (nommément)
set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select pg_temp.expect((public.lab_my_access(repeat('1',64))->>'allowed')::boolean, 'S1 autorisé via son enseignant (self_and_students)');
select pg_temp.expect((public.lab_my_access(repeat('3',64))->>'allowed')::boolean, 'S3 autorisé nommément');
select pg_temp.expect(not (public.lab_my_access(repeat('2',64))->>'allowed')::boolean, 'S2 reste refusé');
select pg_temp.expect_fail('select public.lab_student_submit_round(repeat(''1'',64), gen_random_uuid(), ''divination'', ''n1'', 5, 5)', 'activité inconnue');
select pg_temp.expect_fail('select public.lab_student_submit_round(repeat(''1'',64), gen_random_uuid(), ''nombres'', ''n1'', 11, 10)', 'plus de bonnes réponses que de questions');
select pg_temp.expect_fail('select public.lab_student_submit_round(repeat(''1'',64), gen_random_uuid(), ''nombres'', ''N 1;'', 5, 5)', 'niveau mal formé');
-- série parfaite : 2 pièces de test ; rejouée : pas de double crédit
select set_config('t.r1', gen_random_uuid()::text, false) \gset
select (public.lab_student_submit_round(repeat('1',64), current_setting('t.r1')::uuid, 'nombres', 'n1', 10, 10, '{"replays":3,"helps":0,"ms":2500}'))->>'coins' as c \gset
select pg_temp.expect(:c = 2, 'série parfaite : 2 pièces de test');
select (public.lab_student_submit_round(repeat('1',64), current_setting('t.r1')::uuid, 'nombres', 'n1', 10, 10))->>'coins' as c2 \gset
select pg_temp.expect(:c2 = 0, 'même série rejouée : aucun crédit supplémentaire');
select pg_temp.expect((public.lab_student_state(repeat('1',64))->>'test_coins')::int = 2, 'solde de test = 2 après rejeu');
-- série ratée : pas de pièce ; série à 80 % : 1 pièce
select (public.lab_student_submit_round(repeat('1',64), gen_random_uuid(), 'addition', 'a1', 4, 10))->>'coins' as c3 \gset
select pg_temp.expect(:c3 = 0, 'série à 40 % : pas de pièce');
select (public.lab_student_submit_round(repeat('1',64), gen_random_uuid(), 'addition', 'a1', 8, 10))->>'coins' as c4 \gset
select pg_temp.expect(:c4 = 1, 'série à 80 % : 1 pièce');
-- plafond quotidien : 10 séries récompensées par jour
do $$ declare i int; n int := 0; begin
  for i in 1..15 loop n := n + (public.lab_student_submit_round(repeat('1',64), gen_random_uuid(), 'soustraction', 's1', 10, 10)->>'coins')::int; end loop;
  if n <> 16 then raise exception 'ECHEC : plafond quotidien (16 pièces attendues : 8 séries restantes sur 10, déjà 2 récompensées), obtenu %', n; end if; raise notice 'OK         : plafond de 10 séries récompensées par jour (% pièces pour les 8 restantes)', n; end $$;
-- boutique de test : 3 pièces = 1 droit ; opération rejouée sans effet
select set_config('t.o1', gen_random_uuid()::text, false) \gset
select (public.lab_student_buy_play(repeat('1',64), current_setting('t.o1')::uuid))->>'done' as d1 \gset
select pg_temp.expect(:'d1' = 'true', 'achat d''un droit de jeu de test');
select (public.lab_student_buy_play(repeat('1',64), current_setting('t.o1')::uuid))->>'done' as d2 \gset
select pg_temp.expect(:'d2' = 'false', 'achat rejoué : sans effet');
select set_config('t.o2', gen_random_uuid()::text, false) \gset
select (public.lab_student_use_play(repeat('1',64), current_setting('t.o2')::uuid))->>'done' as d3 \gset
select pg_temp.expect(:'d3' = 'true', 'partie de test lancée (1 droit consommé)');
select (public.lab_student_use_play(repeat('1',64), current_setting('t.o2')::uuid))->>'done' as d4 \gset
select pg_temp.expect(:'d4' = 'false', 'lancement rejoué : sans effet');
select (public.lab_student_use_play(repeat('1',64), gen_random_uuid()))->>'reason' as d5 \gset
select pg_temp.expect(:'d5' = 'no_play', 'plus de droit : partie refusée');
reset role;

-- 5. Résultats séparés + enseignants
select set_config('request.jwt.claim.sub', :C, false) \gset
set role authenticated;
select pg_temp.expect(public.lab_my_access()->>'allowed' = 'true', 'enseignant C autorisé');
select pg_temp.expect(jsonb_array_length(public.lab_teacher_results()) = 1, 'C voit uniquement ses élèves');
select pg_temp.expect((public.lab_teacher_results()->0->'progress'->'levels'->'nombres:n1'->>'c')::int = 10, 'résultat « nombres:n1 » enregistré');
select public.lab_teacher_settings_set('{"pass":10,"questions":99,"voice":true,"levels":{"nombres":["n1","n2","x;drop"]},"evil":1}') as s \gset
select pg_temp.expect((public.lab_teacher_settings_get()->>'pass')::int = 50 and (public.lab_teacher_settings_get()->>'questions')::int = 20 and not public.lab_teacher_settings_get() ? 'evil', 'réglages bornés et nettoyés');
select pg_temp.expect(jsonb_array_length(public.lab_teacher_settings_get()->'levels'->'nombres') = 2, 'identifiants de niveau invalides écartés');
reset role;
select set_config('request.jwt.claim.sub', :A, false) \gset
set role authenticated;
select pg_temp.expect(jsonb_array_length(public.lab_teacher_results()) = 3, 'admin : résultats de tous les élèves');
select pg_temp.expect(jsonb_array_length(public.lab_admin_state()->'access') = 2, 'admin : liste des accès');
reset role;

-- 5b. Retrait d'un accès : la ligne est conservée (revoked_at) et l'élève perd l'accès tout de suite
select set_config('request.jwt.claim.sub', :A, false) \gset
select a.id as revoke_id from public.lab_access a where a.subject_id = '53000000-0000-0000-0000-000000000003' \gset
set role authenticated;
select public.lab_admin_revoke(:'revoke_id');
select pg_temp.expect(jsonb_array_length(public.lab_admin_state()->'access') = 1, 'admin : accès retiré de la liste');
reset role;
set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select pg_temp.expect(not (public.lab_my_access(repeat('3',64))->>'allowed')::boolean, 'S3 : accès retiré, refusé immédiatement');
reset role;
select pg_temp.expect((select count(*) from public.lab_access where revoked_at is not null) = 1, 'la ligne retirée est conservée (aucune suppression)');
select set_config('request.jwt.claim.sub', :A, false) \gset
set role authenticated; select public.lab_admin_grant('student','53000000-0000-0000-0000-000000000003'); reset role;
set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select pg_temp.expect((public.lab_my_access(repeat('3',64))->>'allowed')::boolean, 'S3 : accès rétabli par une nouvelle autorisation');
reset role;

-- 6. Interrupteur coupé : tout se referme d'un coup
select set_config('request.jwt.claim.sub', :A, false) \gset
set role authenticated; select public.lab_admin_set_enabled(false); reset role;
set role anon; select set_config('request.jwt.claim.sub','',false) \gset
select pg_temp.expect_fail('select public.lab_student_state(repeat(''1'',64))', 'interrupteur coupé : S1 refusé');
reset role;
select set_config('request.jwt.claim.sub', :C, false) \gset
set role authenticated; select pg_temp.expect_fail('select public.lab_teacher_results()', 'interrupteur coupé : C refusé'); reset role;

-- 7. Aucune modification des vraies données
select pg_temp.expect((select md5(string_agg(t::text, '|' order by student_id)) from public.student_progress t) = (select h from before_hash), 'student_progress strictement inchangée (pièces et progression de lecture)');
