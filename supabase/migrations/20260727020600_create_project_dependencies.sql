-- ==========================================================
-- NEXA HUB — 16. Motor de Proyectos: Dependencias inteligentes
-- ==========================================================
-- Ver docs/proyectos-module-design.md sección 2.7.
-- Un bloque puede depender de: otro bloque completo, una tarea
-- puntual, o un entregable puntual. Varias filas = lógica "Y"
-- (deben cumplirse todas).
-- ==========================================================

create table public.project_dependencies (
    id uuid primary key default gen_random_uuid(),
    phase_id uuid not null references public.project_phases (id) on delete cascade,
    depends_on_phase_id uuid references public.project_phases (id) on delete cascade,
    depends_on_task_id uuid references public.project_tasks (id) on delete cascade,
    depends_on_deliverable_id uuid references public.project_deliverables (id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint project_dependencies_single_target check (
        (
            (depends_on_phase_id is not null)::int +
            (depends_on_task_id is not null)::int +
            (depends_on_deliverable_id is not null)::int
        ) = 1
    ),
    constraint project_dependencies_not_self check (phase_id <> depends_on_phase_id)
);

comment on table public.project_dependencies is
    'Dependencia de un bloque hacia otro bloque, tarea o entregable. Exactamente un "depends_on_*" por fila.';

create index project_dependencies_phase_id_idx on public.project_dependencies (phase_id);

alter table public.project_dependencies enable row level security;

-- ----------------------------------------------------------
-- ¿Está un bloque desbloqueado? (todas sus dependencias satisfechas)
-- ----------------------------------------------------------
create function public.is_phase_unblocked(p_phase_id uuid)
returns boolean
language sql
stable
as $$
    select not exists (
        select 1
        from public.project_dependencies d
        left join public.project_phases ph on ph.id = d.depends_on_phase_id
        left join public.project_tasks t on t.id = d.depends_on_task_id
        left join public.project_deliverables dl on dl.id = d.depends_on_deliverable_id
        where d.phase_id = p_phase_id
          and not (
                (d.depends_on_phase_id is not null and ph.status = 'finished')
             or (d.depends_on_task_id is not null and t.status = 'completed')
             or (d.depends_on_deliverable_id is not null and dl.status = 'approved')
          )
    );
$$;

comment on function public.is_phase_unblocked(uuid) is
    'True si el bloque no tiene dependencias o todas están satisfechas (fase finished / tarea completed / entregable approved).';
