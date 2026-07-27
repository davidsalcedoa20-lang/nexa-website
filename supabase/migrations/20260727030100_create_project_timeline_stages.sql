-- ==========================================================
-- NEXA HUB — 24. Línea de tiempo del proyecto (Etapas)
-- ==========================================================
-- Nueva capa jerárquica, por encima de los bloques existentes:
--
--   Proyecto -> ETAPA (nuevo) -> Bloque -> Sección -> Tarea
--
-- Es la "línea de tiempo" totalmente editable de la plantilla
-- oficial (crear/eliminar/renombrar/recolorear/reordenar etapas).
-- NO debe confundirse con la tabla legacy "project_stages"
-- (plantilla fija "Ruta NEXA", en desuso, sin tocar): por eso el
-- nombre elegido aquí es "project_timeline_stages".
-- ==========================================================

create table public.project_timeline_stages (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    name text not null,
    description text,
    color_hex text not null default '#2D8CFF',
    order_index integer not null default 0,
    status public.progress_status not null default 'pending',
    progress_percent integer not null default 0,
    estimated_date date,
    responsible_id uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint project_timeline_stages_progress_percent_range check (progress_percent between 0 and 100)
);

comment on table public.project_timeline_stages is
    'Etapa de la línea de tiempo de un proyecto (ej. "Ecosistema", "Desarrollo"). progress_percent/status se recalculan automáticamente a partir de sus bloques.';

create index project_timeline_stages_project_id_idx on public.project_timeline_stages (project_id);

alter table public.project_timeline_stages enable row level security;

create trigger set_updated_at before update on public.project_timeline_stages
    for each row execute function public.set_updated_at();
