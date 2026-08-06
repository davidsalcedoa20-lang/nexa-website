-- Campos de trabajo editorial (cliente + indicaciones)
-- checklist ya existe como jsonb; se usará como lista [{id,label,done}]

alter table public.employee_tasks
    add column if not exists client_name text not null default '',
    add column if not exists instructions text not null default '';

comment on column public.employee_tasks.client_name is 'Nombre del cliente asociado al video.';
comment on column public.employee_tasks.instructions is 'Indicaciones detalladas del administrador.';

-- Editores no pueden editar cliente/indicaciones/portada/drive
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
            or new.instructions is distinct from old.instructions
            or new.client_name is distinct from old.client_name
            or new.priority is distinct from old.priority
            or new.duration_label is distinct from old.duration_label
            or new.drive_url is distinct from old.drive_url
            or new.drive_folder_name is distinct from old.drive_folder_name
            or new.cover_url is distinct from old.cover_url
            or new.delivery_date is distinct from old.delivery_date
            or new.sort_order is distinct from old.sort_order
            or new.created_by is distinct from old.created_by
        then
            raise exception 'Los editores solo pueden cambiar estado, checklist, notas y comentarios.';
        end if;
    end if;

    return new;
end;
$$;
