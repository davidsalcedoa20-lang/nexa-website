-- ==========================================================
-- NEXA HUB — ERP Financiero (Fase 1 · Arquitectura)
-- ==========================================================
-- Contabilidad PRIVADA por administrador (admin_id = auth.uid()).
-- Idempotente: segura ante re-ejecución en Supabase/PostgreSQL.
-- ==========================================================

-- ----------------------------------------------------------
-- ENUMs (no fallar si ya existen)
-- ----------------------------------------------------------
do $$ begin
    create type public.finance_entry_status as enum (
        'draft', 'pending', 'confirmed', 'paid', 'cancelled'
    );
exception when duplicate_object then null;
end $$;

do $$ begin
    create type public.finance_category_kind as enum (
        'income', 'expense', 'both'
    );
exception when duplicate_object then null;
end $$;

do $$ begin
    create type public.finance_account_type as enum (
        'cash', 'bank', 'card', 'wallet', 'other'
    );
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------
create table if not exists public.finance_settings (
    admin_id uuid primary key references public.profiles (id) on delete cascade,
    currency text not null default 'COP',
    locale text not null default 'es-CO',
    number_format text not null default 'es-CO',
    fiscal_year_start_month smallint not null default 1
        check (fiscal_year_start_month between 1 and 12),
    dashboard_layout jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.finance_settings is
    'Configuración financiera privada de cada administrador.';

create table if not exists public.finance_categories (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    kind public.finance_category_kind not null default 'both',
    name text not null,
    color_hex text not null default '#2D8CFF',
    icon text,
    is_active boolean not null default true,
    position integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (admin_id, name, kind)
);

create table if not exists public.finance_payment_methods (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    name text not null,
    is_active boolean not null default true,
    position integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (admin_id, name)
);

create table if not exists public.finance_tags (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    name text not null,
    color_hex text not null default '#8C52FF',
    created_at timestamptz not null default now(),
    unique (admin_id, name)
);

create table if not exists public.finance_accounts (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    name text not null,
    account_type public.finance_account_type not null default 'cash',
    currency text not null default 'COP',
    opening_balance numeric(18, 2) not null default 0,
    is_active boolean not null default true,
    position integer not null default 0,
    bank_name text,
    account_number_masked text,
    external_ref text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (admin_id, name)
);

create table if not exists public.finance_incomes (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    entry_date date not null default (timezone('utc', now()))::date,
    concept text not null,
    client_workspace_id uuid references public.workspaces (id) on delete set null,
    project_id uuid references public.projects (id) on delete set null,
    category_id uuid references public.finance_categories (id) on delete set null,
    payment_method_id uuid references public.finance_payment_methods (id) on delete set null,
    account_id uuid references public.finance_accounts (id) on delete set null,
    amount numeric(18, 2) not null check (amount >= 0),
    currency text not null default 'COP',
    status public.finance_entry_status not null default 'confirmed',
    notes text,
    tags text[] not null default '{}',
    invoice_ref text,
    external_ref text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.finance_expenses (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    entry_date date not null default (timezone('utc', now()))::date,
    concept text not null,
    vendor_name text,
    category_id uuid references public.finance_categories (id) on delete set null,
    payment_method_id uuid references public.finance_payment_methods (id) on delete set null,
    account_id uuid references public.finance_accounts (id) on delete set null,
    amount numeric(18, 2) not null check (amount >= 0),
    currency text not null default 'COP',
    status public.finance_entry_status not null default 'confirmed',
    notes text,
    tags text[] not null default '{}',
    invoice_ref text,
    external_ref text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- Índices
-- ----------------------------------------------------------
create index if not exists finance_categories_admin_idx on public.finance_categories (admin_id);
create index if not exists finance_payment_methods_admin_idx on public.finance_payment_methods (admin_id);
create index if not exists finance_tags_admin_idx on public.finance_tags (admin_id);
create index if not exists finance_accounts_admin_idx on public.finance_accounts (admin_id);

create index if not exists finance_incomes_admin_date_idx on public.finance_incomes (admin_id, entry_date desc);
create index if not exists finance_incomes_admin_status_idx on public.finance_incomes (admin_id, status);
create index if not exists finance_incomes_project_idx on public.finance_incomes (project_id);
create index if not exists finance_incomes_client_idx on public.finance_incomes (client_workspace_id);

create index if not exists finance_expenses_admin_date_idx on public.finance_expenses (admin_id, entry_date desc);
create index if not exists finance_expenses_admin_status_idx on public.finance_expenses (admin_id, status);

-- ----------------------------------------------------------
-- Triggers updated_at
-- ----------------------------------------------------------
drop trigger if exists set_updated_at on public.finance_settings;
create trigger set_updated_at before update on public.finance_settings
    for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.finance_categories;
create trigger set_updated_at before update on public.finance_categories
    for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.finance_payment_methods;
create trigger set_updated_at before update on public.finance_payment_methods
    for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.finance_accounts;
create trigger set_updated_at before update on public.finance_accounts
    for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.finance_incomes;
create trigger set_updated_at before update on public.finance_incomes
    for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.finance_expenses;
create trigger set_updated_at before update on public.finance_expenses
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------
-- Bootstrap de defaults
-- ----------------------------------------------------------
create or replace function public.seed_finance_defaults(p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_admin_id is null then
        return;
    end if;

    insert into public.finance_accounts (admin_id, name, account_type, currency, position)
    values (p_admin_id, 'Caja principal', 'cash', 'COP', 0)
    on conflict (admin_id, name) do nothing;

    insert into public.finance_payment_methods (admin_id, name, position)
    values
        (p_admin_id, 'Transferencia', 0),
        (p_admin_id, 'Efectivo', 1),
        (p_admin_id, 'Tarjeta', 2),
        (p_admin_id, 'Nequi / Daviplata', 3)
    on conflict (admin_id, name) do nothing;

    insert into public.finance_categories (admin_id, kind, name, color_hex, position)
    values
        (p_admin_id, 'income', 'Servicios', '#2D8CFF', 0),
        (p_admin_id, 'income', 'Proyectos', '#8C52FF', 1),
        (p_admin_id, 'income', 'Otros ingresos', '#4ADE80', 2),
        (p_admin_id, 'expense', 'Operativos', '#FF8A3D', 0),
        (p_admin_id, 'expense', 'Marketing', '#FF4D6A', 1),
        (p_admin_id, 'expense', 'Software / Herramientas', '#5FA8FF', 2),
        (p_admin_id, 'expense', 'Otros gastos', '#8a8a8a', 3)
    on conflict (admin_id, name, kind) do nothing;

    insert into public.finance_tags (admin_id, name, color_hex)
    values
        (p_admin_id, 'Recurrente', '#2D8CFF'),
        (p_admin_id, 'Urgente', '#FF4D6A')
    on conflict (admin_id, name) do nothing;
end;
$$;

create or replace function public.trg_finance_settings_seed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.seed_finance_defaults(new.admin_id);
    return new;
end;
$$;

drop trigger if exists finance_settings_after_insert on public.finance_settings;
create trigger finance_settings_after_insert
    after insert on public.finance_settings
    for each row execute function public.trg_finance_settings_seed();

-- ----------------------------------------------------------
-- RLS + políticas (drop + create)
-- ----------------------------------------------------------
alter table public.finance_settings enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_payment_methods enable row level security;
alter table public.finance_tags enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_incomes enable row level security;
alter table public.finance_expenses enable row level security;

do $$
declare
    t text;
begin
    foreach t in array array[
        'finance_settings',
        'finance_categories',
        'finance_payment_methods',
        'finance_tags',
        'finance_accounts',
        'finance_incomes',
        'finance_expenses'
    ]
    loop
        execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
        execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
        execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
        execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);

        execute format('
            create policy %I on public.%I for select
                using (public.is_admin() and admin_id = auth.uid());
            create policy %I on public.%I for insert
                with check (public.is_admin() and admin_id = auth.uid());
            create policy %I on public.%I for update
                using (public.is_admin() and admin_id = auth.uid())
                with check (public.is_admin() and admin_id = auth.uid());
            create policy %I on public.%I for delete
                using (public.is_admin() and admin_id = auth.uid());
        ',
            t || '_select_own', t,
            t || '_insert_own', t,
            t || '_update_own', t,
            t || '_delete_own', t
        );
    end loop;
end;
$$;

-- Realtime
do $$
begin
    begin
        alter publication supabase_realtime add table public.finance_incomes;
    exception
        when duplicate_object then null;
        when undefined_object then null;
    end;
    begin
        alter publication supabase_realtime add table public.finance_expenses;
    exception
        when duplicate_object then null;
        when undefined_object then null;
    end;
end;
$$;
