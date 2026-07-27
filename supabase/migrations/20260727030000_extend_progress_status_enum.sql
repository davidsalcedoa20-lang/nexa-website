-- ==========================================================
-- NEXA HUB — 23. Ampliar vocabulario de estados (plantilla oficial)
-- ==========================================================
-- La plantilla oficial del sistema de Proyectos (imagen de
-- referencia) requiere dos estados adicionales para tareas:
-- "Aprobado" (distinto de "Listo/Completado", implica revisión
-- de un tercero) y "Cancelado". Se agregan al enum ya existente
-- "progress_status" en vez de crear uno nuevo, para no duplicar
-- vocabulario entre fases/etapas/tareas.
--
-- IMPORTANTE: por restricción de Postgres, un valor de enum
-- recién agregado NO puede usarse en la misma transacción en la
-- que se agrega. Por eso este ALTER vive en su propio archivo,
-- separado de cualquier migración que ya use 'approved'/'cancelled'.
-- ==========================================================

alter type public.progress_status add value 'approved';
alter type public.progress_status add value 'cancelled';
