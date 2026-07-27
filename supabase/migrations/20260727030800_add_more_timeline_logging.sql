-- ==========================================================
-- NEXA HUB — 31. Cronología: más eventos automáticos
-- ==========================================================
-- Completa el registro automático pedido por la plantilla:
-- archivos subidos, comentarios, entregables creados, bloques
-- creados y etapas creadas.
-- ==========================================================

create function public.log_file_uploaded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.project_timeline_events (project_id, event_type, description, actor_id)
    values (new.project_id, 'file_uploaded', 'Se subió el archivo "' || new.file_name || '".', new.uploaded_by);
    return new;
end;
$$;

create trigger log_file_uploaded
    after insert on public.project_files
    for each row execute function public.log_file_uploaded();

create function public.log_comment_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_author_name text;
begin
    select full_name into v_author_name from public.profiles where id = new.author_id;

    insert into public.project_timeline_events (project_id, event_type, description, actor_id)
    values (
        new.project_id,
        'comment_added',
        coalesce(v_author_name, 'Alguien') || ' comentó en el proyecto.',
        new.author_id
    );
    return new;
end;
$$;

create trigger log_comment_added
    after insert on public.project_comments
    for each row execute function public.log_comment_added();

create function public.log_deliverable_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.project_timeline_events (project_id, event_type, description)
    values (new.project_id, 'deliverable_created', 'Se agregó el entregable "' || new.title || '".');
    return new;
end;
$$;

create trigger log_deliverable_created
    after insert on public.project_deliverables
    for each row execute function public.log_deliverable_created();

create function public.log_phase_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.project_timeline_events (project_id, event_type, description)
    values (new.project_id, 'phase_created', 'Se creó el bloque "' || new.name || '".');
    return new;
end;
$$;

create trigger log_phase_created
    after insert on public.project_phases
    for each row execute function public.log_phase_created();

create function public.log_stage_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.project_timeline_events (project_id, event_type, description)
    values (new.project_id, 'stage_created', 'Se creó la etapa "' || new.name || '".');
    return new;
end;
$$;

create trigger log_stage_created
    after insert on public.project_timeline_stages
    for each row execute function public.log_stage_created();
