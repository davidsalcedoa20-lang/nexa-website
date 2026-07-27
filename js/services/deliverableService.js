/* ==========================================================
   NEXA HUB — Servicio: Entregables
   ========================================================== */
import { supabase } from './supabaseClient.js';

export async function listProjectDeliverables(projectId) {
    const { data, error } = await supabase
        .from('project_deliverables')
        .select('*, project_files:file_id ( id, file_name, storage_path )')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function createDeliverable(payload) {
    const { project_id, phase_id, title, description, file_id } = payload;
    const { data, error } = await supabase
        .from('project_deliverables')
        .insert({ project_id, phase_id: phase_id || null, title, description: description || null, file_id: file_id || null })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function markDeliverableDelivered(deliverableId, deliveredBy) {
    const { data, error } = await supabase
        .from('project_deliverables')
        .update({ status: 'delivered', delivered_by: deliveredBy, delivered_at: new Date().toISOString() })
        .eq('id', deliverableId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

/** Decisión del cliente sobre un entregable ya enviado. */
export async function decideDeliverable(deliverableId, status) {
    const { data, error } = await supabase
        .from('project_deliverables')
        .update({ status })
        .eq('id', deliverableId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

/** Edición libre del administrador (título, descripción, estado, etc.). */
export async function updateDeliverable(deliverableId, payload) {
    const { data, error } = await supabase
        .from('project_deliverables')
        .update(payload)
        .eq('id', deliverableId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteDeliverable(deliverableId) {
    const { error } = await supabase.from('project_deliverables').delete().eq('id', deliverableId);
    if (error) throw error;
}
