-- ==========================================================
-- NEXA HUB — 19. Motor de Proyectos: Row Level Security
-- ==========================================================
-- Mismo criterio general que docs/database-design.md sección 6:
-- el admin ve/edita todo, el cliente solo su propio workspace.
-- Ver docs/proyectos-module-design.md sección 6.
-- ==========================================================

-- ----------------------------------------------------------
-- 19.0 Función auxiliar: ¿el proyecto pertenece al cliente actual?
-- ----------------------------------------------------------
create function public.is_own_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.projects p
        join public.workspaces w on w.id = p.workspace_id
        where p.id = p_project_id and w.client_id = auth.uid()
    );
$$;

-- ----------------------------------------------------------
-- 19.1 project_types — catálogo administrable
-- ----------------------------------------------------------
create policy project_types_admin_all on public.project_types
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_types_select_authenticated on public.project_types
    for select
    using (is_active = true or public.is_admin());

-- ----------------------------------------------------------
-- 19.2 project_phases
-- ----------------------------------------------------------
create policy project_phases_admin_all on public.project_phases
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_phases_select_own on public.project_phases
    for select
    using (public.is_own_project(project_id));

-- ----------------------------------------------------------
-- 19.3 project_sections
-- ----------------------------------------------------------
create policy project_sections_admin_all on public.project_sections
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_sections_select_own on public.project_sections
    for select
    using (
        exists (
            select 1 from public.project_phases ph
            where ph.id = project_sections.phase_id
              and public.is_own_project(ph.project_id)
        )
    );

-- ----------------------------------------------------------
-- 19.4 project_tasks
-- El cliente puede leer todas las tareas de su proyecto, pero
-- solo puede cambiar el "status" de SUS PROPIAS tareas (task_type
-- = client). Nota: NO se usa GRANT de columnas porque admin y
-- cliente comparten el mismo rol de Postgres ("authenticated");
-- la restricción real de columnas vive en un trigger BEFORE UPDATE
-- (ver migración restrict_client_write_columns.sql).
-- ----------------------------------------------------------
create policy project_tasks_admin_all on public.project_tasks
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_tasks_select_own on public.project_tasks
    for select
    using (
        exists (
            select 1
            from public.project_sections s
            join public.project_phases ph on ph.id = s.phase_id
            where s.id = project_tasks.section_id
              and public.is_own_project(ph.project_id)
        )
    );

create policy project_tasks_update_own_client_tasks on public.project_tasks
    for update
    using (
        task_type = 'client'
        and exists (
            select 1
            from public.project_sections s
            join public.project_phases ph on ph.id = s.phase_id
            where s.id = project_tasks.section_id
              and public.is_own_project(ph.project_id)
        )
    )
    with check (task_type = 'client');

-- ----------------------------------------------------------
-- 19.5 approvals
-- El cliente puede decidir (aprobar / solicitar cambios) sobre
-- las aprobaciones de sus propios proyectos.
-- ----------------------------------------------------------
create policy approvals_admin_all on public.approvals
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy approvals_select_own on public.approvals
    for select
    using (
        exists (
            select 1
            from public.project_tasks t
            join public.project_sections s on s.id = t.section_id
            join public.project_phases ph on ph.id = s.phase_id
            where t.id = approvals.task_id
              and public.is_own_project(ph.project_id)
        )
    );

create policy approvals_update_own on public.approvals
    for update
    using (
        exists (
            select 1
            from public.project_tasks t
            join public.project_sections s on s.id = t.section_id
            join public.project_phases ph on ph.id = s.phase_id
            where t.id = approvals.task_id
              and public.is_own_project(ph.project_id)
        )
    )
    with check (decision in ('approved', 'changes_requested'));

-- ----------------------------------------------------------
-- 19.6 project_dependencies
-- ----------------------------------------------------------
create policy project_dependencies_admin_all on public.project_dependencies
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_dependencies_select_own on public.project_dependencies
    for select
    using (
        exists (
            select 1 from public.project_phases ph
            where ph.id = project_dependencies.phase_id
              and public.is_own_project(ph.project_id)
        )
    );

-- ----------------------------------------------------------
-- 19.7 project_files
-- El cliente puede ver los archivos visibles de su proyecto y
-- subir archivos propios (visible_to_client siempre true en su caso).
-- ----------------------------------------------------------
create policy project_files_admin_all on public.project_files
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_files_select_own on public.project_files
    for select
    using (visible_to_client = true and public.is_own_project(project_id));

create policy project_files_insert_own on public.project_files
    for insert
    with check (
        uploaded_by = auth.uid()
        and visible_to_client = true
        and public.is_own_project(project_id)
    );

-- ----------------------------------------------------------
-- 19.8 project_deliverables
-- El cliente puede leer y aprobar/rechazar entregables enviados.
-- ----------------------------------------------------------
create policy project_deliverables_admin_all on public.project_deliverables
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_deliverables_select_own on public.project_deliverables
    for select
    using (public.is_own_project(project_id));

create policy project_deliverables_update_own on public.project_deliverables
    for update
    using (public.is_own_project(project_id) and status = 'delivered')
    with check (status in ('approved', 'rejected'));

-- ----------------------------------------------------------
-- 19.9 project_comments
-- El cliente puede leer y escribir comentarios en su propio proyecto.
-- ----------------------------------------------------------
create policy project_comments_admin_all on public.project_comments
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_comments_select_own on public.project_comments
    for select
    using (public.is_own_project(project_id));

create policy project_comments_insert_own on public.project_comments
    for insert
    with check (author_id = auth.uid() and public.is_own_project(project_id));

-- ----------------------------------------------------------
-- 19.10 project_timeline_events
-- Solo lectura para el cliente. La escritura ocurre únicamente
-- desde funciones SECURITY DEFINER (triggers del sistema).
-- ----------------------------------------------------------
create policy project_timeline_events_admin_all on public.project_timeline_events
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_timeline_events_select_own on public.project_timeline_events
    for select
    using (public.is_own_project(project_id));
