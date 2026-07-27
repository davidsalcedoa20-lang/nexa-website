-- ==========================================================
-- NEXA HUB — 18. Motor de Proyectos: funciones y triggers
-- ==========================================================
-- Ver docs/proyectos-module-design.md sección 5.
-- ==========================================================

-- ----------------------------------------------------------
-- 18.1 Cache de progreso en "projects" (evita recalcular en cada
-- consulta de listado). Se recalcula automáticamente por triggers.
-- ----------------------------------------------------------
alter table public.projects
    add column progress_percent integer not null default 0,
    add column client_progress_percent integer not null default 0,
    add column nexa_progress_percent integer not null default 0,
    add constraint projects_progress_percent_range check (progress_percent between 0 and 100),
    add constraint projects_client_progress_percent_range check (client_progress_percent between 0 and 100),
    add constraint projects_nexa_progress_percent_range check (nexa_progress_percent between 0 and 100);

comment on column public.projects.progress_percent is 'Cache autogenerado: % de tareas completadas/finalizadas del proyecto.';
comment on column public.projects.client_progress_percent is 'Cache autogenerado: % de tareas con task_type = client completadas.';
comment on column public.projects.nexa_progress_percent is 'Cache autogenerado: % de tareas con task_type IN (nexa, approval) completadas.';

-- ----------------------------------------------------------
-- 18.2 updated_at automático en las tablas nuevas que lo tienen.
-- Reutiliza la función existente public.set_updated_at().
-- ----------------------------------------------------------
create trigger set_updated_at before update on public.project_types
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_phases
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_sections
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_tasks
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.approvals
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_deliverables
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_comments
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------
-- 18.3 Recalcular progreso de un bloque a partir de sus tareas.
-- ----------------------------------------------------------
create function public.recalculate_phase_progress(p_phase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_total integer;
    v_done integer;
    v_percent integer;
    v_project_id uuid;
    v_is_blocked boolean;
    v_current_status public.progress_status;
begin
    select count(*), count(*) filter (where t.status in ('completed', 'finished'))
        into v_total, v_done
        from public.project_tasks t
        join public.project_sections s on s.id = t.section_id
        where s.phase_id = p_phase_id;

    v_percent := case when v_total = 0 then 0 else round((v_done::numeric / v_total) * 100) end;

    select ph.project_id, ph.status into v_project_id, v_current_status
        from public.project_phases ph where ph.id = p_phase_id;

    v_is_blocked := not public.is_phase_unblocked(p_phase_id);

    update public.project_phases
        set progress_percent = v_percent,
            status = case
                when v_is_blocked then 'blocked'::public.progress_status
                when v_total > 0 and v_done = v_total then 'finished'::public.progress_status
                when v_done > 0 then 'in_progress'::public.progress_status
                when v_current_status = 'blocked' then 'pending'::public.progress_status
                else v_current_status
            end
        where id = p_phase_id;

    if v_project_id is not null then
        perform public.recalculate_project_progress(v_project_id);
    end if;
end;
$$;

-- ----------------------------------------------------------
-- 18.4 Recalcular progreso general / cliente / NEXA de un proyecto.
-- ----------------------------------------------------------
create function public.recalculate_project_progress(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_total integer;
    v_done integer;
    v_client_total integer;
    v_client_done integer;
    v_nexa_total integer;
    v_nexa_done integer;
begin
    select count(*), count(*) filter (where t.status in ('completed', 'finished'))
        into v_total, v_done
        from public.project_tasks t
        join public.project_sections s on s.id = t.section_id
        join public.project_phases ph on ph.id = s.phase_id
        where ph.project_id = p_project_id;

    select count(*), count(*) filter (where t.status in ('completed', 'finished'))
        into v_client_total, v_client_done
        from public.project_tasks t
        join public.project_sections s on s.id = t.section_id
        join public.project_phases ph on ph.id = s.phase_id
        where ph.project_id = p_project_id and t.task_type = 'client';

    select count(*), count(*) filter (where t.status in ('completed', 'finished'))
        into v_nexa_total, v_nexa_done
        from public.project_tasks t
        join public.project_sections s on s.id = t.section_id
        join public.project_phases ph on ph.id = s.phase_id
        where ph.project_id = p_project_id and t.task_type in ('nexa', 'approval');

    update public.projects
        set progress_percent = case when v_total = 0 then 0 else round((v_done::numeric / v_total) * 100) end,
            client_progress_percent = case when v_client_total = 0 then 0 else round((v_client_done::numeric / v_client_total) * 100) end,
            nexa_progress_percent = case when v_nexa_total = 0 then 0 else round((v_nexa_done::numeric / v_nexa_total) * 100) end
        where id = p_project_id;
end;
$$;

-- ----------------------------------------------------------
-- 18.5 Trigger: cuando cambia una tarea, recalcular su bloque.
-- ----------------------------------------------------------
create function public.on_task_change_recalculate_phase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_phase_id uuid;
    v_old_phase_id uuid;
begin
    select phase_id into v_phase_id from public.project_sections where id = coalesce(new.section_id, old.section_id);
    perform public.recalculate_phase_progress(v_phase_id);

    if tg_op = 'UPDATE' and old.section_id <> new.section_id then
        select phase_id into v_old_phase_id from public.project_sections where id = old.section_id;
        perform public.recalculate_phase_progress(v_old_phase_id);
    end if;

    return coalesce(new, old);
end;
$$;

create trigger on_task_change_recalculate_phase
    after insert or delete or update of status, section_id on public.project_tasks
    for each row execute function public.on_task_change_recalculate_phase();

-- ----------------------------------------------------------
-- 18.6 Trigger: al terminar un bloque, reevaluar bloqueos de los
-- bloques que dependen de él (o de sus tareas/entregables).
-- ----------------------------------------------------------
create function public.sync_dependent_phases_blocked_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_dependent record;
begin
    for v_dependent in
        select distinct d.phase_id
        from public.project_dependencies d
        where (tg_table_name = 'project_phases' and d.depends_on_phase_id = new.id)
           or (tg_table_name = 'project_tasks' and d.depends_on_task_id = new.id)
           or (tg_table_name = 'project_deliverables' and d.depends_on_deliverable_id = new.id)
    loop
        perform public.recalculate_phase_progress(v_dependent.phase_id);
    end loop;

    return new;
end;
$$;

create trigger sync_dependent_phases_on_phase_change
    after update of status on public.project_phases
    for each row execute function public.sync_dependent_phases_blocked_status();

create trigger sync_dependent_phases_on_task_change
    after update of status on public.project_tasks
    for each row execute function public.sync_dependent_phases_blocked_status();

create trigger sync_dependent_phases_on_deliverable_change
    after update of status on public.project_deliverables
    for each row execute function public.sync_dependent_phases_blocked_status();

-- ----------------------------------------------------------
-- 18.7 Cronología automática: registrar eventos clave.
-- ----------------------------------------------------------
create function public.log_project_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.project_timeline_events (project_id, event_type, description, actor_id)
    values (new.id, 'project_created', 'Proyecto "' || new.name || '" creado.', new.responsible_id);
    return new;
end;
$$;

create trigger log_project_created
    after insert on public.projects
    for each row execute function public.log_project_created();

create function public.log_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project_id uuid;
    v_phase_name text;
begin
    if new.status = old.status then
        return new;
    end if;

    select ph.project_id, ph.name into v_project_id, v_phase_name
        from public.project_sections s
        join public.project_phases ph on ph.id = s.phase_id
        where s.id = new.section_id;

    if new.status in ('completed', 'finished') then
        insert into public.project_timeline_events (project_id, event_type, description, actor_id)
        values (v_project_id, 'task_completed', 'Tarea "' || new.title || '" completada (' || v_phase_name || ').', new.assignee_id);
    end if;

    return new;
end;
$$;

create trigger log_task_status_change
    after update of status on public.project_tasks
    for each row execute function public.log_task_status_change();

create function public.log_phase_finished()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.status = 'finished' and old.status <> 'finished' then
        insert into public.project_timeline_events (project_id, event_type, description)
        values (new.project_id, 'phase_finished', 'Bloque "' || new.name || '" finalizado.');
    end if;
    return new;
end;
$$;

create trigger log_phase_finished
    after update of status on public.project_phases
    for each row execute function public.log_phase_finished();

create function public.log_approval_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project_id uuid;
    v_task_title text;
begin
    if new.decision = old.decision or new.decision = 'pending' then
        return new;
    end if;

    select ph.project_id, t.title into v_project_id, v_task_title
        from public.project_tasks t
        join public.project_sections s on s.id = t.section_id
        join public.project_phases ph on ph.id = s.phase_id
        where t.id = new.task_id;

    insert into public.project_timeline_events (project_id, event_type, description, actor_id)
    values (
        v_project_id,
        case when new.decision = 'approved' then 'approval_approved' else 'approval_changes_requested' end,
        case when new.decision = 'approved'
            then 'Cliente aprobó "' || v_task_title || '".'
            else 'Cliente solicitó cambios en "' || v_task_title || '".'
        end,
        new.decided_by
    );

    if new.decision = 'approved' then
        update public.project_tasks set status = 'completed' where id = new.task_id;
    end if;

    return new;
end;
$$;

create trigger log_approval_decision
    after update of decision on public.approvals
    for each row execute function public.log_approval_decision();

create function public.log_deliverable_delivered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.status = 'delivered' and old.status <> 'delivered' then
        insert into public.project_timeline_events (project_id, event_type, description, actor_id)
        values (new.project_id, 'deliverable_delivered', 'Entregable "' || new.title || '" enviado.', new.delivered_by);
    end if;
    if new.status = 'approved' and old.status <> 'approved' then
        insert into public.project_timeline_events (project_id, event_type, description)
        values (new.project_id, 'deliverable_approved', 'Entregable "' || new.title || '" aprobado por el cliente.');
    end if;
    return new;
end;
$$;

create trigger log_deliverable_delivered
    after update of status on public.project_deliverables
    for each row execute function public.log_deliverable_delivered();

-- ----------------------------------------------------------
-- 18.8 Duplicar un proyecto completo (estructura, sin archivos ni
-- comentarios ni cronología). Usado por "Duplicar" en el admin.
-- ----------------------------------------------------------
create function public.duplicate_project(p_source_project_id uuid, p_new_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_new_project_id uuid;
    v_phase record;
    v_new_phase_id uuid;
    v_section record;
    v_new_section_id uuid;
    v_task record;
begin
    if not public.is_admin() then
        raise exception 'Solo un administrador puede duplicar proyectos.';
    end if;

    insert into public.projects (
        workspace_id, name, project_type_id, description, status,
        start_date, end_date, color_hex, responsible_id, created_by
    )
    select workspace_id, p_new_name, project_type_id, description, 'not_started'::public.project_status,
           current_date,
           case when start_date is not null and end_date is not null
                then current_date + (end_date - start_date)
                else null
           end,
           color_hex, responsible_id, created_by
    from public.projects where id = p_source_project_id
    returning id into v_new_project_id;

    for v_phase in
        select * from public.project_phases where project_id = p_source_project_id order by order_index
    loop
        insert into public.project_phases (
            project_id, name, description, order_index, duration_days,
            planned_start_date, planned_end_date, status, progress_percent
        ) values (
            v_new_project_id, v_phase.name, v_phase.description, v_phase.order_index, v_phase.duration_days,
            null, null, 'pending', 0
        ) returning id into v_new_phase_id;

        for v_section in
            select * from public.project_sections where phase_id = v_phase.id order by order_index
        loop
            insert into public.project_sections (phase_id, name, order_index)
            values (v_new_phase_id, v_section.name, v_section.order_index)
            returning id into v_new_section_id;

            for v_task in
                select * from public.project_tasks where section_id = v_section.id order by order_index
            loop
                insert into public.project_tasks (
                    section_id, title, description, task_type, status, priority,
                    assignee_id, due_date, order_index, created_by
                ) values (
                    v_new_section_id, v_task.title, v_task.description, v_task.task_type, 'pending', v_task.priority,
                    v_task.assignee_id, null, v_task.order_index, v_task.created_by
                );
            end loop;
        end loop;
    end loop;

    return v_new_project_id;
end;
$$;

comment on function public.duplicate_project(uuid, text) is
    'Clona la estructura completa (bloques/secciones/tareas) de un proyecto en uno nuevo, reiniciando todos los estados a "pending". No copia archivos, comentarios, cronología ni dependencias entre bloques (deben rehacerse manualmente si aplica).';
