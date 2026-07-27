-- ==========================================================
-- NEXA HUB — 06. Funciones y triggers
-- ==========================================================
-- Ver docs/database-design.md sección 7.
-- ==========================================================

-- ----------------------------------------------------------
-- 6.1 handle_new_user()
-- Crea automáticamente la fila en public.profiles cuando el
-- admin crea un usuario nuevo en auth.users (Supabase Admin
-- API), leyendo role/full_name desde user_metadata.
-- ----------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, role, full_name, email, created_by)
    values (
        new.id,
        coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'client'),
        coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
        new.email,
        nullif(new.raw_user_meta_data ->> 'created_by', '')::uuid
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ----------------------------------------------------------
-- 6.2 set_updated_at()
-- Mantiene la columna updated_at actualizada en cada UPDATE.
-- ----------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.workspaces
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.projects
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.methodology_stages
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.methodology_blocks
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_stages
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.project_blocks
    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------
-- 6.3 validate_client_role()
-- Impide asignar un workspace a un perfil que no sea "client".
-- ----------------------------------------------------------
create function public.validate_client_role()
returns trigger
language plpgsql
as $$
declare
    target_role public.user_role;
begin
    select role into target_role from public.profiles where id = new.client_id;

    if target_role is null then
        raise exception 'El perfil client_id % no existe.', new.client_id;
    end if;

    if target_role <> 'client' then
        raise exception 'El perfil client_id % debe tener role = client.', new.client_id;
    end if;

    return new;
end;
$$;

create trigger validate_client_role
    before insert or update of client_id on public.workspaces
    for each row execute function public.validate_client_role();

-- ----------------------------------------------------------
-- 6.4 instantiate_project_methodology()
-- Copia automáticamente todas las etapas/bloques oficiales
-- activos de la Ruta NEXA hacia project_stages/project_blocks
-- cuando se crea un proyecto nuevo.
-- ----------------------------------------------------------
create function public.instantiate_project_methodology()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    stage_record record;
    new_project_stage_id uuid;
begin
    for stage_record in
        select id, name, order_index
        from public.methodology_stages
        where is_active = true
        order by order_index
    loop
        insert into public.project_stages (project_id, methodology_stage_id, name, order_index)
        values (new.id, stage_record.id, stage_record.name, stage_record.order_index)
        returning id into new_project_stage_id;

        insert into public.project_blocks (project_stage_id, methodology_block_id, name, order_index)
        select new_project_stage_id, mb.id, mb.name, mb.order_index
        from public.methodology_blocks mb
        where mb.stage_id = stage_record.id
          and mb.is_active = true
        order by mb.order_index;
    end loop;

    return new;
end;
$$;

create trigger instantiate_project_methodology
    after insert on public.projects
    for each row execute function public.instantiate_project_methodology();
