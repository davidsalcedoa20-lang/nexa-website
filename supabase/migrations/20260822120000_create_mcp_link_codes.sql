-- ==========================================================
-- NEXA HUB — Códigos de vinculación del MCP (NEXA MCP)
-- ==========================================================
-- Puente de un solo uso entre "el admin genera un código en la
-- web" y "el MCP lo canjea desde Claude". A propósito NUNCA
-- guarda tokens de sesión: la sesión independiente del MCP se
-- genera recién en el momento del canje (Edge Function
-- "mcp-link", acción "redeem") y se devuelve una única vez en
-- la respuesta HTTP — jamás se persiste en esta tabla ni en
-- ninguna otra. Mismo patrón que "google_drive_oauth_states"
-- (ver 20260728220000_project_google_drive.sql): sin policies
-- de cliente, solo accesible con service_role.
-- ==========================================================

create table if not exists public.mcp_link_codes (
    code text primary key,
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '10 minutes')
);

comment on table public.mcp_link_codes is
    'Códigos de un solo uso para vincular NEXA MCP a la sesión de un administrador. No contiene tokens: la Edge Function mcp-link genera la sesión del MCP en el momento del canje y la devuelve directo en la respuesta, sin persistirla.';

create index if not exists mcp_link_codes_expires_at_idx
    on public.mcp_link_codes (expires_at);

alter table public.mcp_link_codes enable row level security;
-- Sin policies: ni admin ni cliente pueden leer/escribir esta tabla
-- desde el navegador. Solo la Edge Function "mcp-link" (service_role)
-- la usa.
