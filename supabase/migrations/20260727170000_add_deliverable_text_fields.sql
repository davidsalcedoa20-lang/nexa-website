-- ==========================================================
-- NEXA HUB — 23. Entregables: campos de texto/enlace externo
-- ==========================================================
-- Decisión de arquitectura: NEXA Hub NO almacena archivos ni
-- documentos en Supabase Storage. Los entregables se manejan
-- únicamente con información estructurada (texto, fechas y un
-- enlace externo opcional a Drive/Figma/Canva/Dropbox/etc.).
--
-- "project_files" y el bucket de Storage "project-files" (ver
-- 20260727020500_create_project_files_and_deliverables.sql) NO
-- se eliminan en esta migración: siguen existiendo en la base de
-- datos por si se necesitan en el futuro, pero la interfaz deja
-- de usarlos (no hay botones de "Subir archivo" en ninguna
-- pantalla a partir de esta etapa). "file_id" en
-- project_deliverables tampoco se elimina, solo deja de usarse.
--
-- Se agregan las columnas que sí pide el nuevo flujo de
-- entregables: fecha límite, observaciones y enlace externo.
-- "Fecha de entrega" ya existía como "delivered_at".
-- ==========================================================

alter table public.project_deliverables
    add column due_date date,
    add column notes text,
    add column external_link text;

comment on column public.project_deliverables.due_date is
    'Fecha límite del entregable (editable por el admin).';
comment on column public.project_deliverables.notes is
    'Observaciones libres sobre el entregable (admin).';
comment on column public.project_deliverables.external_link is
    'Enlace externo opcional (Google Drive, Figma, Canva, Dropbox, etc.) en vez de un archivo almacenado en NEXA Hub.';
