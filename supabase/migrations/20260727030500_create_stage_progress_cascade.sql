-- ==========================================================
-- NEXA HUB — 28. Progreso automático en cascada hasta la etapa
-- ==========================================================
-- Cadena completa: tarea cambia -> se recalcula su bloque
-- (ya existía) -> ahora también se recalcula la etapa del bloque.
-- ==========================================================

create function public.recalculate_stage_progress(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_total integer;
    v_avg_progress numeric;
    v_finished_count integer;
    v_any_progress boolean;
begin
    if p_stage_id is null then
        return;
    end if;

    select count(*), coalesce(avg(progress_percent), 0),
           count(*) filter (where status = 'finished'),
           bool_or(progress_percent > 0 or status not in ('pending'))
        into v_total, v_avg_progress, v_finished_count, v_any_progress
        from public.project_phases
        where timeline_stage_id = p_stage_id;

    update public.project_timeline_stages
        set progress_percent = round(v_avg_progress),
            status = case
                when v_total = 0 then status
                when v_finished_count = v_total then 'finished'::public.progress_status
                when v_any_progress then 'in_progress'::public.progress_status
                else 'pending'::public.progress_status
            end
        where id = p_stage_id;
end;
$$;

comment on function public.recalculate_stage_progress(uuid) is
    'Recalcula progress_percent/status de una etapa a partir del promedio de sus bloques.';

-- Se agrega la llamada a recalculate_stage_progress al final de
-- recalculate_phase_progress (mismo comportamiento previo + cascada).
create or replace function public.recalculate_phase_progress(p_phase_id uuid)
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
    v_stage_id uuid;
    v_is_blocked boolean;
    v_current_status public.progress_status;
begin
    select count(*), count(*) filter (where t.status in ('completed', 'finished', 'approved'))
        into v_total, v_done
        from public.project_tasks t
        join public.project_sections s on s.id = t.section_id
        where s.phase_id = p_phase_id;

    v_percent := case when v_total = 0 then 0 else round((v_done::numeric / v_total) * 100) end;

    select ph.project_id, ph.status, ph.timeline_stage_id
        into v_project_id, v_current_status, v_stage_id
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

    if v_stage_id is not null then
        perform public.recalculate_stage_progress(v_stage_id);
    end if;
end;
$$;

-- También se recalcula la tarea "aprobado" como completada en el
-- progreso general/cliente/NEXA del proyecto (mismo criterio nuevo).
create or replace function public.recalculate_project_progress(p_project_id uuid)
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
    select count(*), count(*) filter (where t.status in ('completed', 'finished', 'approved'))
        into v_total, v_done
        from public.project_tasks t
        join public.project_sections s on s.id = t.section_id
        join public.project_phases ph on ph.id = s.phase_id
        where ph.project_id = p_project_id;

    select count(*), count(*) filter (where t.status in ('completed', 'finished', 'approved'))
        into v_client_total, v_client_done
        from public.project_tasks t
        join public.project_sections s on s.id = t.section_id
        join public.project_phases ph on ph.id = s.phase_id
        where ph.project_id = p_project_id and t.task_type = 'client';

    select count(*), count(*) filter (where t.status in ('completed', 'finished', 'approved'))
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

-- Trigger: cuando un bloque cambia de etapa (o se crea/elimina),
-- recalcular tanto la etapa nueva como la anterior.
create function public.on_phase_change_recalculate_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'DELETE' then
        perform public.recalculate_stage_progress(old.timeline_stage_id);
        return old;
    end if;

    perform public.recalculate_stage_progress(new.timeline_stage_id);

    if tg_op = 'UPDATE' and old.timeline_stage_id is distinct from new.timeline_stage_id then
        perform public.recalculate_stage_progress(old.timeline_stage_id);
    end if;

    return new;
end;
$$;

create trigger on_phase_change_recalculate_stage
    after insert or delete or update of timeline_stage_id on public.project_phases
    for each row execute function public.on_phase_change_recalculate_stage();
