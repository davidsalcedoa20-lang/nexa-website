-- ==========================================================
-- NEXA HUB — 20. Storage RLS para el bucket "project-files"
-- ==========================================================
-- Convención de rutas: {project_id}/{folder}/{file_name}
-- El primer segmento de la ruta (storage.foldername) es SIEMPRE
-- el project_id, lo que permite validar pertenencia con RLS.
-- ==========================================================

create policy project_files_storage_admin_all on storage.objects
    for all
    using (bucket_id = 'project-files' and public.is_admin())
    with check (bucket_id = 'project-files' and public.is_admin());

create policy project_files_storage_select_own on storage.objects
    for select
    using (
        bucket_id = 'project-files'
        and public.is_own_project((storage.foldername(name))[1]::uuid)
    );

create policy project_files_storage_insert_own on storage.objects
    for insert
    with check (
        bucket_id = 'project-files'
        and public.is_own_project((storage.foldername(name))[1]::uuid)
    );
