-- ==========================================================
-- NEXA HUB — 04. Plantilla oficial de la Ruta NEXA
-- ==========================================================
-- methodology_stages / methodology_blocks: definición maestra
-- y global de la metodología, mantenida por el admin y
-- reutilizada por todos los proyectos de todos los clientes.
-- Ver docs/database-design.md secciones 4.4 y 4.5.
-- ==========================================================

create table public.methodology_stages (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    order_index integer not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.methodology_stages is
    'Etapas oficiales de la Ruta NEXA (plantilla global, no pertenece a un proyecto concreto).';

create table public.methodology_blocks (
    id uuid primary key default gen_random_uuid(),
    stage_id uuid not null references public.methodology_stages (id) on delete cascade,
    name text not null,
    description text,
    order_index integer not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.methodology_blocks is
    'Bloques oficiales dentro de una etapa de la Ruta NEXA (plantilla global).';

create index methodology_blocks_stage_id_idx on public.methodology_blocks (stage_id);

alter table public.methodology_stages enable row level security;
alter table public.methodology_blocks enable row level security;
