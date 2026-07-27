-- ==========================================================
-- NEXA HUB — 11. Motor de Proyectos: catálogo de tipos de servicio
-- ==========================================================
-- Tabla administrable (NO un enum) para que NEXA pueda agregar
-- servicios nuevos (Fotografía, Meta Ads, lo que sea) sin
-- necesitar una migración. Ver docs/proyectos-module-design.md
-- sección 2.1.
-- ==========================================================

create table public.project_types (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    color_hex text not null default '#2D8CFF',
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.project_types is
    'Catálogo administrable de tipos de servicio que vende NEXA. Se puede ampliar sin migraciones.';

alter table public.project_types enable row level security;

-- Datos iniciales sugeridos por el propio enunciado del módulo.
insert into public.project_types (name, slug, color_hex) values
    ('Marca Personal', 'marca-personal', '#8C52FF'),
    ('Página Web', 'pagina-web', '#2D8CFF'),
    ('Marketing Digital', 'marketing-digital', '#FF2D95'),
    ('Branding', 'branding', '#8C52FF'),
    ('Producción Audiovisual', 'produccion-audiovisual', '#FF2D95'),
    ('Render Arquitectónico', 'render-arquitectonico', '#2D8CFF'),
    ('Meta Ads', 'meta-ads', '#FF2D95'),
    ('Fotografía', 'fotografia', '#2D8CFF'),
    ('Servicio Personalizado', 'personalizado', '#A5A5A5');
