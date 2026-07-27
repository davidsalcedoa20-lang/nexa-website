-- ==========================================================
-- NEXA HUB — 02. Perfiles de usuario (profiles)
-- ==========================================================
-- Extiende auth.users con los datos propios de la aplicación:
-- rol (admin/cliente), nombre, estado de cuenta, etc.
-- Ver docs/database-design.md sección 4.1.
-- ==========================================================

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    role public.user_role not null default 'client',
    full_name text not null,
    email text not null,
    phone text,
    avatar_url text,
    is_active boolean not null default true,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.profiles is
    'Extiende auth.users con rol de aplicación (admin/client) y datos de perfil. Nunca se modifica auth.users directamente.';

create index profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;
