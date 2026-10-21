-- Retours des enseignant(e)s (onglet « Améliorations ») lus par l'admin (onglet « Feedback »).
-- Nouvelle table seulement ; rien d'existant ne change.

create table if not exists public.teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  kind text not null check (kind in ('avis', 'pedago', 'ergo', 'fonction', 'bug', 'question')),
  message text not null check (char_length(btrim(message)) between 3 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists teacher_feedback_teacher_idx on public.teacher_feedback(teacher_id);
create index if not exists teacher_feedback_unread_idx on public.teacher_feedback(read_at);
create index if not exists teacher_feedback_created_idx on public.teacher_feedback(created_at desc);

alter table public.teacher_feedback enable row level security;

-- Lecture : ses propres retours, l'admin voit tout
create policy feedback_select on public.teacher_feedback for select to authenticated
  using (teacher_id = (select auth.uid()) or public.is_zoo_admin());
-- Envoi : pour soi seulement, jamais déjà « lu »
create policy feedback_insert on public.teacher_feedback for insert to authenticated
  with check (teacher_id = (select auth.uid()) and read_at is null);
-- Lu / non lu : admin seulement (et seule la colonne read_at est modifiable, voir les droits)
create policy feedback_admin_update on public.teacher_feedback for update to authenticated
  using (public.is_zoo_admin()) with check (public.is_zoo_admin());

revoke all on public.teacher_feedback from public, anon, authenticated;
grant select on public.teacher_feedback to authenticated;
grant insert (teacher_id, kind, message) on public.teacher_feedback to authenticated;
grant update (read_at) on public.teacher_feedback to authenticated;
