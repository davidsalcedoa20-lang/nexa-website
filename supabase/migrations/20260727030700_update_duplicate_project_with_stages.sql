-- ==========================================================
-- NEXA HUB — 30. duplicate_project() ahora también copia etapas
-- ==========================================================

create or replace function public.duplicate_project(p_source_project_id uuid, p_new_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_new_project_id uuid;
    v_stage record;
    v_new_stage_id uuid;
    v_stage_id_map jsonb := '{}'::jsonb;
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
        workspace_id, name, project_type_id, description, status, modality,
        start_date, end_date, color_hex, secondary_color_hex, responsible_id, created_by
    )
    select workspace_id, p_new_name, project_type_id, description, 'not_started'::public.project_status, modality,
           current_date,
           case when start_date is not null and end_date is not null
                then current_date + (end_date - start_date)
                else null
           end,
           color_hex, secondary_color_hex, responsible_id, created_by
    from public.projects where id = p_source_project_id
    returning id into v_new_project_id;

    -- 1) Copiar etapas y recordar el mapeo id_viejo -> id_nuevo.
    for v_stage in
        select * from public.project_timeline_stages where project_id = p_source_project_id order by order_index
    loop
        insert into public.project_timeline_stages (project_id, name, description, color_hex, order_index)
        values (v_new_project_id, v_stage.name, v_stage.description, v_stage.color_hex, v_stage.order_index)
        returning id into v_new_stage_id;

        v_stage_id_map := v_stage_id_map || jsonb_build_object(v_stage.id::text, v_new_stage_id::text);
    end loop;

    -- 2) Copiar bloques (enlazados a su etapa correspondiente), secciones y tareas.
    for v_phase in
        select * from public.project_phases where project_id = p_source_project_id order by order_index
    loop
        insert into public.project_phases (
            project_id, name, description, order_index, duration_days,
            planned_start_date, planned_end_date, status, progress_percent, timeline_stage_id
        ) values (
            v_new_project_id, v_phase.name, v_phase.description, v_phase.order_index, v_phase.duration_days,
            null, null, 'pending', 0,
            case when v_phase.timeline_stage_id is not null
                then (v_stage_id_map ->> v_phase.timeline_stage_id::text)::uuid
                else null
            end
        ) returning id into v_new_phase_id;

        for v_section in
            select * from public.project_sections where phase_id = v_phase.id order by order_index
        loop
            insert into public.project_sections (phase_id, name, order_index, color_hex, handle)
            values (v_new_phase_id, v_section.name, v_section.order_index, v_section.color_hex, v_section.handle)
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
    'Clona la estructura completa (etapas/bloques/secciones/tareas) de un proyecto en uno nuevo, reiniciando todos los estados a "pending". No copia archivos, comentarios, cronología ni dependencias entre bloques (deben rehacerse manualmente si aplica).';
