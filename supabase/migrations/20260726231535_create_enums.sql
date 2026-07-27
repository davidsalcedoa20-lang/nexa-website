-- ==========================================================
-- NEXA HUB — 01. Tipos enumerados (ENUM)
-- ==========================================================
-- Define los estados y roles utilizados en todo el esquema.
-- Ver docs/database-design.md sección 5.
-- ==========================================================

create type public.user_role as enum ('admin', 'client');

create type public.workspace_status as enum ('active', 'inactive');

create type public.project_status as enum (
    'not_started',
    'in_progress',
    'paused',
    'completed',
    'cancelled'
);

create type public.stage_status as enum ('not_started', 'in_progress', 'completed');

create type public.block_status as enum ('not_started', 'in_progress', 'completed');

create type public.task_status as enum ('pending', 'in_progress', 'completed', 'blocked');

create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
