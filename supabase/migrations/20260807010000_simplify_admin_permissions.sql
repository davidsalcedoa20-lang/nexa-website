-- ==========================================================
-- NEXA HUB — Simplificación de permisos de administradores
-- ==========================================================
-- Modelo nuevo (4 bloques):
--   1) Proyectos: view_all | view_assigned | view_own (+ siempre created_by)
--   2) Contabilidad: propia + compartir (finance_book_shares) + owner ve todo
--   3) Administradores: solo owner (sin keys users.*)
--   4) Empleados: employees.manage
-- ==========================================================

-- 1) Nuevas keys
insert into public.permissions (key, module, label, description, sort_order) values
    ('projects.view_own', 'projects', 'Ver proyectos propios', 'Solo proyectos creados por el administrador', 15),
    ('employees.manage', 'employees', 'Administrar empleados', 'Crear, editar, asignar y eliminar empleados', 10)
on conflict (key) do update set
    module = excluded.module,
    label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order;

-- 2) Ampliar project_access_mode: all | selected | own
alter table public.profiles drop constraint if exists profiles_project_access_mode_check;
alter table public.profiles
    add constraint profiles_project_access_mode_check
    check (project_access_mode in ('all', 'selected', 'own'));

-- 3) Migrar permisos existentes → modelo simple
do $$
declare
    r record;
    v_mode text;
    v_keys text[];
    has_all boolean;
    has_assigned boolean;
    has_employees boolean;
begin
    for r in
        select id, project_access_mode
        from public.profiles
        where role = 'admin'
    loop
        select
            exists (
                select 1 from public.user_permissions
                where user_id = r.id and permission_key = 'projects.view_all'
            ),
            exists (
                select 1 from public.user_permissions
                where user_id = r.id and permission_key = 'projects.view_assigned'
            ),
            exists (
                select 1 from public.user_permissions
                where user_id = r.id and permission_key like 'employees.%'
            )
        into has_all, has_assigned, has_employees;

        if has_all or coalesce(r.project_access_mode, 'all') = 'all' then
            v_mode := 'all';
            v_keys := array['projects.view_all'];
        elsif has_assigned or coalesce(r.project_access_mode, '') = 'selected' then
            v_mode := 'selected';
            v_keys := array['projects.view_assigned'];
        else
            v_mode := 'own';
            v_keys := array['projects.view_own'];
        end if;

        if has_employees then
            v_keys := v_keys || array['employees.manage'];
        end if;

        update public.profiles
        set project_access_mode = v_mode
        where id = r.id;

        delete from public.user_permissions where user_id = r.id;

        insert into public.user_permissions (user_id, permission_key)
        select r.id, unnest(v_keys)
        on conflict do nothing;
    end loop;

    -- Owner no necesita filas; limpiar por si acaso
    delete from public.user_permissions up
    using public.profiles p
    where up.user_id = p.id and p.role = 'owner';
end $$;

-- 4) Eliminar keys obsoletas del catálogo
delete from public.user_permissions
where permission_key not in ('projects.view_all', 'projects.view_assigned', 'projects.view_own', 'employees.manage');

delete from public.permissions
where key not in ('projects.view_all', 'projects.view_assigned', 'projects.view_own', 'employees.manage');

-- 5) can_access_project: all | assigned (+ APA/responsible) | own | SIEMPRE created_by
create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        public.is_owner()
        or exists (
            select 1 from public.projects p
            where p.id = p_project_id
              and p.created_by = auth.uid()
        )
        or public.has_permission('projects.view_all')
        or (
            public.has_permission('projects.view_assigned')
            and (
                exists (
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
        or (
            public.has_permission('projects.view_own')
            and exists (
                select 1 from public.projects p
                where p.id = p_project_id
                  and p.created_by = auth.uid()
            )
        );
$$;

-- 6) RLS proyectos: cualquier admin puede crear; editar/borrar si tiene acceso
drop policy if exists projects_staff_insert on public.projects;
create policy projects_staff_insert on public.projects
    for insert with check (public.is_admin());

drop policy if exists projects_staff_update on public.projects;
create policy projects_staff_update on public.projects
    for update
    using (public.is_admin() and public.can_access_project(id))
    with check (public.is_admin() and public.can_access_project(id));

drop policy if exists projects_staff_delete on public.projects;
create policy projects_staff_delete on public.projects
    for delete
    using (public.is_admin() and public.can_access_project(id));

-- 7) Solo el owner gestiona user_permissions / admin_project_access
drop policy if exists user_permissions_write_managers on public.user_permissions;
create policy user_permissions_write_managers on public.user_permissions
    for all using (public.is_owner())
    with check (public.is_owner());

drop policy if exists user_permissions_select_staff on public.user_permissions;
create policy user_permissions_select_staff on public.user_permissions
    for select using (
        public.is_admin()
        and (public.is_owner() or user_id = auth.uid())
    );

drop policy if exists admin_project_access_write on public.admin_project_access;
create policy admin_project_access_write on public.admin_project_access
    for all using (public.is_owner())
    with check (public.is_owner());

drop policy if exists admin_project_access_select on public.admin_project_access;
create policy admin_project_access_select on public.admin_project_access
    for select using (
        public.is_admin()
        and (public.is_owner() or user_id = auth.uid())
    );

-- 8) Contabilidad compartida
create table if not exists public.finance_book_shares (
    book_id uuid not null references public.finance_books (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    created_by uuid references public.profiles (id) on delete set null,
    primary key (book_id, user_id)
);

create index if not exists finance_book_shares_user_idx
    on public.finance_book_shares (user_id);

comment on table public.finance_book_shares is
    'Compartir contabilidades entre administradores. El owner (role) ve todas.';

alter table public.finance_book_shares enable row level security;

create or replace function public.can_access_finance_book(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        public.is_owner()
        or exists (
            select 1 from public.finance_books b
            where b.id = p_book_id and b.admin_id = auth.uid()
        )
        or exists (
            select 1 from public.finance_book_shares s
            where s.book_id = p_book_id and s.user_id = auth.uid()
        );
$$;

create or replace function public.owns_finance_book(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        public.is_owner()
        or exists (
            select 1 from public.finance_books b
            where b.id = p_book_id and b.admin_id = auth.uid()
        );
$$;

grant execute on function public.can_access_finance_book(uuid) to authenticated;
grant execute on function public.owns_finance_book(uuid) to authenticated;

drop policy if exists finance_book_shares_select on public.finance_book_shares;
create policy finance_book_shares_select on public.finance_book_shares
    for select using (
        public.is_admin()
        and (
            public.is_owner()
            or user_id = auth.uid()
            or public.owns_finance_book(book_id)
        )
    );

drop policy if exists finance_book_shares_write on public.finance_book_shares;
create policy finance_book_shares_write on public.finance_book_shares
    for all using (public.is_admin() and public.owns_finance_book(book_id))
    with check (public.is_admin() and public.owns_finance_book(book_id));

-- finance_books: ver propias + compartidas + owner
drop policy if exists finance_books_select_own on public.finance_books;
create policy finance_books_select_own on public.finance_books
    for select using (public.is_admin() and public.can_access_finance_book(id));

drop policy if exists finance_books_insert_own on public.finance_books;
create policy finance_books_insert_own on public.finance_books
    for insert with check (public.is_admin() and admin_id = auth.uid());

drop policy if exists finance_books_update_own on public.finance_books;
create policy finance_books_update_own on public.finance_books
    for update
    using (public.is_admin() and public.owns_finance_book(id))
    with check (public.is_admin() and public.owns_finance_book(id));

drop policy if exists finance_books_delete_own on public.finance_books;
create policy finance_books_delete_own on public.finance_books
    for delete using (public.is_admin() and public.owns_finance_book(id));

-- Child tables with book_id
drop policy if exists finance_incomes_select_own on public.finance_incomes;
create policy finance_incomes_select_own on public.finance_incomes
    for select using (public.is_admin() and public.can_access_finance_book(book_id) and deleted_at is null);
drop policy if exists finance_incomes_insert_own on public.finance_incomes;
create policy finance_incomes_insert_own on public.finance_incomes
    for insert with check (public.is_admin() and public.can_access_finance_book(book_id));
drop policy if exists finance_incomes_update_own on public.finance_incomes;
create policy finance_incomes_update_own on public.finance_incomes
    for update using (public.is_admin() and public.can_access_finance_book(book_id))
    with check (public.is_admin() and public.can_access_finance_book(book_id));
drop policy if exists finance_incomes_delete_own on public.finance_incomes;
create policy finance_incomes_delete_own on public.finance_incomes
    for delete using (public.is_admin() and public.can_access_finance_book(book_id));

drop policy if exists finance_expenses_select_own on public.finance_expenses;
create policy finance_expenses_select_own on public.finance_expenses
    for select using (public.is_admin() and public.can_access_finance_book(book_id) and deleted_at is null);
drop policy if exists finance_expenses_insert_own on public.finance_expenses;
create policy finance_expenses_insert_own on public.finance_expenses
    for insert with check (public.is_admin() and public.can_access_finance_book(book_id));
drop policy if exists finance_expenses_update_own on public.finance_expenses;
create policy finance_expenses_update_own on public.finance_expenses
    for update using (public.is_admin() and public.can_access_finance_book(book_id))
    with check (public.is_admin() and public.can_access_finance_book(book_id));
drop policy if exists finance_expenses_delete_own on public.finance_expenses;
create policy finance_expenses_delete_own on public.finance_expenses
    for delete using (public.is_admin() and public.can_access_finance_book(book_id));

drop policy if exists finance_fixed_payments_select_own on public.finance_fixed_payments;
create policy finance_fixed_payments_select_own on public.finance_fixed_payments
    for select using (public.is_admin() and public.can_access_finance_book(book_id) and deleted_at is null);
drop policy if exists finance_fixed_payments_insert_own on public.finance_fixed_payments;
create policy finance_fixed_payments_insert_own on public.finance_fixed_payments
    for insert with check (public.is_admin() and public.can_access_finance_book(book_id));
drop policy if exists finance_fixed_payments_update_own on public.finance_fixed_payments;
create policy finance_fixed_payments_update_own on public.finance_fixed_payments
    for update using (public.is_admin() and public.can_access_finance_book(book_id))
    with check (public.is_admin() and public.can_access_finance_book(book_id));
drop policy if exists finance_fixed_payments_delete_own on public.finance_fixed_payments;
create policy finance_fixed_payments_delete_own on public.finance_fixed_payments
    for delete using (public.is_admin() and public.can_access_finance_book(book_id));

drop policy if exists finance_employees_select_own on public.finance_employees;
create policy finance_employees_select_own on public.finance_employees
    for select using (public.is_admin() and public.can_access_finance_book(book_id) and deleted_at is null);
drop policy if exists finance_employees_insert_own on public.finance_employees;
create policy finance_employees_insert_own on public.finance_employees
    for insert with check (public.is_admin() and public.can_access_finance_book(book_id));
drop policy if exists finance_employees_update_own on public.finance_employees;
create policy finance_employees_update_own on public.finance_employees
    for update using (public.is_admin() and public.can_access_finance_book(book_id))
    with check (public.is_admin() and public.can_access_finance_book(book_id));
drop policy if exists finance_employees_delete_own on public.finance_employees;
create policy finance_employees_delete_own on public.finance_employees
    for delete using (public.is_admin() and public.can_access_finance_book(book_id));

drop policy if exists finance_loans_select_own on public.finance_loans;
create policy finance_loans_select_own on public.finance_loans
    for select using (public.is_admin() and public.can_access_finance_book(book_id) and deleted_at is null);
drop policy if exists finance_loans_insert_own on public.finance_loans;
create policy finance_loans_insert_own on public.finance_loans
    for insert with check (public.is_admin() and public.can_access_finance_book(book_id));
drop policy if exists finance_loans_update_own on public.finance_loans;
create policy finance_loans_update_own on public.finance_loans
    for update using (public.is_admin() and public.can_access_finance_book(book_id))
    with check (public.is_admin() and public.can_access_finance_book(book_id));
drop policy if exists finance_loans_delete_own on public.finance_loans;
create policy finance_loans_delete_own on public.finance_loans
    for delete using (public.is_admin() and public.can_access_finance_book(book_id));

-- Attachments: owner / dueño / compartido vía admin del libro
drop policy if exists finance_attachments_select_own on public.finance_attachments;
create policy finance_attachments_select_own on public.finance_attachments
    for select using (
        public.is_admin()
        and deleted_at is null
        and (
            public.is_owner()
            or admin_id = auth.uid()
            or exists (
                select 1
                from public.finance_books b
                join public.finance_book_shares s on s.book_id = b.id
                where b.admin_id = finance_attachments.admin_id
                  and s.user_id = auth.uid()
            )
        )
    );

drop policy if exists finance_attachments_insert_own on public.finance_attachments;
create policy finance_attachments_insert_own on public.finance_attachments
    for insert with check (
        public.is_admin()
        and (public.is_owner() or admin_id = auth.uid())
    );

drop policy if exists finance_attachments_update_own on public.finance_attachments;
create policy finance_attachments_update_own on public.finance_attachments
    for update
    using (
        public.is_admin()
        and (
            public.is_owner()
            or admin_id = auth.uid()
            or exists (
                select 1
                from public.finance_books b
                join public.finance_book_shares s on s.book_id = b.id
                where b.admin_id = finance_attachments.admin_id
                  and s.user_id = auth.uid()
            )
        )
    )
    with check (
        public.is_admin()
        and (
            public.is_owner()
            or admin_id = auth.uid()
            or exists (
                select 1
                from public.finance_books b
                join public.finance_book_shares s on s.book_id = b.id
                where b.admin_id = finance_attachments.admin_id
                  and s.user_id = auth.uid()
            )
        )
    );

drop policy if exists finance_attachments_delete_own on public.finance_attachments;
create policy finance_attachments_delete_own on public.finance_attachments
    for delete using (
        public.is_admin()
        and (public.is_owner() or admin_id = auth.uid())
    );
