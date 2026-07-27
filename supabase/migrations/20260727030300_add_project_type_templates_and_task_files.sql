-- ==========================================================
-- NEXA HUB — 26. Plantillas por tipo de proyecto + archivos por tarea
-- ==========================================================

-- Cada tipo de servicio puede definir sus propias etapas por
-- defecto, para que "Nuevo Proyecto" nunca cree un proyecto vacío.
-- Es un array de objetos {"name": "...", "color_hex": "..."}.
alter table public.project_types
    add column default_stages jsonb not null default '[]'::jsonb;

comment on column public.project_types.default_stages is
    'Plantilla de etapas iniciales para este tipo de proyecto. Formato: [{"name":"Ecosistema","color_hex":"#2D8CFF"}, ...]. Usada por create_project_with_template().';

update public.project_types set default_stages =
    '[
        {"name":"Ecosistema","color_hex":"#2D8CFF"},
        {"name":"Contenido","color_hex":"#00C2A8"},
        {"name":"Producción","color_hex":"#8C52FF"},
        {"name":"Publicación","color_hex":"#FF8A3D"},
        {"name":"Validación","color_hex":"#FF2D95"}
    ]'::jsonb
where slug in ('marca-personal', 'branding', 'produccion-audiovisual', 'fotografia', 'personalizado');

update public.project_types set default_stages =
    '[
        {"name":"Diseño","color_hex":"#2D8CFF"},
        {"name":"Desarrollo","color_hex":"#00C2A8"},
        {"name":"Programación","color_hex":"#8C52FF"},
        {"name":"Testing","color_hex":"#FF8A3D"},
        {"name":"Entrega","color_hex":"#FF2D95"}
    ]'::jsonb
where slug in ('pagina-web', 'render-arquitectonico');

update public.project_types set default_stages =
    '[
        {"name":"Estrategia","color_hex":"#2D8CFF"},
        {"name":"Creación","color_hex":"#00C2A8"},
        {"name":"Configuración","color_hex":"#8C52FF"},
        {"name":"Lanzamiento","color_hex":"#FF8A3D"},
        {"name":"Optimización","color_hex":"#FF2D95"}
    ]'::jsonb
where slug in ('marketing-digital', 'meta-ads');

-- Los archivos ahora pueden pertenecer a una tarea puntual (no
-- solo al proyecto en general), tal como pide la plantilla
-- ("cada tarea debe permitir archivos").
alter table public.project_files
    add column task_id uuid references public.project_tasks (id) on delete cascade;

create index project_files_task_id_idx on public.project_files (task_id);

comment on column public.project_files.task_id is
    'Tarea a la que pertenece este archivo (opcional). Si es null, es un archivo general del proyecto.';
