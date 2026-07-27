/* ==========================================================
   NEXA HUB — Servicio: Bloques (fases) y Secciones
   ========================================================== */
import { supabase } from './supabaseClient.js';

export async function createPhase(payload) {
    const { project_id, name, description, order_index, duration_days } = payload;
    const { data, error } = await supabase
        .from('project_phases')
        .insert({ project_id, name, description: description || null, order_index: order_index ?? 0, duration_days: duration_days || null })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updatePhase(phaseId, payload) {
    const { data, error } = await supabase
        .from('project_phases')
        .update(payload)
        .eq('id', phaseId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deletePhase(phaseId) {
    const { error } = await supabase.from('project_phases').delete().eq('id', phaseId);
    if (error) throw error;
}

export async function createSection(payload) {
    const { phase_id, name, order_index } = payload;
    const { data, error } = await supabase
        .from('project_sections')
        .insert({ phase_id, name, order_index: order_index ?? 0 })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateSection(sectionId, payload) {
    const { data, error } = await supabase
        .from('project_sections')
        .update(payload)
        .eq('id', sectionId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteSection(sectionId) {
    const { error } = await supabase.from('project_sections').delete().eq('id', sectionId);
    if (error) throw error;
}

/**
 * Dependencias inteligentes de un bloque (ver project_dependencies).
 */
export async function listPhaseDependencies(phaseId) {
    const { data, error } = await supabase
        .from('project_dependencies')
        .select(`
            id, depends_on_phase_id, depends_on_task_id, depends_on_deliverable_id,
            depends_on_phase:depends_on_phase_id ( id, name, status ),
            depends_on_task:depends_on_task_id ( id, title, status ),
            depends_on_deliverable:depends_on_deliverable_id ( id, title, status )
        `)
        .eq('phase_id', phaseId);
    if (error) throw error;
    return data;
}

export async function addPhaseDependency(phaseId, target) {
    // target: { depends_on_phase_id } | { depends_on_task_id } | { depends_on_deliverable_id }
    const { data, error } = await supabase
        .from('project_dependencies')
        .insert({ phase_id: phaseId, ...target })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function removePhaseDependency(dependencyId) {
    const { error } = await supabase.from('project_dependencies').delete().eq('id', dependencyId);
    if (error) throw error;
}
