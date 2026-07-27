-- ==========================================================
-- NEXA HUB — 15. Motor de Proyectos: Archivos y Entregables
-- ==========================================================
-- Ver docs/proyectos-module-design.md secciones 2.8, 2.9 y 7.4.
-- También crea el bucket de Supabase Storage para los binarios
-- reales (las tablas solo guardan ruta/metadata).
-- ==========================================================

create table public.project_files (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    folder text not null default 'General',
    file_name text not null,
    storage_path text not null,
    mime_type text,
    size_bytes bigint,
    uploaded_by uuid not null references public.profiles (id),
    visible_to_client boolean not null default true,
    created_at timestamptz not null default now()
);

comment on table public.project_files is
    'Metadata de archivos del proyecto. El binario vive en el bucket de Storage "project-files" (storage_path).';

create table public.project_deliverables (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    phase_id uuid references public.project_phases (id) on delete set null,
    title text not null,
    description text,
    file_id uuid references public.project_files (id) on delete set null,
    status public.deliverable_status not null default 'draft',
    delivered_by uuid references public.profiles (id) on delete set null,
    delivered_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.project_deliverables is
    'Entregable formal del proyecto (puede enlazar un archivo real vía file_id).';

create index project_files_project_id_idx on public.project_files (project_id);
create index project_files_folder_idx on public.project_files (folder);
create index project_deliverables_project_id_idx on public.project_deliverables (project_id);
create index project_deliverables_phase_id_idx on public.project_deliverables (phase_id);

alter table public.project_files enable row level security;
alter table public.project_deliverables enable row level security;

-- ----------------------------------------------------------
-- Bucket de Supabase Storage para los archivos del proyecto.
-- Privado (no público): el acceso se controla por RLS sobre
-- storage.objects, igual que las tablas normales.
-- ----------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;
