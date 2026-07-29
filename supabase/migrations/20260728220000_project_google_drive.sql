-- ==========================================================
-- NEXA HUB — Integración Google Drive por proyecto
-- ==========================================================
-- Cada proyecto puede vincular UNA carpeta principal de Drive.
-- Los tokens OAuth viven en google_drive_connections (solo
-- accesibles vía Edge Function con service_role; el cliente
-- nunca lee refresh_token).
-- ==========================================================

alter table public.projects
    add column if not exists drive_folder_id text,
    add column if not exists drive_folder_name text,
    add column if not exists drive_folder_url text,
    add column if not exists drive_connected boolean not null default false,
    add column if not exists drive_connected_by uuid references public.profiles(id) on delete set null,
    add column if not exists drive_connected_at timestamptz,
    add column if not exists drive_files_count integer,
    add column if not exists drive_folders_count integer,
    add column if not exists drive_last_synced_at timestamptz;

comment on column public.projects.drive_folder_id is
    'ID de la carpeta raíz de Google Drive vinculada al proyecto.';
comment on column public.projects.drive_folder_name is
    'Nombre visible de la carpeta vinculada.';
comment on column public.projects.drive_folder_url is
    'URL web de la carpeta en Google Drive.';
comment on column public.projects.drive_connected is
    'true si el proyecto tiene carpeta de Drive vinculada.';
comment on column public.projects.drive_connected_by is
    'Admin que vinculó la carpeta (sus tokens se usan para leer).';

create table if not exists public.google_drive_connections (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    google_email text,
    google_account_id text,
    refresh_token text not null,
    access_token text,
    token_expires_at timestamptz,
    scopes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.google_drive_connections is
    'Tokens OAuth de Google Drive por administrador. Solo Edge Functions (service_role) deben leer/escribir tokens.';

alter table public.google_drive_connections enable row level security;

-- Ningún cliente/browser lee tokens directamente.
drop policy if exists google_drive_connections_admin_own_meta on public.google_drive_connections;
create policy google_drive_connections_admin_own_meta on public.google_drive_connections
    for select
    using (auth.uid() = user_id and public.is_admin());

-- Bloquear insert/update/delete desde el cliente (solo service_role bypassa RLS).
-- Sin policies de escritura = denegado para roles authenticated/anon.

create table if not exists public.google_drive_oauth_states (
    state text primary key,
    user_id uuid not null references public.profiles(id) on delete cascade,
    project_id uuid references public.projects(id) on delete set null,
    return_url text,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '15 minutes')
);

alter table public.google_drive_oauth_states enable row level security;
-- Sin policies: solo service_role.
