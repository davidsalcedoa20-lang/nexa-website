/* ==========================================================
   NEXA HUB — Servicio: Proyectos (motor PROYECTOS)
   ========================================================== */
import { supabase } from './supabaseClient.js';

const LIST_SELECT = `
    id, name, description, status, start_date, end_date, modality,
    progress_percent, client_progress_percent, nexa_progress_percent,
    color_hex, secondary_color_hex, archived_at, created_at, workspace_id, project_type_id, responsible_id,
    logo_url, cover_subtitle, client_display_name, services,
    project_types ( id, name, slug, color_hex ),
    workspaces ( id, name, client_id, profiles:client_id ( id, full_name, email ) ),
    responsible:responsible_id ( id, full_name )
`;

const LOGO_BUCKET = 'project-logos';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

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
 * Estructura completa: etapas (línea de tiempo) > bloques >
 * secciones > tareas (+ aprobación si aplica), en orden. Usado
 * por la vista de detalle (admin y cliente).
 *
 * Devuelve { stages, unassignedPhases }: "stages" trae cada
 * etapa con sus bloques anidados; "unassignedPhases" son bloques
 * legacy sin etapa asignada (no debería pasar en proyectos nuevos,
 * pero se muestran igual para no perder información).
 */
export async function getProjectStructure(projectId) {
    const { data: stages, error: stagesError } = await supabase
        .from('project_timeline_stages')
        .select('*, profiles:responsible_id ( id, full_name )')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true });
    if (stagesError) throw stagesError;

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
            .select('*, approvals ( id, decision, decided_at, decision_comment ), profiles:assignee_id ( id, full_name, role )')
            .in('section_id', sectionIds)
            .order('order_index', { ascending: true });
        if (error) throw error;
        tasks = data;
    }

    // RLS de profiles impide que un cliente lea el perfil de un admin.
    // get_public_profiles expone id/full_name/avatar_url/role/job_title.
    tasks = await enrichTaskAssignees(tasks);

    const phasesWithChildren = phases.map((phase) => ({
        ...phase,
        sections: sections
            .filter((s) => s.phase_id === phase.id)
            .map((section) => ({
                ...section,
                tasks: tasks.filter((t) => t.section_id === section.id)
            }))
    }));

    const stagesWithPhases = stages.map((stage) => ({
        ...stage,
        phases: phasesWithChildren.filter((p) => p.timeline_stage_id === stage.id)
    }));

    const unassignedPhases = phasesWithChildren.filter((p) => !p.timeline_stage_id);

    return { stages: stagesWithPhases, unassignedPhases, allTasks: tasks, allPhases: phasesWithChildren };
}

async function enrichTaskAssignees(tasks) {
    const assigneeIds = [...new Set((tasks || []).map((t) => t.assignee_id).filter(Boolean))];
    if (!assigneeIds.length) return tasks || [];

    const { data: profiles, error } = await supabase.rpc('get_public_profiles', { profile_ids: assigneeIds });
    if (error) {
        console.warn('[projectService] No se pudieron resolver nombres de responsables:', error.message);
        return tasks;
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    return tasks.map((task) => ({
        ...task,
        profiles: profileMap.get(task.assignee_id) || task.profiles || null
    }));
}

/**
 * Crea un proyecto NUEVO. Nunca queda vacío: la función RPC
 * "create_project_with_template" crea automáticamente la línea
 * de tiempo inicial (etapas) según el tipo de proyecto elegido
 * (o una plantilla genérica de 5 etapas si no aplica).
 * Devuelve el id del proyecto recién creado.
 */
export async function createProject(payload) {
    const {
        workspace_id, name, description, project_type_id, modality, start_date, end_date,
        color_hex, secondary_color_hex, responsible_id, created_by
    } = payload;

    const { data: newProjectId, error } = await supabase.rpc('create_project_with_template', {
        p_workspace_id: workspace_id,
        p_name: name,
        p_project_type_id: project_type_id || null,
        p_description: description || null,
        p_modality: modality || null,
        p_start_date: start_date || null,
        p_end_date: end_date || null,
        p_color_hex: color_hex || null,
        p_secondary_color_hex: secondary_color_hex || null,
        p_responsible_id: responsible_id || null,
        p_created_by: created_by
    });
    if (error) throw error;

    return getProject(newProjectId);
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

/**
 * Sube o reemplaza el logo de la portada del proyecto.
 * Guarda la URL pública en projects.logo_url.
 */
export async function uploadProjectLogo(projectId, file) {
    if (!file) throw new Error('Selecciona una imagen.');
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
        throw new Error('Formato no permitido. Usa JPG, PNG, WEBP, GIF o SVG.');
    }
    if (file.size > MAX_LOGO_BYTES) {
        throw new Error('El logo no puede superar 2 MB.');
    }

    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${projectId}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;

    const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
    const logoUrl = pub?.publicUrl;
    if (!logoUrl) throw new Error('No se pudo obtener la URL del logo.');

    return updateProject(projectId, { logo_url: logoUrl });
}

export async function clearProjectLogo(projectId) {
    return updateProject(projectId, { logo_url: null });
}
