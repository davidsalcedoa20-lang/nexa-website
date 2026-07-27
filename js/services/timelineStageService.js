/* ==========================================================
   NEXA HUB — Servicio: Etapas de la Línea de Tiempo
   ==========================================================
   "project_timeline_stages": la capa por encima de los bloques
   (project_phases). Totalmente editable por el administrador:
   crear, renombrar, recolorear, reordenar y eliminar etapas.
   ========================================================== */
import { supabase } from './supabaseClient.js';

export async function listStages(projectId) {
    const { data, error } = await supabase
        .from('project_timeline_stages')
        .select('*, profiles:responsible_id ( id, full_name )')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });
    if (error) throw error;
    return data;
}

export async function createStage(payload) {
    const { project_id, name, description, color_hex, order_index, estimated_date, responsible_id } = payload;
    const { data, error } = await supabase
        .from('project_timeline_stages')
        .insert({
            project_id,
            name,
            description: description || null,
            color_hex: color_hex || '#2D8CFF',
            order_index: order_index ?? 0,
            estimated_date: estimated_date || null,
            responsible_id: responsible_id || null
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateStage(stageId, payload) {
    const { data, error } = await supabase
        .from('project_timeline_stages')
        .update(payload)
        .eq('id', stageId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteStage(stageId) {
    const { error } = await supabase.from('project_timeline_stages').delete().eq('id', stageId);
    if (error) throw error;
}

/** Reordena etapas en bloque (drag & drop): [{id, order_index}, ...] */
export async function reorderStages(orderedList) {
    for (const item of orderedList) {
        const { error } = await supabase
            .from('project_timeline_stages')
            .update({ order_index: item.order_index })
            .eq('id', item.id);
        if (error) throw error;
    }
}
