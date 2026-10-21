-- Réponse de l'admin à un feedback, visible par l'enseignant(e) dans « Améliorations ».
-- Ajoute trois colonnes et une fonction ; aucune politique existante ne change.

alter table public.teacher_feedback
  add column if not exists reply text check (reply is null or char_length(btrim(reply)) between 1 and 4000),
  add column if not exists replied_at timestamptz,
  add column if not exists reply_seen_at timestamptz;

-- L'admin (politique feedback_admin_update, seule à autoriser une modification) écrit la réponse
-- et remet « vu » à zéro quand il la modifie
grant update (reply, replied_at, reply_seen_at) on public.teacher_feedback to authenticated;

-- L'enseignant(e) connecté(e) marque comme vues les réponses à SES messages (aucun autre droit d'écriture)
create or replace function public.feedback_mark_replies_seen()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Connexion enseignante requise'; end if;
  update public.teacher_feedback set reply_seen_at = now()
   where teacher_id = auth.uid() and reply is not null and reply_seen_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.feedback_mark_replies_seen() from public, anon;
grant execute on function public.feedback_mark_replies_seen() to authenticated;
