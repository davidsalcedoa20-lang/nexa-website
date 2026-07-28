-- ==========================================================
-- NEXA HUB — 24. Fecha de finalización de tareas
-- ==========================================================
-- Módulo "Mis Tareas" del cliente: al marcar una tarea como
-- completada (o al terminarla el admin) hace falta registrar
-- CUÁNDO pasó, sin depender de "updated_at" (esa columna cambia
-- con CUALQUIER edición, no solo al completarla).
--
-- "completed_at" se calcula solo, con un trigger BEFORE UPDATE:
--   - Se rellena con NOW() la primera vez que el estado entra a
--     un valor "terminado" (completed / finished / approved).
--   - Se limpia (NULL) si alguien la reabre (el estado sale de
--     ese grupo), para que no quede una fecha de cierre "fantasma".
-- Funciona igual sin importar quién actualice el estado (admin
-- desde el panel o cliente desde "Mis Tareas"): no rompe la
-- restricción de columnas de restrict_client_task_update (esa
-- función no revisa "completed_at", así que ambos roles pueden
-- dispararla con normalidad).
-- ==========================================================

alter table public.project_tasks
    add column completed_at timestamptz;

comment on column public.project_tasks.completed_at is
    'Fecha/hora en que la tarea entró a un estado terminado (completed/finished/approved). Se gestiona sola via trigger, nunca se escribe a mano.';

create function public.set_task_completed_at()
returns trigger
language plpgsql
as $$
begin
    if new.status in ('completed', 'finished', 'approved') and old.status is distinct from new.status then
        new.completed_at := now();
    elsif new.status not in ('completed', 'finished', 'approved') and old.status in ('completed', 'finished', 'approved') then
        new.completed_at := null;
    end if;

    return new;
end;
$$;

create trigger set_task_completed_at
    before update of status on public.project_tasks
    for each row execute function public.set_task_completed_at();
