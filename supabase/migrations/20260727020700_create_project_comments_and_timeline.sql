-- ==========================================================
-- NEXA HUB — 17. Motor de Proyectos: Comentarios y Cronología
-- ==========================================================
-- Ver docs/proyectos-module-design.md secciones 2.10 y 2.11.
-- ==========================================================

create table public.project_comments (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    commentable_type text not null,
    commentable_id uuid not null,
    author_id uuid not null references public.profiles (id),
    body text not null,
    attachment_file_id uuid references public.project_files (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint project_comments_commentable_type_check
        check (commentable_type in ('project', 'phase', 'task', 'deliverable'))
);

comment on table public.project_comments is
    'Comentario polimórfico: puede pertenecer a un proyecto, bloque, tarea o entregable (commentable_type/commentable_id).';

create table public.project_timeline_events (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    event_type text not null,
    description text not null,
    actor_id uuid references public.profiles (id) on delete set null,
    metadata jsonb,
    created_at timestamptz not null default now()
);

comment on table public.project_timeline_events is
    'Línea de tiempo autogenerada del proyecto. Solo se inserta desde triggers/funciones del sistema, nunca directo desde el frontend.';

create index project_comments_project_id_idx on public.project_comments (project_id);
create index project_comments_commentable_idx on public.project_comments (commentable_type, commentable_id);
create index project_timeline_events_project_id_idx on public.project_timeline_events (project_id);
create index project_timeline_events_created_at_idx on public.project_timeline_events (created_at);

alter table public.project_comments enable row level security;
alter table public.project_timeline_events enable row level security;
