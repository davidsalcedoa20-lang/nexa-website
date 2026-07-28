-- ==========================================================
-- NEXA HUB — 25. Módulo Calendario
-- ==========================================================
-- Tabla calendar_events: eventos asociados a un workspace
-- (cliente) y a un proyecto. El campo google_event_id queda
-- preparado para una futura sincronización con Google Calendar
-- (NO se implementa en esta migración).
--
-- RLS:
--   - admin: CRUD completo
--   - client: solo lectura de eventos de su propio workspace
-- ==========================================================

create type public.calendar_event_type as enum (
    'meeting',
    'call',
    'deadline',
    'milestone',
    'delivery',
    'other'
);

create type public.calendar_event_status as enum (
    'scheduled',
    'completed',
    'cancelled'
);

create table public.calendar_events (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    project_id uuid not null references public.projects (id) on delete cascade,
    title text not null,
    description text,
    type public.calendar_event_type not null default 'meeting',
    start_date timestamptz not null,
    end_date timestamptz,
    all_day boolean not null default false,
    location text,
    meeting_url text,
    -- Reservado para sincronización futura con Google Calendar.
    -- NULL mientras no haya integración activa.
    google_event_id text,
    status public.calendar_event_status not null default 'scheduled',
    created_by uuid not null references public.profiles (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint calendar_events_end_after_start check (
        end_date is null or end_date >= start_date
    )
);

comment on table public.calendar_events is
    'Eventos del calendario de NEXA Hub. Siempre ligados a un workspace (cliente) y a un proyecto. google_event_id preparado para sync futura con Google Calendar.';

comment on column public.calendar_events.google_event_id is
    'ID del evento en Google Calendar cuando exista sincronización. Hoy siempre NULL.';

create index calendar_events_workspace_id_idx on public.calendar_events (workspace_id);
create index calendar_events_project_id_idx on public.calendar_events (project_id);
create index calendar_events_start_date_idx on public.calendar_events (start_date);
create index calendar_events_status_idx on public.calendar_events (status);

-- Consistencia: el proyecto debe pertenecer al workspace indicado.
create function public.validate_calendar_event_project_workspace()
returns trigger
language plpgsql
as $$
declare
    v_workspace_id uuid;
begin
    select workspace_id into v_workspace_id
        from public.projects
        where id = new.project_id;

    if v_workspace_id is null then
        raise exception 'El proyecto % no existe.', new.project_id;
    end if;

    if v_workspace_id <> new.workspace_id then
        raise exception 'El proyecto no pertenece al workspace indicado.';
    end if;

    return new;
end;
$$;

create trigger validate_calendar_event_project_workspace
    before insert or update of project_id, workspace_id on public.calendar_events
    for each row execute function public.validate_calendar_event_project_workspace();

create trigger set_updated_at before update on public.calendar_events
    for each row execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

create policy calendar_events_admin_all on public.calendar_events
    for all
    using (public.is_admin())
    with check (public.is_admin());

create policy calendar_events_select_own on public.calendar_events
    for select
    using (
        exists (
            select 1
            from public.workspaces w
            where w.id = calendar_events.workspace_id
              and w.client_id = auth.uid()
        )
    );

-- Realtime (idempotente) para widgets "Próximo Evento" y refrescos del calendario.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'calendar_events'
    ) then
        alter publication supabase_realtime add table public.calendar_events;
    end if;
end $$;
