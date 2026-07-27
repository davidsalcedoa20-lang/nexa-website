/* ==========================================================
   NEXA HUB — Servicio: Entregables
   ==========================================================
   Decisión de arquitectura: los entregables son registros de
   texto + datos estructurados (título, descripción, estado,
   fechas, observaciones) y opcionalmente un ENLACE EXTERNO
   (Drive, Figma, Canva, Dropbox, etc.). NEXA Hub no almacena
   archivos en Supabase Storage, por lo que este servicio ya NO
   usa "file_id" / "project_files" (la columna file_id se deja
   intacta en la base de datos por compatibilidad, pero no se
   lee ni se escribe desde aquí).
   ========================================================== */
import { supabase } from './supabaseClient.js';

export async function listProjectDeliverables(projectId) {
    const { data, error } = await supabase
        .from('project_deliverables')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function createDeliverable(payload) {
    const { project_id, phase_id, title, description, status, due_date, delivered_at, notes, external_link } = payload;
    const { data, error } = await supabase
        .from('project_deliverables')
        .insert({
            project_id,
            phase_id: phase_id || null,
            title,
            description: description || null,
            status: status || 'draft',
            due_date: due_date || null,
            delivered_at: delivered_at || null,
            notes: notes || null,
            external_link: external_link || null
        })
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

/** Edición libre del administrador (título, descripción, estado, fechas, observaciones, enlace, etc.). */
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
