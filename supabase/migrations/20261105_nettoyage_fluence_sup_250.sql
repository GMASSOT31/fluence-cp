-- Retire des progressions les résultats de lecture dont la fluence (mclm) dépasse 250 corrects/min (valeurs frauduleuses).
-- sync_version augmente pour que les appareils ouverts se resynchronisent.
update public.student_progress p set
  progress = jsonb_set(p.progress, '{results}', coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(p.progress->'results') with ordinality t(e,o) where not (jsonb_typeof(e->'mclm')='number' and (e->>'mclm')::numeric > 250)), '[]'::jsonb)),
  sync_version = sync_version + 1, updated_at = now()
where jsonb_typeof(p.progress->'results')='array' and exists (select 1 from jsonb_array_elements(p.progress->'results') e where jsonb_typeof(e->'mclm')='number' and (e->>'mclm')::numeric > 250);
