-- ==========================================================
-- NEXA HUB — 22. Restricción real de columnas para el cliente
-- ==========================================================
-- Las políticas RLS de project_tasks_update_own_client_tasks,
-- approvals_update_own y project_deliverables_update_own limitan
-- QUÉ FILAS puede tocar el cliente, pero RLS no puede limitar QUÉ
-- COLUMNAS cambia dentro de esa fila. Y no se puede resolver con
-- GRANT de columnas porque el admin y el cliente autentican con
-- el MISMO rol de Postgres ("authenticated"): la diferencia entre
-- ambos es únicamente el valor de profiles.role, verificado en
-- runtime con is_admin().
--
-- Por eso esta migración agrega triggers BEFORE UPDATE que, cuando
-- el usuario NO es admin, verifican fila por fila que únicamente
-- las columnas permitidas hayan cambiado (todas las demás deben
-- seguir siendo idénticas a como estaban).
-- ==========================================================

create function public.restrict_client_task_update()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    -- El cliente solo puede cambiar "status". Todo lo demás debe
    -- permanecer exactamente igual.
    if new.id is distinct from old.id
        or new.section_id is distinct from old.section_id
        or new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.task_type is distinct from old.task_type
        or new.priority is distinct from old.priority
        or new.assignee_id is distinct from old.assignee_id
        or new.due_date is distinct from old.due_date
        or new.order_index is distinct from old.order_index
        or new.created_by is distinct from old.created_by
    then
        raise exception 'No tienes permiso para modificar campos distintos al estado de esta tarea.';
    end if;

    return new;
end;
$$;

create trigger restrict_client_task_update
    before update on public.project_tasks
    for each row execute function public.restrict_client_task_update();

create function public.restrict_client_approval_update()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    -- El cliente solo puede fijar decision/decision_comment/decided_by/decided_at.
    if new.id is distinct from old.id
        or new.task_id is distinct from old.task_id
    then
        raise exception 'No tienes permiso para modificar esta aprobación.';
    end if;

    if old.decision <> 'pending' then
        raise exception 'Esta aprobación ya tiene una decisión registrada.';
    end if;

    return new;
end;
$$;

create trigger restrict_client_approval_update
    before update on public.approvals
    for each row execute function public.restrict_client_approval_update();

create function public.restrict_client_deliverable_update()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    -- El cliente solo puede cambiar "status" (aprobar/rechazar un entregable ya enviado).
    if new.id is distinct from old.id
        or new.project_id is distinct from old.project_id
        or new.phase_id is distinct from old.phase_id
        or new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.file_id is distinct from old.file_id
        or new.delivered_by is distinct from old.delivered_by
        or new.delivered_at is distinct from old.delivered_at
    then
        raise exception 'No tienes permiso para modificar campos distintos al estado de este entregable.';
    end if;

    return new;
end;
$$;

create trigger restrict_client_deliverable_update
    before update on public.project_deliverables
    for each row execute function public.restrict_client_deliverable_update();
