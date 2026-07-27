-- ==========================================================
-- NEXA HUB — 10. Motor de Proyectos: tipos enumerados
-- ==========================================================
-- Ver docs/proyectos-module-design.md secciones 2 y 4.
--
-- No se modifica ningún enum existente (user_role, workspace_status,
-- project_status, task_priority se reutilizan tal cual). Las tablas
-- legacy (methodology_stages/methodology_blocks/project_stages/
-- project_blocks/tasks) y sus enums (stage_status, block_status,
-- task_status) quedan intactas y en desuso, sin tocarlas.
-- ==========================================================

create type public.task_type as enum ('client', 'nexa', 'approval');

-- Vocabulario compartido por project_phases.status y project_tasks.status.
create type public.progress_status as enum (
    'pending',
    'in_progress',
    'waiting_approval',
    'completed',
    'blocked',
    'finished'
);

create type public.approval_decision as enum ('pending', 'approved', 'changes_requested');

create type public.deliverable_status as enum ('draft', 'delivered', 'approved', 'rejected');
