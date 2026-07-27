/* ==========================================================
   NEXA HUB — Servicio: Archivos del proyecto (Supabase Storage)
   ==========================================================
   Convención de ruta en el bucket "project-files":
       {project_id}/{folder}/{timestamp}_{file_name}
   El primer segmento SIEMPRE debe ser el project_id (así lo
   validan las políticas RLS de storage.objects).
   ========================================================== */
import { supabase } from './supabaseClient.js';

const BUCKET = 'project-files';

export async function listProjectFiles(projectId) {
    const { data, error } = await supabase
        .from('project_files')
        .select('*, profiles:uploaded_by ( id, full_name )')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

/** Archivos adjuntos a una tarea puntual (para el modal de detalle de tarea). */
export async function listTaskFiles(taskId) {
    const { data, error } = await supabase
        .from('project_files')
        .select('*, profiles:uploaded_by ( id, full_name )')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function uploadProjectFile({ projectId, taskId = null, folder = 'General', file, uploadedBy, visibleToClient = true }) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${projectId}/${folder}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
    });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
        .from('project_files')
        .insert({
            project_id: projectId,
            task_id: taskId || null,
            folder,
            file_name: file.name,
            storage_path: storagePath,
            mime_type: file.type || null,
            size_bytes: file.size || null,
            uploaded_by: uploadedBy,
            visible_to_client: visibleToClient
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getFileSignedUrl(storagePath, expiresInSeconds = 3600) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
}

export async function deleteProjectFile(fileRow) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([fileRow.storage_path]);
    if (storageError) throw storageError;

    const { error } = await supabase.from('project_files').delete().eq('id', fileRow.id);
    if (error) throw error;
}
