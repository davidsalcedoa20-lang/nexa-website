-- ==========================================================
-- NEXA HUB — 25. Enlazar bloques a etapas + campos extra plantilla
-- ==========================================================

-- Cada bloque ahora pertenece (opcionalmente, por compatibilidad
-- con datos previos) a una etapa de la línea de tiempo.
alter table public.project_phases
    add column timeline_stage_id uuid references public.project_timeline_stages (id) on delete set null;

create index project_phases_timeline_stage_id_idx on public.project_phases (timeline_stage_id);

comment on column public.project_phases.timeline_stage_id is
    'Etapa de la línea de tiempo a la que pertenece este bloque. Nullable por compatibilidad; en la práctica siempre debería tener valor.';

-- Campos nuevos de la plantilla oficial en "projects".
alter table public.projects
    add column modality text,
    add column secondary_color_hex text;

comment on column public.projects.modality is
    'Modalidad del proyecto en texto libre (ej. "Remota", "Presencial", "Híbrida").';

comment on column public.projects.secondary_color_hex is
    'Segundo color identificador, usado cuando el nombre del proyecto combina dos marcas (ej. "Marca A + Marca B") para pintar cada parte del título con un color distinto.';

-- Las "secciones" (COMPACTO URBANO / MARCO ARQUITECTONICO en la
-- plantilla) ahora pueden tener su propio color y un "handle"
-- corto para mostrarse como "NOMBRE —@handle".
alter table public.project_sections
    add column color_hex text,
    add column handle text;

comment on column public.project_sections.color_hex is
    'Color identificador de la sección (punto de color junto al nombre). Si es null, el frontend usa un color por defecto.';

comment on column public.project_sections.handle is
    'Identificador corto opcional mostrado como "—@handle" junto al nombre de la sección.';
