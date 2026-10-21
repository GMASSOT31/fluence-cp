-- L'admin peut supprimer des messages de feedback (par exemple ses messages de test).
-- Ajoute une politique et un droit ; rien d'existant ne change. Les enseignant(e)s ne peuvent toujours rien supprimer.

create policy feedback_admin_delete on public.teacher_feedback for delete to authenticated
  using (public.is_zoo_admin());

grant delete on public.teacher_feedback to authenticated;
