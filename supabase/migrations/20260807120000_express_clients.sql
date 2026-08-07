-- ==========================================================
-- Clientes Express + proyectos internos (sin Auth / portal)
-- No modifica workspaces, profiles ni create-client.
-- ==========================================================

create table if not exists public.express_clients (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    phone text not null,
    notes text not null default '',
    company text,
    city text,
    whatsapp text,
    status text not null default 'active'
        check (status in ('active', 'inactive')),
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists express_clients_active_idx
    on public.express_clients (created_at desc)
    where deleted_at is null;

drop trigger if exists set_updated_at on public.express_clients;
create trigger set_updated_at before update on public.express_clients
    for each row execute function public.set_updated_at();

alter table public.express_clients enable row level security;

drop policy if exists express_clients_admin_all on public.express_clients;
create policy express_clients_admin_all on public.express_clients
    for all using (public.is_admin())
    with check (public.is_admin());

-- ----------------------------------------------------------

create table if not exists public.express_projects (
    id uuid primary key default gen_random_uuid(),
    express_client_id uuid not null references public.express_clients (id) on delete cascade,
    name text not null,
    project_type text not null default 'Otro',
    start_date date,
    due_date date,
    status text not null default 'not_started'
        check (status in ('not_started', 'in_progress', 'paused', 'in_review', 'completed', 'cancelled')),
    responsible_name text,
    observations text,
    drive_folder_id text,
    drive_folder_name text,
    drive_folder_url text,
    drive_connected boolean not null default false,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists express_projects_client_idx
    on public.express_projects (express_client_id, created_at desc)
    where deleted_at is null;

drop trigger if exists set_updated_at on public.express_projects;
create trigger set_updated_at before update on public.express_projects
    for each row execute function public.set_updated_at();

alter table public.express_projects enable row level security;

drop policy if exists express_projects_admin_all on public.express_projects;
create policy express_projects_admin_all on public.express_projects
    for all using (public.is_admin())
    with check (public.is_admin());
