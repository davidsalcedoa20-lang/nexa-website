-- ==========================================================
-- NEXA HUB — Permitir updates de profiles con service_role
-- ==========================================================
-- Bug: manage-admin (Edge Function) usa la service_role key.
-- En esa sesión auth.uid() es null → is_admin() = false, y el
-- trigger restrict_profile_self_update bloqueaba cambios de
-- job_title / email / is_active / created_by al crear o editar
-- administradores ("No tienes permiso para modificar esos
-- campos del perfil"), dejando el usuario Auth huérfano.
--
-- También endurece: un cliente no puede cambiar
-- project_access_mode desde su propia fila.
-- ==========================================================

create or replace function public.restrict_profile_self_update()
returns trigger
language plpgsql
as $$
begin
    -- Edge Functions / Admin API ya autorizaron la operación.
    if auth.role() = 'service_role' then
        return new;
    end if;

    if public.is_admin() then
        -- Un admin editando SU propio perfil tampoco debería
        -- poder escalar/degradar su rol ni cambiar el email
        -- desde Configuración (el email vive en Auth).
        if new.id = auth.uid() then
            if new.role is distinct from old.role
                or new.email is distinct from old.email
                or new.is_active is distinct from old.is_active
                or new.created_by is distinct from old.created_by
            then
                raise exception 'No puedes modificar rol, correo o estado de cuenta desde Configuración.';
            end if;
        end if;
        return new;
    end if;

    if new.id is distinct from old.id
        or new.role is distinct from old.role
        or new.email is distinct from old.email
        or new.is_active is distinct from old.is_active
        or new.created_by is distinct from old.created_by
        or new.job_title is distinct from old.job_title
        or new.project_access_mode is distinct from old.project_access_mode
    then
        raise exception 'No tienes permiso para modificar esos campos del perfil.';
    end if;

    return new;
end;
$$;

-- Incluir job_title en el alta automática vía Auth metadata
-- (manage-admin lo envía en user_metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, role, full_name, email, job_title, created_by)
    values (
        new.id,
        coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'client'),
        coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
        new.email,
        nullif(trim(coalesce(new.raw_user_meta_data ->> 'job_title', '')), ''),
        nullif(new.raw_user_meta_data ->> 'created_by', '')::uuid
    );
    return new;
end;
$$;
