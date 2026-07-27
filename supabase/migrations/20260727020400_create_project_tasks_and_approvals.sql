-- ==========================================================
-- NEXA HUB — 14. Motor de Proyectos: Tareas y Aprobaciones
-- ==========================================================
-- Ver docs/proyectos-module-design.md secciones 2.5 y 2.6.
-- No confundir con la tabla legacy "tasks" (en desuso, sin tocar).
-- ==========================================================

create table public.project_tasks (
    id uuid primary key default gen_random_uuid(),
    section_id uuid not null references public.project_sections (id) on delete cascade,
    title text not null,
    description text,
    task_type public.task_type not null default 'nexa',
    status public.progress_status not null default 'pending',
    priority public.task_priority not null default 'medium',
    assignee_id uuid references public.profiles (id) on delete set null,
    due_date date,
    order_index integer not null default 0,
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.project_tasks is
    'Tarea individual dentro de una sección. task_type distingue Cliente / NEXA / Aprobación.';

create table public.approvals (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null unique references public.project_tasks (id) on delete cascade,
    decision public.approval_decision not null default 'pending',
    decided_by uuid references public.profiles (id) on delete set null,
    decided_at timestamptz,
    decision_comment text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.approvals is
    'Detalle de decisión para tareas con task_type = approval. Comentarios/adjuntos usan project_comments/project_files.';

create index project_tasks_section_id_idx on public.project_tasks (section_id);
create index project_tasks_assignee_id_idx on public.project_tasks (assignee_id);
create index project_tasks_status_idx on public.project_tasks (status);
create index project_tasks_task_type_idx on public.project_tasks (task_type);
create index approvals_task_id_idx on public.approvals (task_id);

alter table public.project_tasks enable row level security;
alter table public.approvals enable row level security;

-- Consistencia: solo tiene sentido crear una fila en "approvals" para
-- tareas cuyo task_type sea 'approval'. Se valida con un trigger porque
-- CHECK no puede consultar otra tabla directamente.
create function public.validate_approval_task_type()
returns trigger
language plpgsql
as $$
declare
    t_type public.task_type;
begin
    select task_type into t_type from public.project_tasks where id = new.task_id;

    if t_type is null then
        raise exception 'La tarea % no existe.', new.task_id;
    end if;

    if t_type <> 'approval' then
        raise exception 'Solo se puede crear una aprobación para tareas con task_type = approval (tarea %).', new.task_id;
    end if;

    return new;
end;
$$;

create trigger validate_approval_task_type
    before insert on public.approvals
    for each row execute function public.validate_approval_task_type();
