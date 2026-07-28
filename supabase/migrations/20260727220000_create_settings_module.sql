-- ==========================================================
-- NEXA HUB — 26. Módulo Configuración (perfil + avatares)
-- ==========================================================
-- Extiende profiles con cargo y preferencias básicas.
-- Permite que cada usuario actualice SU propio perfil
-- (sin poder tocar role/email/is_active).
-- Permite al cliente actualizar el nombre de su workspace
-- (empresa). Crea el bucket "avatars" para fotos de perfil
-- (público: la URL se guarda en profiles.avatar_url).
-- ==========================================================

alter table public.profiles
    add column if not exists job_title text,
    add column if not exists preference_theme text not null default 'nexa',
    add column if not exists preference_language text not null default 'es';

comment on column public.profiles.job_title is
    'Cargo del administrador (ej. Director creativo). Vacío para clientes.';
comment on column public.profiles.preference_theme is
    'Preferencia de tema visual. v1.0: siempre "nexa".';
comment on column public.profiles.preference_language is
    'Preferencia de idioma. v1.0: siempre "es".';

-- ----------------------------------------------------------
-- El usuario autenticado puede actualizar SU propia fila.
-- (Antes solo el admin podía escribir en profiles.)
-- ----------------------------------------------------------
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_update_own on public.profiles
    for update
    using (id = auth.uid())
    with check (id = auth.uid());

-- Impide que un no-admin cambie campos sensibles al editar su perfil.
create or replace function public.restrict_profile_self_update()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        -- Un admin editando SU propio perfil tampoco debería
        -- poder escalar/degradar su rol ni cambiar el email
        -- desde esta pantalla (el email vive en Auth).
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
    then
        raise exception 'No tienes permiso para modificar esos campos del perfil.';
    end if;

    return new;
end;
$$;

drop trigger if exists restrict_profile_self_update on public.profiles;

create trigger restrict_profile_self_update
    before update on public.profiles
    for each row execute function public.restrict_profile_self_update();

-- ----------------------------------------------------------
-- El cliente puede actualizar el nombre de SU workspace (empresa).
-- ----------------------------------------------------------
drop policy if exists workspaces_update_own on public.workspaces;

create policy workspaces_update_own on public.workspaces
    for update
    using (client_id = auth.uid())
    with check (client_id = auth.uid());

create or replace function public.restrict_workspace_client_update()
returns trigger
language plpgsql
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    -- El cliente solo puede cambiar el nombre (empresa).
    if new.id is distinct from old.id
        or new.client_id is distinct from old.client_id
        or new.status is distinct from old.status
        or new.created_by is distinct from old.created_by
        or new.city is distinct from old.city
        or new.notes is distinct from old.notes
    then
        raise exception 'Solo puedes actualizar el nombre de tu empresa.';
    end if;

    return new;
end;
$$;

drop trigger if exists restrict_workspace_client_update on public.workspaces;

create trigger restrict_workspace_client_update
    before update on public.workspaces
    for each row execute function public.restrict_workspace_client_update();

-- ----------------------------------------------------------
-- Bucket de avatares (público). Ruta: {user_id}/avatar.ext
-- ==========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_storage_select on storage.objects;
drop policy if exists avatars_storage_insert_own on storage.objects;
drop policy if exists avatars_storage_update_own on storage.objects;
drop policy if exists avatars_storage_delete_own on storage.objects;

create policy avatars_storage_select on storage.objects
    for select
    using (bucket_id = 'avatars');

create policy avatars_storage_insert_own on storage.objects
    for insert
    with check (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy avatars_storage_update_own on storage.objects
    for update
    using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
    )
    with check (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy avatars_storage_delete_own on storage.objects
    for delete
    using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
    );
