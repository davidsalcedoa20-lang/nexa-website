-- ==========================================================
-- NEXA HUB — Entregables por etapa (bloque de trabajo)
-- ==========================================================
-- Cada entregable puede pertenecer a una etapa de la línea
-- de tiempo. Backfill desde phase.timeline_stage_id o la
-- primera etapa del proyecto. Progreso de etapa se calcula
-- directamente desde las tareas de esa etapa.
-- ==========================================================

alter table public.project_deliverables
    add column if not exists timeline_stage_id uuid
        references public.project_timeline_stages (id) on delete set null;

create index if not exists project_deliverables_timeline_stage_id_idx
    on public.project_deliverables (timeline_stage_id);

comment on column public.project_deliverables.timeline_stage_id is
    'Etapa (bloque de trabajo) a la que pertenece el entregable.';

-- 1) Desde el bloque (phase) ya vinculado
update public.project_deliverables d
set timeline_stage_id = ph.timeline_stage_id
from public.project_phases ph
where d.phase_id = ph.id
  and d.timeline_stage_id is null
  and ph.timeline_stage_id is not null;

-- 2) Restantes: primera etapa del mismo proyecto
update public.project_deliverables d
set timeline_stage_id = s.id
from lateral (
    select ts.id
    from public.project_timeline_stages ts
    where ts.project_id = d.project_id
    order by ts.order_index, ts.created_at
    limit 1
) s
where d.timeline_stage_id is null;

-- Progreso de etapa = % tareas completadas SOLO de esa etapa
create or replace function public.recalculate_stage_progress(p_stage_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_total integer;
    v_done integer;
    v_percent integer;
begin
    if p_stage_id is null then
        return;
    end if;

    select count(*),
           count(*) filter (where t.status in ('completed', 'finished', 'approved'))
        into v_total, v_done
        from public.project_tasks t
        join public.project_sections s on s.id = t.section_id
        join public.project_phases ph on ph.id = s.phase_id
        where ph.timeline_stage_id = p_stage_id;

    v_percent := case when v_total = 0 then 0 else round((v_done::numeric / v_total) * 100) end;

    update public.project_timeline_stages
        set progress_percent = v_percent,
            status = case
                when v_total = 0 then status
                when v_done = v_total then 'finished'::public.progress_status
                when v_done > 0 then 'in_progress'::public.progress_status
                else 'pending'::public.progress_status
            end
        where id = p_stage_id;
end;
$$;
