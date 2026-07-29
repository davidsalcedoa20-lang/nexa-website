-- Permite que staff (admin/owner) gestione avatares de otros usuarios
-- (necesario para "Nuevo Administrador" / edición de foto).
drop policy if exists avatars_storage_admin_write on storage.objects;
create policy avatars_storage_admin_write on storage.objects
    for all
    using (bucket_id = 'avatars' and public.is_admin())
    with check (bucket_id = 'avatars' and public.is_admin());
