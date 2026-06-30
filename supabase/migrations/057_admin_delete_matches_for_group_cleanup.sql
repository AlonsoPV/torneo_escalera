-- Permite a administradores eliminar grupos vacíos aunque tengan partidos generados.
-- Sin políticas DELETE en tablas hijas, el ON DELETE CASCADE desde groups/matches falla bajo RLS.

drop policy if exists matches_delete_admin on public.matches;
create policy matches_delete_admin
  on public.matches for delete
  to authenticated
  using (public.is_admin());

drop policy if exists match_score_logs_delete_admin on public.match_score_logs;
create policy match_score_logs_delete_admin
  on public.match_score_logs for delete
  to authenticated
  using (public.is_admin());

drop policy if exists staff_match_notifications_delete_admin on public.staff_match_notifications;
create policy staff_match_notifications_delete_admin
  on public.staff_match_notifications for delete
  to authenticated
  using (public.is_admin());
