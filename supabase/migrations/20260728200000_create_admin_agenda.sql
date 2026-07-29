-- ==========================================================
-- NEXA HUB — Mi Agenda (tareas personales de administradores)
-- ==========================================================
-- Tabla independiente admin_tasks: NO se relaciona con
-- project_tasks ni con la Ruta NEXA. Cada administrador solo
-- ve y gestiona SUS propias tarjetas (admin_id = auth.uid()).
--
-- Preparado para futura integración con IA (crear / priorizar /
-- reorganizar tareas automáticamente) sin cambiar el esquema.
-- ==========================================================

create type public.admin_task_priority as enum (
    'critical',
    'high',
    'medium',
    'low'
);

create type public.admin_task_status as enum (
    'pending',
    'in_progress',
    'blocked',
    'completed'
);

create table public.admin_tasks (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    title text not null,
    description text,
    project_id uuid references public.projects (id) on delete set null,
    status public.admin_task_status not null default 'pending',
    priority public.admin_task_priority not null default 'medium',
    estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
    task_date date not null default (timezone('utc', now()))::date,
    task_time time,
    tags text[] not null default '{}',
    position integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.admin_tasks is
    'Agenda personal del administrador. Independiente de project_tasks / Ruta NEXA. Cada fila pertenece a un solo admin (admin_id).';

comment on column public.admin_tasks.project_id is
    'Proyecto relacionado opcional (solo referencia visual). NULL = sin proyecto.';

comment on column public.admin_tasks.position is
    'Orden dentro del mismo día (menor = arriba). Usado por drag & drop.';

create index admin_tasks_admin_id_idx on public.admin_tasks (admin_id);
create index admin_tasks_admin_date_idx on public.admin_tasks (admin_id, task_date);
create index admin_tasks_admin_status_idx on public.admin_tasks (admin_id, status);
create index admin_tasks_project_id_idx on public.admin_tasks (project_id);

create trigger set_updated_at before update on public.admin_tasks
    for each row execute function public.set_updated_at();

-- Solo admins pueden tocar la tabla, y únicamente sus propias filas.
alter table public.admin_tasks enable row level security;

create policy admin_tasks_select_own on public.admin_tasks
    for select
    using (public.is_admin() and admin_id = auth.uid());

create policy admin_tasks_insert_own on public.admin_tasks
    for insert
    with check (public.is_admin() and admin_id = auth.uid());

create policy admin_tasks_update_own on public.admin_tasks
    for update
    using (public.is_admin() and admin_id = auth.uid())
    with check (public.is_admin() and admin_id = auth.uid());

create policy admin_tasks_delete_own on public.admin_tasks
    for delete
    using (public.is_admin() and admin_id = auth.uid());

-- Realtime para refrescos de la agenda.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'admin_tasks'
    ) then
        alter publication supabase_realtime add table public.admin_tasks;
    end if;
end $$;
