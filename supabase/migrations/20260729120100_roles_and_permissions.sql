-- ==========================================================
-- NEXA HUB — Roles y Permisos (Propietario + permisos/granular)
-- Requiere: 20260729120000_add_owner_role.sql
-- ==========================================================

alter table public.profiles
    add column if not exists project_access_mode text not null default 'all';

do $$
begin
    alter table public.profiles
        add constraint profiles_project_access_mode_check
        check (project_access_mode in ('all', 'selected'));
exception
    when duplicate_object then null;
end $$;

comment on column public.profiles.project_access_mode is
    'all = ve todos los proyectos (si tiene permiso); selected = solo admin_project_access.';

create table if not exists public.permissions (
    key text primary key,
    module text not null,
    label text not null,
    description text,
    sort_order integer not null default 0
);

create table if not exists public.user_permissions (
    user_id uuid not null references public.profiles(id) on delete cascade,
    permission_key text not null references public.permissions(key) on delete cascade,
    granted_at timestamptz not null default now(),
    granted_by uuid references public.profiles(id) on delete set null,
    primary key (user_id, permission_key)
);

create index if not exists user_permissions_user_idx on public.user_permissions (user_id);

create table if not exists public.admin_project_access (
    user_id uuid not null references public.profiles(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, project_id)
);

create index if not exists admin_project_access_user_idx on public.admin_project_access (user_id);
create index if not exists admin_project_access_project_idx on public.admin_project_access (project_id);

insert into public.permissions (key, module, label, description, sort_order) values
    ('projects.view_all', 'projects', 'Ver todos los proyectos', 'Acceso a la lista completa de proyectos', 10),
    ('projects.view_assigned', 'projects', 'Ver únicamente proyectos asignados', 'Solo proyectos seleccionados o asignados', 20),
    ('projects.create', 'projects', 'Crear proyectos', null, 30),
    ('projects.edit', 'projects', 'Editar proyectos', null, 40),
    ('projects.delete', 'projects', 'Eliminar proyectos', null, 50),
    ('clients.create', 'clients', 'Crear clientes', null, 10),
    ('clients.edit', 'clients', 'Editar clientes', null, 20),
    ('clients.delete', 'clients', 'Eliminar clientes', null, 30),
    ('tasks.create', 'tasks', 'Crear tareas', null, 10),
    ('tasks.edit', 'tasks', 'Editar tareas', null, 20),
    ('tasks.delete', 'tasks', 'Eliminar tareas', null, 30),
    ('calendar.view', 'calendar', 'Ver calendario', null, 10),
    ('calendar.create', 'calendar', 'Crear eventos', null, 20),
    ('calendar.edit', 'calendar', 'Editar eventos', null, 30),
    ('calendar.delete', 'calendar', 'Eliminar eventos', null, 40),
    ('documents.view', 'documents', 'Ver documentos', null, 10),
    ('documents.upload', 'documents', 'Subir archivos', null, 20),
    ('documents.delete', 'documents', 'Eliminar archivos', null, 30),
    ('documents.manage_drive', 'documents', 'Administrar Google Drive', null, 40),
    ('google.connect_drive', 'google', 'Conectar Google Drive', null, 10),
    ('google.connect_calendar', 'google', 'Conectar Google Calendar', null, 20),
    ('users.create', 'users', 'Crear administradores', null, 10),
    ('users.edit', 'users', 'Editar administradores', null, 20),
    ('users.delete', 'users', 'Eliminar administradores', null, 30),
    ('settings.access', 'settings', 'Acceder a configuración', null, 10),
    ('settings.integrations', 'settings', 'Administrar integraciones', null, 20),
    ('settings.system', 'settings', 'Administrar sistema', null, 30),
    ('reports.view', 'reports', 'Ver reportes', null, 10)
on conflict (key) do update set
    module = excluded.module,
    label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'owner' and is_active is distinct from false
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'owner')
          and is_active is distinct from false
    );
$$;

create or replace function public.has_permission(perm_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        public.is_owner()
        or exists (
            select 1
            from public.user_permissions up
            where up.user_id = auth.uid()
              and up.permission_key = perm_key
        );
$$;

create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        public.is_owner()
        or public.has_permission('projects.view_all')
        or (
            public.has_permission('projects.view_assigned')
            and exists (
                select 1 from public.profiles pr
                where pr.id = auth.uid()
                  and (
                    pr.project_access_mode = 'all'
                    or exists (
                        select 1 from public.admin_project_access apa
                        where apa.user_id = auth.uid()
                          and apa.project_id = p_project_id
                    )
                    or exists (
                        select 1 from public.projects p
                        where p.id = p_project_id
                          and p.responsible_id = auth.uid()
                    )
                )
            )
        );
$$;

create or replace function public.get_my_permissions()
returns table (permission_key text)
language sql
stable
security definer
set search_path = public
as $$
    select p.key
    from public.permissions p
    where public.is_owner()
       or exists (
            select 1 from public.user_permissions up
            where up.user_id = auth.uid() and up.permission_key = p.key
       );
$$;

grant execute on function public.is_owner() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.can_access_project(uuid) to authenticated;
grant execute on function public.get_my_permissions() to authenticated;

alter table public.permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.admin_project_access enable row level security;

drop policy if exists permissions_select_staff on public.permissions;
create policy permissions_select_staff on public.permissions
    for select using (public.is_admin());

drop policy if exists user_permissions_select_staff on public.user_permissions;
create policy user_permissions_select_staff on public.user_permissions
    for select using (
        public.is_admin()
        and (public.is_owner() or public.has_permission('users.edit') or user_id = auth.uid())
    );

drop policy if exists user_permissions_write_managers on public.user_permissions;
create policy user_permissions_write_managers on public.user_permissions
    for all using (
        public.is_owner() or public.has_permission('users.edit')
    )
    with check (
        public.is_owner() or public.has_permission('users.edit')
    );

drop policy if exists admin_project_access_select on public.admin_project_access;
create policy admin_project_access_select on public.admin_project_access
    for select using (
        public.is_admin()
        and (public.is_owner() or public.has_permission('users.edit') or user_id = auth.uid())
    );

drop policy if exists admin_project_access_write on public.admin_project_access;
create policy admin_project_access_write on public.admin_project_access
    for all using (
        public.is_owner() or public.has_permission('users.edit')
    )
    with check (
        public.is_owner() or public.has_permission('users.edit')
    );

create or replace function public.protect_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        if old.role = 'owner' then
            raise exception 'El propietario del sistema no puede eliminarse.';
        end if;
        return old;
    end if;

    if old.role = 'owner' then
        if new.role is distinct from 'owner' then
            raise exception 'El rol del propietario no puede cambiarse.';
        end if;
        if new.is_active = false then
            raise exception 'El propietario no puede desactivarse.';
        end if;
    end if;

    if new.role = 'owner' and (tg_op = 'INSERT' or old.role is distinct from 'owner') then
        if exists (select 1 from public.profiles where role = 'owner' and id is distinct from new.id) then
            raise exception 'Solo puede existir un propietario del sistema.';
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_protect_owner_profile on public.profiles;
create trigger trg_protect_owner_profile
    before update or delete on public.profiles
    for each row execute function public.protect_owner_profile();

drop policy if exists projects_admin_all on public.projects;
drop policy if exists projects_staff_select on public.projects;
drop policy if exists projects_staff_insert on public.projects;
drop policy if exists projects_staff_update on public.projects;
drop policy if exists projects_staff_delete on public.projects;

create policy projects_staff_select on public.projects
    for select
    using (public.is_admin() and public.can_access_project(id));

create policy projects_staff_insert on public.projects
    for insert
    with check (public.is_owner() or public.has_permission('projects.create'));

create policy projects_staff_update on public.projects
    for update
    using (
        public.is_admin()
        and public.can_access_project(id)
        and (public.is_owner() or public.has_permission('projects.edit') or public.has_permission('documents.manage_drive'))
    )
    with check (
        public.is_admin()
        and (public.is_owner() or public.has_permission('projects.edit') or public.has_permission('documents.manage_drive'))
    );

create policy projects_staff_delete on public.projects
    for delete
    using (
        public.is_admin()
        and public.can_access_project(id)
        and (public.is_owner() or public.has_permission('projects.delete'))
    );

update public.profiles
set role = 'owner',
    project_access_mode = 'all'
where role in ('admin', 'owner')
  and (
    full_name ilike 'Jaime David%'
    or full_name ilike '%Jaime David%'
    or full_name ilike 'Jaime%David%'
  );

insert into public.user_permissions (user_id, permission_key)
select p.id, perm.key
from public.profiles p
cross join public.permissions perm
where p.role in ('admin', 'owner')
on conflict do nothing;

update public.profiles
set project_access_mode = 'all'
where role in ('admin', 'owner');
