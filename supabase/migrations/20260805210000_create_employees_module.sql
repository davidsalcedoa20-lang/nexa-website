-- ==========================================================
-- NEXA HUB — Módulo Empleados (aislado; no toca clientes)
-- NOTA: el valor enum 'employee' debe aplicarse en transacción
-- propia ANTES de este archivo si la BD aún no lo tiene:
--   alter type public.user_role add value if not exists 'employee';
-- ==========================================================

-- 1) Nuevo rol Auth/perfil (idempotente; si falla por "unsafe use",
--    ejecutar el ALTER de arriba solo y luego reintentar este archivo)
do $$ begin
    alter type public.user_role add value if not exists 'employee';
exception
    when duplicate_object then null;
    when others then null;
end $$;

-- 2) Catálogo de cargos (escalable)
create table if not exists public.employee_roles (
    key text primary key,
    label text not null,
    is_active boolean not null default true,
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);

insert into public.employee_roles (key, label, sort_order) values
    ('editor', 'Editor', 1),
    ('designer', 'Diseñador', 2),
    ('photographer', 'Fotógrafo', 3),
    ('community', 'Community Manager', 4),
    ('admin_ops', 'Administrador', 5)
on conflict (key) do nothing;

-- 3) Empleados (1:1 con profiles.role = employee)
create table if not exists public.employees (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null unique references public.profiles(id) on delete cascade,
    first_name text not null,
    last_name text not null,
    role_key text not null references public.employee_roles(key),
    status text not null default 'active'
        check (status in ('active', 'inactive')),
    color_hex text not null default '#2D8CFF',
    photo_url text,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists employees_role_key_idx on public.employees (role_key);
create index if not exists employees_status_idx on public.employees (status);

-- 4) Proyectos de empleado (espacio de trabajo)
create table if not exists public.employee_projects (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.employees(id) on delete cascade,
    title text not null,
    drive_url text,
    instructions text not null default '',
    status text not null default 'active'
        check (status in ('active', 'archived', 'done')),
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists employee_projects_employee_idx on public.employee_projects (employee_id);

-- 5) Videos / tareas a editar
create table if not exists public.employee_tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.employee_projects(id) on delete cascade,
    number int not null default 1,
    name text not null,
    description text not null default '',
    priority text not null default 'media'
        check (priority in ('alta', 'media', 'baja')),
    duration_label text not null default '',
    status text not null default 'pendiente'
        check (status in ('pendiente', 'en_edicion', 'entregado')),
    sort_order int not null default 0,
    delivery_date date,
    delivered_at timestamptz,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists employee_tasks_project_idx on public.employee_tasks (project_id, sort_order);
create index if not exists employee_tasks_delivery_idx on public.employee_tasks (delivery_date);

-- 6) Comentarios por video
create table if not exists public.employee_comments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.employee_tasks(id) on delete cascade,
    author_id uuid not null references public.profiles(id) on delete cascade,
    body text not null,
    created_at timestamptz not null default now()
);

create index if not exists employee_comments_task_idx on public.employee_comments (task_id, created_at);

-- 7) Calendario (vista materializada por entrega; permite metadatos extra)
create table if not exists public.employee_calendar (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.employees(id) on delete cascade,
    task_id uuid not null unique references public.employee_tasks(id) on delete cascade,
    delivery_date date not null,
    note text,
    updated_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists employee_calendar_employee_date_idx
    on public.employee_calendar (employee_id, delivery_date);

-- Sync calendar row when task.delivery_date changes
create or replace function public.sync_employee_task_calendar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_employee_id uuid;
begin
    select ep.employee_id into v_employee_id
    from public.employee_projects ep
    where ep.id = new.project_id;

    if v_employee_id is null then
        return new;
    end if;

    if new.delivery_date is null then
        delete from public.employee_calendar where task_id = new.id;
    else
        insert into public.employee_calendar (employee_id, task_id, delivery_date, updated_by)
        values (v_employee_id, new.id, new.delivery_date, auth.uid())
        on conflict (task_id) do update
            set delivery_date = excluded.delivery_date,
                updated_by = excluded.updated_by,
                updated_at = now();
    end if;

    if new.status = 'entregado' and (old.status is distinct from 'entregado') then
        new.delivered_at := coalesce(new.delivered_at, now());
    end if;

    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_sync_employee_task_calendar on public.employee_tasks;
create trigger trg_sync_employee_task_calendar
    before update of delivery_date, status on public.employee_tasks
    for each row
    execute function public.sync_employee_task_calendar();

create or replace function public.touch_employee_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_employees_touch on public.employees;
create trigger trg_employees_touch
    before update on public.employees
    for each row execute function public.touch_employee_updated_at();

drop trigger if exists trg_employee_projects_touch on public.employee_projects;
create trigger trg_employee_projects_touch
    before update on public.employee_projects
    for each row execute function public.touch_employee_updated_at();

-- 8) Permisos del módulo
insert into public.permissions (key, module, label, description, sort_order) values
    ('employees.view', 'employees', 'Ver empleados', null, 10),
    ('employees.create', 'employees', 'Crear empleados', null, 20),
    ('employees.edit', 'employees', 'Editar empleados', null, 30),
    ('employees.delete', 'employees', 'Eliminar empleados', null, 40),
    ('employees.projects', 'employees', 'Gestionar proyectos de empleados', null, 50)
on conflict (key) do update set
    module = excluded.module,
    label = excluded.label,
    sort_order = excluded.sort_order;

-- 9) Helpers
create or replace function public.is_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'employee' and coalesce(p.is_active, true)
    );
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select e.id from public.employees e where e.profile_id = auth.uid() limit 1;
$$;

-- 10) RLS
alter table public.employee_roles enable row level security;
alter table public.employees enable row level security;
alter table public.employee_projects enable row level security;
alter table public.employee_tasks enable row level security;
alter table public.employee_comments enable row level security;
alter table public.employee_calendar enable row level security;

-- Roles catalog: readable by staff + employees
drop policy if exists employee_roles_read on public.employee_roles;
create policy employee_roles_read on public.employee_roles
    for select using (public.is_admin() or public.is_employee());

-- Employees
drop policy if exists employees_admin_all on public.employees;
create policy employees_admin_all on public.employees
    for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists employees_self_read on public.employees;
create policy employees_self_read on public.employees
    for select using (profile_id = auth.uid());

-- Projects
drop policy if exists employee_projects_admin_all on public.employee_projects;
create policy employee_projects_admin_all on public.employee_projects
    for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists employee_projects_self_read on public.employee_projects;
create policy employee_projects_self_read on public.employee_projects
    for select using (
        employee_id = public.current_employee_id()
    );

-- Tasks
drop policy if exists employee_tasks_admin_all on public.employee_tasks;
create policy employee_tasks_admin_all on public.employee_tasks
    for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists employee_tasks_self_read on public.employee_tasks;
create policy employee_tasks_self_read on public.employee_tasks
    for select using (
        exists (
            select 1 from public.employee_projects ep
            where ep.id = project_id and ep.employee_id = public.current_employee_id()
        )
    );

-- Editor may update status + delivery_date only (enforced also in app; DB allows update on own tasks)
drop policy if exists employee_tasks_self_update on public.employee_tasks;
create policy employee_tasks_self_update on public.employee_tasks
    for update using (
        exists (
            select 1 from public.employee_projects ep
            where ep.id = project_id and ep.employee_id = public.current_employee_id()
        )
    )
    with check (
        exists (
            select 1 from public.employee_projects ep
            where ep.id = project_id and ep.employee_id = public.current_employee_id()
        )
    );

-- Comments
drop policy if exists employee_comments_admin_all on public.employee_comments;
create policy employee_comments_admin_all on public.employee_comments
    for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists employee_comments_self_read on public.employee_comments;
create policy employee_comments_self_read on public.employee_comments
    for select using (
        exists (
            select 1
            from public.employee_tasks t
            join public.employee_projects ep on ep.id = t.project_id
            where t.id = task_id and ep.employee_id = public.current_employee_id()
        )
    );

drop policy if exists employee_comments_self_insert on public.employee_comments;
create policy employee_comments_self_insert on public.employee_comments
    for insert with check (
        author_id = auth.uid()
        and exists (
            select 1
            from public.employee_tasks t
            join public.employee_projects ep on ep.id = t.project_id
            where t.id = task_id and ep.employee_id = public.current_employee_id()
        )
    );

-- Calendar
drop policy if exists employee_calendar_admin_all on public.employee_calendar;
create policy employee_calendar_admin_all on public.employee_calendar
    for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists employee_calendar_self_read on public.employee_calendar;
create policy employee_calendar_self_read on public.employee_calendar
    for select using (employee_id = public.current_employee_id());

drop policy if exists employee_calendar_self_write on public.employee_calendar;
create policy employee_calendar_self_write on public.employee_calendar
    for all using (employee_id = public.current_employee_id())
    with check (employee_id = public.current_employee_id());

-- Restrict employee self-updates on tasks to status + delivery_date only
create or replace function public.restrict_employee_task_self_update()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() or auth.role() = 'service_role' then
        return new;
    end if;

    if public.is_employee() then
        if new.project_id is distinct from old.project_id
            or new.number is distinct from old.number
            or new.name is distinct from old.name
            or new.description is distinct from old.description
            or new.priority is distinct from old.priority
            or new.duration_label is distinct from old.duration_label
            or new.sort_order is distinct from old.sort_order
            or new.created_by is distinct from old.created_by
        then
            raise exception 'Los editores solo pueden cambiar estado y fecha de entrega.';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_restrict_employee_task_self_update on public.employee_tasks;
create trigger trg_restrict_employee_task_self_update
    before update on public.employee_tasks
    for each row
    execute function public.restrict_employee_task_self_update();

-- 11) Storage avatars empleados (reusa bucket avatars con prefijo employees/)
-- Políticas existentes de avatars cubren admins; empleados pueden leer público.

-- 12) Realtime
do $$ begin
    alter publication supabase_realtime add table public.employees;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
    alter publication supabase_realtime add table public.employee_projects;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
    alter publication supabase_realtime add table public.employee_tasks;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
    alter publication supabase_realtime add table public.employee_comments;
exception when duplicate_object then null; when undefined_object then null;
end $$;
do $$ begin
    alter publication supabase_realtime add table public.employee_calendar;
exception when duplicate_object then null; when undefined_object then null;
end $$;
