-- ==========================================================
-- NEXA HUB — 29. Crear proyecto SIEMPRE con su plantilla inicial
-- ==========================================================
-- "Nuevo Proyecto" ya no crea una fila vacía: crea el proyecto +
-- sus etapas iniciales (tomadas de project_types.default_stages,
-- o una plantilla genérica de 5 etapas si el tipo no define una).
-- Es la única vía recomendada para crear proyectos desde el admin.
-- ==========================================================

create function public.create_project_with_template(
    p_workspace_id uuid,
    p_name text,
    p_project_type_id uuid,
    p_description text,
    p_modality text,
    p_start_date date,
    p_end_date date,
    p_color_hex text,
    p_secondary_color_hex text,
    p_responsible_id uuid,
    p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project_id uuid;
    v_stages jsonb;
    v_stage jsonb;
    v_order integer := 0;
begin
    if not public.is_admin() then
        raise exception 'Solo un administrador puede crear proyectos.';
    end if;

    insert into public.projects (
        workspace_id, name, project_type_id, description, modality,
        start_date, end_date, color_hex, secondary_color_hex, responsible_id, created_by
    ) values (
        p_workspace_id, p_name, p_project_type_id, p_description, p_modality,
        p_start_date, p_end_date, p_color_hex, p_secondary_color_hex, p_responsible_id, p_created_by
    ) returning id into v_project_id;

    if p_project_type_id is not null then
        select default_stages into v_stages from public.project_types where id = p_project_type_id;
    end if;

    if v_stages is null or jsonb_array_length(v_stages) = 0 then
        v_stages := '[
            {"name":"Planeación","color_hex":"#2D8CFF"},
            {"name":"Desarrollo","color_hex":"#00C2A8"},
            {"name":"Producción","color_hex":"#8C52FF"},
            {"name":"Publicación","color_hex":"#FF8A3D"},
            {"name":"Cierre","color_hex":"#FF2D95"}
        ]'::jsonb;
    end if;

    for v_stage in select * from jsonb_array_elements(v_stages)
    loop
        insert into public.project_timeline_stages (project_id, name, color_hex, order_index)
        values (
            v_project_id,
            coalesce(v_stage->>'name', 'Etapa ' || (v_order + 1)),
            coalesce(v_stage->>'color_hex', '#2D8CFF'),
            v_order
        );
        v_order := v_order + 1;
    end loop;

    return v_project_id;
end;
$$;

comment on function public.create_project_with_template is
    'Crea un proyecto y su línea de tiempo inicial (etapas) según la plantilla del tipo de proyecto seleccionado, o una plantilla genérica de 5 etapas si no aplica. Nunca deja el proyecto sin estructura inicial.';
