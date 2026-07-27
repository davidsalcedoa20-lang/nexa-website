-- ==========================================================
-- NEXA HUB — 03. Workspaces y Proyectos
-- ==========================================================
-- workspaces: el "Espacio de Trabajo" único de cada cliente.
-- projects:   uno o varios proyectos dentro de un workspace.
-- Ver docs/database-design.md secciones 4.2 y 4.3.
-- ==========================================================

create table public.workspaces (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null unique references public.profiles (id) on delete cascade,
    name text not null,
    status public.workspace_status not null default 'active',
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.workspaces is
    'Espacio de trabajo privado de un cliente. client_id es UNIQUE: 1 cliente = 1 workspace.';

create table public.projects (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    name text not null,
    description text,
    status public.project_status not null default 'not_started',
    start_date date,
    end_date date,
    order_index integer not null default 0,
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.projects is
    'Proyecto de un cliente dentro de su workspace. Cada proyecto ejecuta su propia instancia de la Ruta NEXA.';

create index projects_workspace_id_idx on public.projects (workspace_id);

alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
