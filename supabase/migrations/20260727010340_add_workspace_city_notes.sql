-- ==========================================================
-- NEXA HUB — 09. Módulo Clientes: columnas adicionales
-- ==========================================================
-- El modal "Nuevo Cliente" del Panel Administrativo captura
-- Ciudad y Observaciones, que no existían en el diseño original
-- de "workspaces". Se agregan aquí como columnas opcionales.
-- No afecta ninguna política de RLS existente (son a nivel de
-- fila, no de columna).
-- ==========================================================

alter table public.workspaces
    add column city text,
    add column notes text;

comment on column public.workspaces.city is
    'Ciudad del cliente (opcional). Usada en el módulo Clientes del Panel Administrativo.';

comment on column public.workspaces.notes is
    'Observaciones internas sobre el cliente (opcional). Usada en el módulo Clientes del Panel Administrativo.';
