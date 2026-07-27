/* ==========================================================
   NEXA HUB — Servicio: Proyectos (motor PROYECTOS)
   ========================================================== */
import { supabase } from './supabaseClient.js';

const LIST_SELECT = `
    id, name, description, status, start_date, end_date,
    progress_percent, client_progress_percent, nexa_progress_percent,
    color_hex, archived_at, created_at, workspace_id, project_type_id, responsible_id,
    project_types ( id, name, slug, color_hex ),
    workspaces ( id, name, client_id, profiles:client_id ( id, full_name, email ) )
`;

/**
 * Lista proyectos. En el admin trae todos (según RLS); en el
 * portal del cliente, RLS ya filtra solo los suyos.
 */
export async function listProjects({ includeArchived = false } = {}) {
    let query = supabase.from('projects').select(LIST_SELECT).order('created_at', { ascending: false });
    if (!includeArchived) query = query.is('archived_at', null);
    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function listProjectsByWorkspace(workspaceId) {
    const { data, error } = await supabase
        .from('projects')
        .select(LIST_SELECT)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function getProject(projectId) {
    const { data, error } = await supabase
        .from('projects')
        .select(`${LIST_SELECT}, created_by`)
        .eq('id', projectId)
        .single();
    if (error) throw error;
    return data;
}

/**
 * Estructura completa: bloques > secciones > tareas (+ aprobación
 * si aplica), en orden. Usado por la vista de detalle (admin y
 * cliente).
 */
export async function getProjectStructure(projectId) {
    const { data: phases, error: phasesError } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });
    if (phasesError) throw phasesError;

    const phaseIds = phases.map((p) => p.id);
    let sections = [];
    if (phaseIds.length) {
        const { data, error } = await supabase
            .from('project_sections')
            .select('*')
            .in('phase_id', phaseIds)
            .order('order_index', { ascending: true });
        if (error) throw error;
        sections = data;
    }

    const sectionIds = sections.map((s) => s.id);
    let tasks = [];
    if (sectionIds.length) {
        const { data, error } = await supabase
            .from('project_tasks')
            .select('*, approvals ( id, decision, decided_at, decision_comment ), profiles:assignee_id ( id, full_name )')
            .in('section_id', sectionIds)
            .order('order_index', { ascending: true });
        if (error) throw error;
        tasks = data;
    }

    return phases.map((phase) => ({
        ...phase,
        sections: sections
            .filter((s) => s.phase_id === phase.id)
            .map((section) => ({
                ...section,
                tasks: tasks.filter((t) => t.section_id === section.id)
            }))
    }));
}

export async function createProject(payload) {
    const {
        workspace_id, name, description, project_type_id, start_date, end_date,
        color_hex, responsible_id, created_by
    } = payload;

    const { data, error } = await supabase
        .from('projects')
        .insert({
            workspace_id, name, description: description || null, project_type_id: project_type_id || null,
            start_date: start_date || null, end_date: end_date || null,
            color_hex: color_hex || null, responsible_id: responsible_id || null, created_by
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateProject(projectId, payload) {
    const { data, error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', projectId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function setProjectStatus(projectId, status) {
    return updateProject(projectId, { status });
}

export async function archiveProject(projectId) {
    return updateProject(projectId, { archived_at: new Date().toISOString() });
}

export async function restoreProject(projectId) {
    return updateProject(projectId, { archived_at: null });
}

export async function duplicateProject(sourceProjectId, newName) {
    const { data, error } = await supabase.rpc('duplicate_project', {
        p_source_project_id: sourceProjectId,
        p_new_name: newName
    });
    if (error) throw error;
    return data; // uuid del nuevo proyecto
}
