-- ==========================================================
-- NEXA HUB — 21. Resolución segura de nombres públicos (lote)
-- ==========================================================
-- profiles_select_own / profiles_admin_all impiden que un
-- cliente lea el perfil de un admin (o viceversa), lo cual es
-- correcto para email/teléfono. Pero comentarios y tareas
-- necesitan mostrar el NOMBRE de cualquier autor/responsable
-- sin exponer el resto de sus datos. Esta función expone
-- únicamente id/full_name/avatar_url/role (dato no sensible,
-- usado solo para distinguir "NEXA" vs "Cliente" en la UI).
-- ==========================================================

create function public.get_public_profiles(profile_ids uuid[])
returns table (id uuid, full_name text, avatar_url text, role public.user_role)
language sql
stable
security definer
set search_path = public
as $$
    select id, full_name, avatar_url, role
    from public.profiles
    where id = any(profile_ids);
$$;

grant execute on function public.get_public_profiles(uuid[]) to authenticated;
