-- ==========================================================
-- NEXA HUB — Backfill assignee_id en tareas de cliente
-- ==========================================================
-- El sistema ya tenía project_tasks.assignee_id. Las tareas con
-- task_type IN ('client', 'approval') a menudo no tenían
-- assignee_id porque el responsable se infería solo del tipo.
-- Esta migración asigna el perfil del cliente del proyecto para
-- que la UI pueda mostrar un responsable específico y el panel
-- admin pueda filtrar "Mis tareas" por assignee_id.
-- No cambia columnas, enums, RLS ni Auth.
-- ==========================================================

update public.project_tasks as t
set assignee_id = w.client_id
from public.project_sections as s
join public.project_phases as ph on ph.id = s.phase_id
join public.projects as p on p.id = ph.project_id
join public.workspaces as w on w.id = p.workspace_id
where t.section_id = s.id
  and t.task_type in ('client', 'approval')
  and t.assignee_id is null
  and w.client_id is not null;
