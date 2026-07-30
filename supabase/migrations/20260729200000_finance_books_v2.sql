-- ==========================================================
-- NEXA HUB — Contabilidad V2 (espacios múltiples, simple)
-- ==========================================================
-- Cada administrador tiene N "contabilidades" (finance_books).
-- Todo el dinero vive dentro de un book. RLS por admin_id.
-- Idempotente.
-- ==========================================================

-- ----------------------------------------------------------
-- Libros / Contabilidades
-- ----------------------------------------------------------
create table if not exists public.finance_books (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    name text not null,
    description text,
    currency text not null default 'COP',
    start_date date not null default (timezone('utc', now()))::date,
    color_hex text not null default '#8C52FF',
    dashboard_layout jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists finance_books_admin_idx
    on public.finance_books (admin_id, updated_at desc);

comment on table public.finance_books is
    'Contabilidad independiente por administrador (como un proyecto).';

drop trigger if exists set_updated_at on public.finance_books;
create trigger set_updated_at before update on public.finance_books
    for each row execute function public.set_updated_at();

alter table public.finance_books enable row level security;

drop policy if exists finance_books_select_own on public.finance_books;
drop policy if exists finance_books_insert_own on public.finance_books;
drop policy if exists finance_books_update_own on public.finance_books;
drop policy if exists finance_books_delete_own on public.finance_books;

create policy finance_books_select_own on public.finance_books
    for select using (public.is_admin() and admin_id = auth.uid());
create policy finance_books_insert_own on public.finance_books
    for insert with check (public.is_admin() and admin_id = auth.uid());
create policy finance_books_update_own on public.finance_books
    for update using (public.is_admin() and admin_id = auth.uid())
    with check (public.is_admin() and admin_id = auth.uid());
create policy finance_books_delete_own on public.finance_books
    for delete using (public.is_admin() and admin_id = auth.uid());

-- ----------------------------------------------------------
-- book_id en ingresos / egresos
-- ----------------------------------------------------------
alter table public.finance_incomes
    add column if not exists book_id uuid references public.finance_books (id) on delete cascade;

alter table public.finance_expenses
    add column if not exists book_id uuid references public.finance_books (id) on delete cascade;

create index if not exists finance_incomes_book_idx
    on public.finance_incomes (book_id, entry_date desc)
    where deleted_at is null;

create index if not exists finance_expenses_book_idx
    on public.finance_expenses (book_id, entry_date desc)
    where deleted_at is null;

-- Migrar datos huérfanos: crear libro "Mi Contabilidad" por admin
do $$
declare
    r record;
    v_book_id uuid;
begin
    for r in
        select distinct admin_id
        from public.finance_incomes
        where book_id is null
        union
        select distinct admin_id
        from public.finance_expenses
        where book_id is null
        union
        select admin_id from public.finance_settings
    loop
        select id into v_book_id
        from public.finance_books
        where admin_id = r.admin_id
        order by created_at
        limit 1;

        if v_book_id is null then
            insert into public.finance_books (admin_id, name, description, currency, color_hex)
            values (r.admin_id, 'Mi Contabilidad', 'Espacio principal', 'COP', '#8C52FF')
            returning id into v_book_id;
        end if;

        update public.finance_incomes
            set book_id = v_book_id
            where admin_id = r.admin_id and book_id is null;

        update public.finance_expenses
            set book_id = v_book_id
            where admin_id = r.admin_id and book_id is null;
    end loop;
end;
$$;

-- ----------------------------------------------------------
-- Pagos fijos mensuales
-- ----------------------------------------------------------
create table if not exists public.finance_fixed_payments (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    book_id uuid not null references public.finance_books (id) on delete cascade,
    name text not null,
    amount numeric(18, 2) not null default 0 check (amount >= 0),
    payment_day smallint not null default 1 check (payment_day between 1 and 31),
    is_active boolean not null default true,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists finance_fixed_payments_book_idx
    on public.finance_fixed_payments (book_id)
    where deleted_at is null;

drop trigger if exists set_updated_at on public.finance_fixed_payments;
create trigger set_updated_at before update on public.finance_fixed_payments
    for each row execute function public.set_updated_at();

alter table public.finance_fixed_payments enable row level security;

drop policy if exists finance_fixed_payments_select_own on public.finance_fixed_payments;
drop policy if exists finance_fixed_payments_insert_own on public.finance_fixed_payments;
drop policy if exists finance_fixed_payments_update_own on public.finance_fixed_payments;
drop policy if exists finance_fixed_payments_delete_own on public.finance_fixed_payments;

create policy finance_fixed_payments_select_own on public.finance_fixed_payments
    for select using (public.is_admin() and admin_id = auth.uid() and deleted_at is null);
create policy finance_fixed_payments_insert_own on public.finance_fixed_payments
    for insert with check (public.is_admin() and admin_id = auth.uid());
create policy finance_fixed_payments_update_own on public.finance_fixed_payments
    for update using (public.is_admin() and admin_id = auth.uid())
    with check (public.is_admin() and admin_id = auth.uid());
create policy finance_fixed_payments_delete_own on public.finance_fixed_payments
    for delete using (public.is_admin() and admin_id = auth.uid());

-- ----------------------------------------------------------
-- Empleados (reparto por %)
-- ----------------------------------------------------------
create table if not exists public.finance_employees (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    book_id uuid not null references public.finance_books (id) on delete cascade,
    full_name text not null,
    job_title text,
    percentage numeric(6, 2) not null default 0 check (percentage >= 0 and percentage <= 100),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists finance_employees_book_idx
    on public.finance_employees (book_id)
    where deleted_at is null;

drop trigger if exists set_updated_at on public.finance_employees;
create trigger set_updated_at before update on public.finance_employees
    for each row execute function public.set_updated_at();

alter table public.finance_employees enable row level security;

drop policy if exists finance_employees_select_own on public.finance_employees;
drop policy if exists finance_employees_insert_own on public.finance_employees;
drop policy if exists finance_employees_update_own on public.finance_employees;
drop policy if exists finance_employees_delete_own on public.finance_employees;

create policy finance_employees_select_own on public.finance_employees
    for select using (public.is_admin() and admin_id = auth.uid() and deleted_at is null);
create policy finance_employees_insert_own on public.finance_employees
    for insert with check (public.is_admin() and admin_id = auth.uid());
create policy finance_employees_update_own on public.finance_employees
    for update using (public.is_admin() and admin_id = auth.uid())
    with check (public.is_admin() and admin_id = auth.uid());
create policy finance_employees_delete_own on public.finance_employees
    for delete using (public.is_admin() and admin_id = auth.uid());

-- ----------------------------------------------------------
-- Préstamos
-- ----------------------------------------------------------
do $$ begin
    create type public.finance_loan_type as enum ('received', 'granted');
exception when duplicate_object then null;
end $$;

do $$ begin
    create type public.finance_loan_status as enum ('pending', 'paid', 'overdue');
exception when duplicate_object then null;
end $$;

create table if not exists public.finance_loans (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    book_id uuid not null references public.finance_books (id) on delete cascade,
    loan_type public.finance_loan_type not null default 'received',
    counterparty text not null,
    principal numeric(18, 2) not null default 0 check (principal >= 0),
    start_date date not null default (timezone('utc', now()))::date,
    installments integer not null default 1 check (installments >= 1),
    installment_amount numeric(18, 2) not null default 0 check (installment_amount >= 0),
    next_due_date date,
    paid_amount numeric(18, 2) not null default 0 check (paid_amount >= 0),
    status public.finance_loan_status not null default 'pending',
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists finance_loans_book_idx
    on public.finance_loans (book_id)
    where deleted_at is null;

drop trigger if exists set_updated_at on public.finance_loans;
create trigger set_updated_at before update on public.finance_loans
    for each row execute function public.set_updated_at();

alter table public.finance_loans enable row level security;

drop policy if exists finance_loans_select_own on public.finance_loans;
drop policy if exists finance_loans_insert_own on public.finance_loans;
drop policy if exists finance_loans_update_own on public.finance_loans;
drop policy if exists finance_loans_delete_own on public.finance_loans;

create policy finance_loans_select_own on public.finance_loans
    for select using (public.is_admin() and admin_id = auth.uid() and deleted_at is null);
create policy finance_loans_insert_own on public.finance_loans
    for insert with check (public.is_admin() and admin_id = auth.uid());
create policy finance_loans_update_own on public.finance_loans
    for update using (public.is_admin() and admin_id = auth.uid())
    with check (public.is_admin() and admin_id = auth.uid());
create policy finance_loans_delete_own on public.finance_loans
    for delete using (public.is_admin() and admin_id = auth.uid());

-- Categorías simples por libro (opcional: seguir usando finance_categories globales del admin)
-- Semilla de categorías simples si el admin aún no tiene
create or replace function public.seed_finance_simple_categories(p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_admin_id is null then return; end if;

    insert into public.finance_categories (admin_id, kind, name, color_hex, position)
    values
        (p_admin_id, 'income', 'Ventas', '#4ADE80', 0),
        (p_admin_id, 'income', 'Servicios', '#2D8CFF', 1),
        (p_admin_id, 'income', 'Otros ingresos', '#8C52FF', 2),
        (p_admin_id, 'expense', 'Operación', '#FF8A3D', 0),
        (p_admin_id, 'expense', 'Herramientas', '#5FA8FF', 1),
        (p_admin_id, 'expense', 'Personal', '#FF6B81', 2),
        (p_admin_id, 'expense', 'Otros egresos', '#8a8a8a', 3)
    on conflict (admin_id, name, kind) do nothing;
end;
$$;

grant execute on function public.seed_finance_simple_categories(uuid) to authenticated;
