-- ==========================================================
-- NEXA HUB — 07. Row Level Security (RLS)
-- ==========================================================
-- Regla general: el admin ve y edita todo. El cliente solo
-- puede leer (SELECT) lo que pertenece a su propio workspace.
-- Ver docs/database-design.md sección 6.
-- ==========================================================

-- ----------------------------------------------------------
-- 7.0 Función auxiliar is_admin()
-- SECURITY DEFINER para evitar recursión de RLS sobre profiles.
-- ----------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    );
$$;

-- ----------------------------------------------------------
-- 7.1 profiles
-- ----------------------------------------------------------
create policy profiles_admin_all on public.profiles
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy profiles_select_own on public.profiles
    for select
    using (id = auth.uid());

-- Función auxiliar para exponer solo nombre/avatar de cualquier
-- perfil (por ejemplo, para mostrar el "responsable" de una
-- tarea a un cliente sin exponer email/teléfono/rol de otros).
create function public.get_public_profile(profile_id uuid)
returns table (id uuid, full_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
    select id, full_name, avatar_url
    from public.profiles
    where id = profile_id;
$$;

grant execute on function public.get_public_profile(uuid) to authenticated;

-- ----------------------------------------------------------
-- 7.2 workspaces
-- ----------------------------------------------------------
create policy workspaces_admin_all on public.workspaces
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy workspaces_select_own on public.workspaces
    for select
    using (client_id = auth.uid());

-- ----------------------------------------------------------
-- 7.3 projects
-- ----------------------------------------------------------
create policy projects_admin_all on public.projects
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy projects_select_own on public.projects
    for select
    using (
        exists (
            select 1 from public.workspaces w
            where w.id = projects.workspace_id
              and w.client_id = auth.uid()
        )
    );

-- ----------------------------------------------------------
-- 7.4 methodology_stages / methodology_blocks
-- Lectura libre para cualquier usuario autenticado (información
-- de referencia, sin datos sensibles). Escritura solo admin.
-- ----------------------------------------------------------
create policy methodology_stages_admin_all on public.methodology_stages
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy methodology_stages_select_authenticated on public.methodology_stages
    for select
    using (auth.role() = 'authenticated');

create policy methodology_blocks_admin_all on public.methodology_blocks
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy methodology_blocks_select_authenticated on public.methodology_blocks
    for select
    using (auth.role() = 'authenticated');

-- ----------------------------------------------------------
-- 7.5 project_stages
-- ----------------------------------------------------------
create policy project_stages_admin_all on public.project_stages
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_stages_select_own on public.project_stages
    for select
    using (
        exists (
            select 1
            from public.projects p
            join public.workspaces w on w.id = p.workspace_id
            where p.id = project_stages.project_id
              and w.client_id = auth.uid()
        )
    );

-- ----------------------------------------------------------
-- 7.6 project_blocks
-- ----------------------------------------------------------
create policy project_blocks_admin_all on public.project_blocks
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy project_blocks_select_own on public.project_blocks
    for select
    using (
        exists (
            select 1
            from public.project_stages ps
            join public.projects p on p.id = ps.project_id
            join public.workspaces w on w.id = p.workspace_id
            where ps.id = project_blocks.project_stage_id
              and w.client_id = auth.uid()
        )
    );

-- ----------------------------------------------------------
-- 7.7 tasks
-- ----------------------------------------------------------
create policy tasks_admin_all on public.tasks
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy tasks_select_own on public.tasks
    for select
    using (
        exists (
            select 1
            from public.project_blocks pb
            join public.project_stages ps on ps.id = pb.project_stage_id
            join public.projects p on p.id = ps.project_id
            join public.workspaces w on w.id = p.workspace_id
            where pb.id = tasks.project_block_id
              and w.client_id = auth.uid()
        )
    );
