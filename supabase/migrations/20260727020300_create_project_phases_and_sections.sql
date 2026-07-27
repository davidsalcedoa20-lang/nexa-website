-- ==========================================================
-- NEXA HUB — 13. Motor de Proyectos: Bloques (fases) y Secciones
-- ==========================================================
-- Ver docs/proyectos-module-design.md secciones 2.3 y 2.4.
-- No confundir con las tablas legacy "project_stages"/"project_blocks"
-- (plantilla fija "Ruta NEXA", en desuso, sin tocar).
-- ==========================================================

create table public.project_phases (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    name text not null,
    description text,
    order_index integer not null default 0,
    duration_days integer,
    planned_start_date date,
    planned_end_date date,
    status public.progress_status not null default 'pending',
    progress_percent integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint project_phases_progress_percent_range check (progress_percent between 0 and 100)
);

comment on table public.project_phases is
    'Bloque (fase) de un proyecto. progress_percent se recalcula automáticamente (ver funciones/triggers).';

create table public.project_sections (
    id uuid primary key default gen_random_uuid(),
    phase_id uuid not null references public.project_phases (id) on delete cascade,
    name text not null,
    order_index integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.project_sections is
    'Sección dentro de un bloque (ej. "Bio", "Fotografía", "Contenido").';

create index project_phases_project_id_idx on public.project_phases (project_id);
create index project_sections_phase_id_idx on public.project_sections (phase_id);

alter table public.project_phases enable row level security;
alter table public.project_sections enable row level security;
