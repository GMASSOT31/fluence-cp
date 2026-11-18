-- Labo Zoo de Calcul : une roue à CHAQUE étoile (demandé par Gabriel le 18/11/2026).
-- Avant : une roue seulement quand une étape devient maîtrisée (2e étoile, ok >= 2).
-- Après : une roue quand l'étape est réussie (1re étoile, ok >= 1) + une quand elle est maîtrisée (2e étoile, ok >= 2).
-- Élèves existants : les étoiles déjà gagnées ne donnent pas de roues d'un coup (décision de Gabriel : « on repart d'ici ») :
--   wheels_used augmente du nombre de roues que la nouvelle règle ajoute ; une roue déjà en attente reste en attente.
-- Mise à jour seulement, aucune suppression. lab_student_state et lab_student_spin_wheel ne changent pas (ils appellent cette fonction).
update public.lab_calc_progress
   set wheels_used = least(wheels_used + coalesce((select count(*)::integer from jsonb_each(case when jsonb_typeof(progress->'levels') = 'object' then progress->'levels' else '{}'::jsonb end) l
        where jsonb_typeof(l.value) = 'object' and coalesce(l.value->>'ok', '') ~ '^[0-9]{1,6}$' and (l.value->>'ok')::integer = 1), 0)
        + coalesce((select count(*)::integer from jsonb_each(case when jsonb_typeof(progress->'levels') = 'object' then progress->'levels' else '{}'::jsonb end) l
        where jsonb_typeof(l.value) = 'object' and coalesce(l.value->>'ok', '') ~ '^[0-9]{1,6}$' and (l.value->>'ok')::integer >= 2), 0), 1000),
       updated_at = now()
 where student_id is not null;

create or replace function public.lab__wheels_earned(p jsonb) returns integer language sql immutable set search_path to ''
as $$ select coalesce((select sum(case when (l.value->>'ok')::integer >= 2 then 2 else 1 end)::integer
        from jsonb_each(case when jsonb_typeof(p->'levels') = 'object' then p->'levels' else '{}'::jsonb end) l
        where jsonb_typeof(l.value) = 'object' and coalesce(l.value->>'ok', '') ~ '^[0-9]{1,6}$' and (l.value->>'ok')::integer >= 1), 0) $$;
revoke all on function public.lab__wheels_earned(jsonb) from public, anon, authenticated;
