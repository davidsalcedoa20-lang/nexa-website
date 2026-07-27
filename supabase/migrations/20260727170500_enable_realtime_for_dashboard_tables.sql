-- ==========================================================
-- NEXA HUB — 24. Realtime para Dashboard / Tareas standalone
-- ==========================================================
-- Habilita Supabase Realtime (postgres_changes) sobre las tablas
-- que el Dashboard administrativo y la sección "Tareas" necesitan
-- refrescar automáticamente sin recargar la página:
--   - public.profiles       (nuevos clientes/admins, cambios de rol)
--   - public.workspaces     (nuevo cliente / espacio de trabajo)
--   - public.projects       (nuevo proyecto, cambio de estado)
--   - public.project_tasks  (nueva tarea, cambio de estado/prioridad)
--
-- Por defecto una tabla NO emite eventos de Realtime hasta que se
-- agrega explícitamente a la publicación "supabase_realtime". El
-- bloque DO evita error si ya estuviera agregada (idempotente, se
-- puede correr más de una vez sin romper nada).
-- RLS sigue aplicando normalmente sobre los eventos de Realtime:
-- un cliente autenticado solo recibirá los cambios que sus propias
-- políticas (is_own_project, etc.) le permitirían leer por select.
-- ==========================================================

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
    ) then
        alter publication supabase_realtime add table public.profiles;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workspaces'
    ) then
        alter publication supabase_realtime add table public.workspaces;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects'
    ) then
        alter publication supabase_realtime add table public.projects;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'project_tasks'
    ) then
        alter publication supabase_realtime add table public.project_tasks;
    end if;
end $$;
