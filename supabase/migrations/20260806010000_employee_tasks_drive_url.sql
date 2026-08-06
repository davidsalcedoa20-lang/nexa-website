-- ==========================================================
-- Empleados: enlace Drive por video + sync calendario en INSERT
-- ==========================================================

alter table public.employee_tasks
    add column if not exists drive_url text;

comment on column public.employee_tasks.drive_url is
    'Enlace a la carpeta de material (Google Drive) de este video.';

-- delivered_at al pasar a entregado (solo UPDATE; NEW mutable)
create or replace function public.mark_employee_task_delivered()
returns trigger
language plpgsql
as $$
begin
    if new.status = 'entregado' and old.status is distinct from 'entregado' then
        new.delivered_at := coalesce(new.delivered_at, now());
    end if;
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_mark_employee_task_delivered on public.employee_tasks;
create trigger trg_mark_employee_task_delivered
    before update of status on public.employee_tasks
    for each row
    execute function public.mark_employee_task_delivered();

-- Calendario: AFTER insert/update (la fila de task ya existe → FK ok)
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

    return new;
end;
$$;

drop trigger if exists trg_sync_employee_task_calendar on public.employee_tasks;
create trigger trg_sync_employee_task_calendar
    after insert or update of delivery_date on public.employee_tasks
    for each row
    execute function public.sync_employee_task_calendar();

-- Los editores no pueden editar drive_url (solo status + delivery_date)
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
            or new.drive_url is distinct from old.drive_url
            or new.sort_order is distinct from old.sort_order
            or new.created_by is distinct from old.created_by
        then
            raise exception 'Los editores solo pueden cambiar estado y fecha de entrega.';
        end if;
    end if;

    return new;
end;
$$;
