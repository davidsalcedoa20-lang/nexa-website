-- ==========================================================
-- Empleados → Editor: portada, checklist, notas, estados
-- ==========================================================

alter table public.employee_tasks
    add column if not exists cover_url text,
    add column if not exists drive_folder_name text,
    add column if not exists checklist jsonb not null default '{}'::jsonb,
    add column if not exists editor_notes text not null default '';

comment on column public.employee_tasks.cover_url is 'Imagen de portada del video/trabajo.';
comment on column public.employee_tasks.drive_folder_name is 'Nombre visible de la carpeta de Drive.';
comment on column public.employee_tasks.checklist is 'Seguimiento del editor (casillas).';
comment on column public.employee_tasks.editor_notes is 'Notas internas del editor.';

-- Migrar estados antiguos → nuevos
update public.employee_tasks set status = 'en_progreso' where status = 'en_edicion';
update public.employee_tasks set status = 'finalizado' where status = 'entregado';

alter table public.employee_tasks drop constraint if exists employee_tasks_status_check;
alter table public.employee_tasks
    add constraint employee_tasks_status_check
    check (status in ('pendiente', 'en_progreso', 'esperando_revision', 'finalizado'));

alter table public.employee_tasks alter column status set default 'pendiente';

-- delivered_at al pasar a finalizado
create or replace function public.mark_employee_task_delivered()
returns trigger
language plpgsql
as $$
begin
    if new.status = 'finalizado' and old.status is distinct from 'finalizado' then
        new.delivered_at := coalesce(new.delivered_at, now());
    end if;
    new.updated_at := now();
    return new;
end;
$$;

-- Editores pueden actualizar: status, delivery_date, checklist, editor_notes
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
            or new.drive_folder_name is distinct from old.drive_folder_name
            or new.cover_url is distinct from old.cover_url
            or new.sort_order is distinct from old.sort_order
            or new.created_by is distinct from old.created_by
        then
            raise exception 'Los editores solo pueden cambiar estado, fecha, checklist y notas.';
        end if;
    end if;

    return new;
end;
$$;
