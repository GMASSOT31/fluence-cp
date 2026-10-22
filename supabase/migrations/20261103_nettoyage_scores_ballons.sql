-- Retire les anciens scores de « Ballons des sons » (jeu supprimé) des progressions des élèves.
-- Les pièces déjà gagnées sont conservées ; sync_version augmente pour que les appareils ouverts se resynchronisent.
update public.student_progress
set progress = progress #- '{hi,ballons}', sync_version = sync_version + 1, updated_at = now()
where progress->'hi' ? 'ballons';
