-- ==========================================================
-- NEXA HUB — 12. Motor de Proyectos: extender "projects"
-- ==========================================================
-- Se EXTIENDE la tabla projects ya existente (no se reemplaza).
-- Hoy no tiene filas reales, así que esto es 100% seguro.
-- Ver docs/proyectos-module-design.md sección 2.2.
-- ==========================================================

alter table public.projects
    add column project_type_id uuid references public.project_types (id) on delete set null,
    add column color_hex text,
    add column responsible_id uuid references public.profiles (id) on delete set null,
    add column archived_at timestamptz;

comment on column public.projects.project_type_id is
    'Tipo de servicio (ver project_types). Nullable para proyectos sin clasificar.';

comment on column public.projects.color_hex is
    'Color identificador propio del proyecto. Si es null, el frontend usa el color de project_types.';

comment on column public.projects.responsible_id is
    'Miembro del equipo NEXA responsable del proyecto (perfil con role = admin).';

comment on column public.projects.archived_at is
    'Marca de archivado. Independiente de "status": un proyecto completado o cancelado también puede archivarse.';

create index projects_project_type_id_idx on public.projects (project_type_id);
create index projects_responsible_id_idx on public.projects (responsible_id);
create index projects_archived_at_idx on public.projects (archived_at);
