-- ==========================================================
-- NEXA HUB — 05. Instancia de la Ruta NEXA por proyecto + Tareas
-- ==========================================================
-- project_stages / project_blocks: copia real de la plantilla
-- oficial aplicada a un proyecto concreto, con su propio avance.
-- tasks: unidad atómica de trabajo dentro de un bloque.
-- Ver docs/database-design.md secciones 4.6, 4.7 y 4.8.
-- ==========================================================

create table public.project_stages (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    methodology_stage_id uuid references public.methodology_stages (id) on delete set null,
    name text not null,
    order_index integer not null,
    status public.stage_status not null default 'not_started',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.project_stages is
    'Copia real de una etapa de la Ruta NEXA aplicada a un proyecto específico, con avance propio.';

create table public.project_blocks (
    id uuid primary key default gen_random_uuid(),
    project_stage_id uuid not null references public.project_stages (id) on delete cascade,
    methodology_block_id uuid references public.methodology_blocks (id) on delete set null,
    name text not null,
    order_index integer not null,
    status public.block_status not null default 'not_started',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.project_blocks is
    'Copia real de un bloque de la Ruta NEXA aplicada a un proyecto específico, con avance propio.';

create table public.tasks (
    id uuid primary key default gen_random_uuid(),
    project_block_id uuid not null references public.project_blocks (id) on delete cascade,
    title text not null,
    description text,
    responsible_id uuid references public.profiles (id) on delete set null,
    status public.task_status not null default 'pending',
    priority public.task_priority not null default 'medium',
    due_date date,
    order_index integer not null default 0,
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.tasks is
    'Tarea individual: título, descripción, responsable, estado, prioridad, fecha y orden.';

create index project_stages_project_id_idx on public.project_stages (project_id);
create index project_stages_methodology_stage_id_idx on public.project_stages (methodology_stage_id);
create index project_blocks_project_stage_id_idx on public.project_blocks (project_stage_id);
create index tasks_project_block_id_idx on public.tasks (project_block_id);
create index tasks_responsible_id_idx on public.tasks (responsible_id);
create index tasks_status_idx on public.tasks (status);
create index tasks_due_date_idx on public.tasks (due_date);

alter table public.project_stages enable row level security;
alter table public.project_blocks enable row level security;
alter table public.tasks enable row level security;
