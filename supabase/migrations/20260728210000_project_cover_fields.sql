-- ==========================================================
-- NEXA HUB — Portada del proyecto (cover)
-- ==========================================================
-- Campos por proyecto: logo, subtítulo de servicios y chips.
-- Nuevo estado "in_review" (En revisión) para el badge de portada.
-- Extiende get_public_profiles con job_title (equipo asignado).
-- Bucket Storage "project-logos" para logos por proyecto.
-- ==========================================================

do $$
begin
    alter type public.project_status add value 'in_review';
exception
    when duplicate_object then null;
end $$;

alter table public.projects
    add column if not exists logo_url text,
    add column if not exists cover_subtitle text,
    add column if not exists client_display_name text,
    add column if not exists services text[] not null default '{}';

comment on column public.projects.logo_url is
    'URL pública del logo de la portada del proyecto (bucket project-logos).';
comment on column public.projects.cover_subtitle is
    'Línea de servicios bajo el título (ej. Sitio web + Marketing Digital).';
comment on column public.projects.client_display_name is
    'Nombre de cliente mostrado en la portada (si es null, se usa el del workspace).';
comment on column public.projects.services is
    'Chips de servicios contratados mostrados en la portada.';

-- job_title ya existe en profiles; exponerlo en la RPC pública de nombres.
-- DROP + CREATE porque cambia el tipo de retorno (añade job_title).
drop function if exists public.get_public_profiles(uuid[]);

create function public.get_public_profiles(profile_ids uuid[])
returns table (
    id uuid,
    full_name text,
    avatar_url text,
    role public.user_role,
    job_title text
)
language sql
stable
security definer
set search_path = public
as $$
    select p.id, p.full_name, p.avatar_url, p.role, p.job_title
    from public.profiles p
    where p.id = any(profile_ids);
$$;

grant execute on function public.get_public_profiles(uuid[]) to authenticated;

insert into storage.buckets (id, name, public)
values ('project-logos', 'project-logos', true)
on conflict (id) do nothing;

drop policy if exists project_logos_storage_select on storage.objects;
drop policy if exists project_logos_storage_admin_all on storage.objects;

create policy project_logos_storage_select on storage.objects
    for select
    using (bucket_id = 'project-logos');

create policy project_logos_storage_admin_all on storage.objects
    for all
    using (bucket_id = 'project-logos' and public.is_admin())
    with check (bucket_id = 'project-logos' and public.is_admin());
