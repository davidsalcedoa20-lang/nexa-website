-- ==========================================================
-- NEXA HUB — ERP Financiero (Fase 2 · Contabilidad operativa)
-- ==========================================================
-- Extiende Fase 1: IVA, descripción, comprobantes, adjuntos,
-- soft delete, auditoría, catálogos ampliados. RLS por admin_id.
-- ==========================================================

-- ----------------------------------------------------------
-- Columnas operativas en ingresos / gastos
-- ----------------------------------------------------------
alter table public.finance_incomes
    add column if not exists description text,
    add column if not exists tax_amount numeric(18, 2) not null default 0
        check (tax_amount >= 0),
    add column if not exists voucher_number text,
    add column if not exists created_by uuid references public.profiles (id) on delete set null,
    add column if not exists deleted_at timestamptz;

alter table public.finance_expenses
    add column if not exists description text,
    add column if not exists tax_amount numeric(18, 2) not null default 0
        check (tax_amount >= 0),
    add column if not exists invoice_number text,
    add column if not exists project_id uuid references public.projects (id) on delete set null,
    add column if not exists created_by uuid references public.profiles (id) on delete set null,
    add column if not exists deleted_at timestamptz;

create index if not exists finance_incomes_admin_alive_idx
    on public.finance_incomes (admin_id, entry_date desc)
    where deleted_at is null;

create index if not exists finance_expenses_admin_alive_idx
    on public.finance_expenses (admin_id, entry_date desc)
    where deleted_at is null;

create index if not exists finance_expenses_project_idx
    on public.finance_expenses (project_id)
    where deleted_at is null;

-- ----------------------------------------------------------
-- Adjuntos (PDF / imagen)
-- ----------------------------------------------------------
create table if not exists public.finance_attachments (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    entry_type text not null check (entry_type in ('income', 'expense')),
    entry_id uuid not null,
    file_name text not null,
    storage_path text not null,
    mime_type text,
    size_bytes bigint,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists finance_attachments_entry_idx
    on public.finance_attachments (entry_type, entry_id)
    where deleted_at is null;

create index if not exists finance_attachments_admin_idx
    on public.finance_attachments (admin_id)
    where deleted_at is null;

alter table public.finance_attachments enable row level security;

drop policy if exists finance_attachments_select_own on public.finance_attachments;
drop policy if exists finance_attachments_insert_own on public.finance_attachments;
drop policy if exists finance_attachments_update_own on public.finance_attachments;
drop policy if exists finance_attachments_delete_own on public.finance_attachments;

create policy finance_attachments_select_own on public.finance_attachments
    for select using (public.is_admin() and admin_id = auth.uid() and deleted_at is null);

create policy finance_attachments_insert_own on public.finance_attachments
    for insert with check (public.is_admin() and admin_id = auth.uid());

create policy finance_attachments_update_own on public.finance_attachments
    for update
    using (public.is_admin() and admin_id = auth.uid())
    with check (public.is_admin() and admin_id = auth.uid());

create policy finance_attachments_delete_own on public.finance_attachments
    for delete using (public.is_admin() and admin_id = auth.uid());

-- ----------------------------------------------------------
-- Auditoría básica
-- ----------------------------------------------------------
create table if not exists public.finance_audit_log (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid not null references public.profiles (id) on delete cascade,
    entity_type text not null,
    entity_id uuid,
    action text not null,
    payload jsonb not null default '{}'::jsonb,
    created_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists finance_audit_log_admin_idx
    on public.finance_audit_log (admin_id, created_at desc);

alter table public.finance_audit_log enable row level security;

drop policy if exists finance_audit_log_select_own on public.finance_audit_log;
drop policy if exists finance_audit_log_insert_own on public.finance_audit_log;

create policy finance_audit_log_select_own on public.finance_audit_log
    for select using (public.is_admin() and admin_id = auth.uid());

create policy finance_audit_log_insert_own on public.finance_audit_log
    for insert with check (public.is_admin() and admin_id = auth.uid());

-- ----------------------------------------------------------
-- Soft-delete: ocultar eliminados en SELECT (políticas)
-- ----------------------------------------------------------
drop policy if exists finance_incomes_select_own on public.finance_incomes;
create policy finance_incomes_select_own on public.finance_incomes
    for select using (
        public.is_admin()
        and admin_id = auth.uid()
        and deleted_at is null
    );

drop policy if exists finance_expenses_select_own on public.finance_expenses;
create policy finance_expenses_select_own on public.finance_expenses
    for select using (
        public.is_admin()
        and admin_id = auth.uid()
        and deleted_at is null
    );

-- ----------------------------------------------------------
-- Storage bucket privado para adjuntos financieros
-- ----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'finance-attachments',
    'finance-attachments',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists finance_attachments_storage_select on storage.objects;
drop policy if exists finance_attachments_storage_insert on storage.objects;
drop policy if exists finance_attachments_storage_update on storage.objects;
drop policy if exists finance_attachments_storage_delete on storage.objects;

-- Ruta: {admin_id}/{entry_type}/{entry_id}/{filename}
create policy finance_attachments_storage_select on storage.objects
    for select to authenticated
    using (
        bucket_id = 'finance-attachments'
        and public.is_admin()
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy finance_attachments_storage_insert on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'finance-attachments'
        and public.is_admin()
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy finance_attachments_storage_update on storage.objects
    for update to authenticated
    using (
        bucket_id = 'finance-attachments'
        and public.is_admin()
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy finance_attachments_storage_delete on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'finance-attachments'
        and public.is_admin()
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- ----------------------------------------------------------
-- Catálogos ampliados (idempotente)
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
        (p_admin_id, 'Efectivo', 0),
        (p_admin_id, 'Nequi', 1),
        (p_admin_id, 'Daviplata', 2),
        (p_admin_id, 'Transferencia', 3),
        (p_admin_id, 'Bancolombia', 4),
        (p_admin_id, 'BBVA', 5),
        (p_admin_id, 'Tarjeta', 6),
        (p_admin_id, 'Otro', 7)
    on conflict (admin_id, name) do nothing;

    insert into public.finance_categories (admin_id, kind, name, color_hex, position)
    values
        (p_admin_id, 'income', 'Ventas', '#4ADE80', 0),
        (p_admin_id, 'income', 'Diseño Web', '#2D8CFF', 1),
        (p_admin_id, 'income', 'Marketing', '#FF8A3D', 2),
        (p_admin_id, 'income', 'Producción Audiovisual', '#8C52FF', 3),
        (p_admin_id, 'income', 'Publicidad', '#FF4D6A', 4),
        (p_admin_id, 'income', 'Consultoría', '#5FA8FF', 5),
        (p_admin_id, 'income', 'Otros', '#8a8a8a', 6),
        (p_admin_id, 'expense', 'Publicidad', '#FF4D6A', 0),
        (p_admin_id, 'expense', 'Software', '#5FA8FF', 1),
        (p_admin_id, 'expense', 'Hosting', '#2D8CFF', 2),
        (p_admin_id, 'expense', 'Dominios', '#8C52FF', 3),
        (p_admin_id, 'expense', 'Transporte', '#FFC15F', 4),
        (p_admin_id, 'expense', 'Gasolina', '#FF8A3D', 5),
        (p_admin_id, 'expense', 'Internet', '#4ADE80', 6),
        (p_admin_id, 'expense', 'Equipos', '#C9A8FF', 7),
        (p_admin_id, 'expense', 'Nómina', '#FF6B81', 8),
        (p_admin_id, 'expense', 'Impuestos', '#FFD666', 9),
        (p_admin_id, 'expense', 'Otros', '#8a8a8a', 10)
    on conflict (admin_id, name, kind) do nothing;

    insert into public.finance_tags (admin_id, name, color_hex)
    values
        (p_admin_id, 'Recurrente', '#2D8CFF'),
        (p_admin_id, 'Urgente', '#FF4D6A')
    on conflict (admin_id, name) do nothing;
end;
$$;

-- Re-sembrar catálogos para admins que ya tenían settings
do $$
declare
    r record;
begin
    for r in select admin_id from public.finance_settings
    loop
        perform public.seed_finance_defaults(r.admin_id);
    end loop;
end;
$$;

grant execute on function public.seed_finance_defaults(uuid) to authenticated;
