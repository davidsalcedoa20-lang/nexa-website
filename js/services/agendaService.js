/* ==========================================================
   NEXA HUB — Servicio: Mi Agenda (admin_tasks)
   ==========================================================
   Módulo independiente de project_tasks / Ruta NEXA.
   RLS garantiza que cada admin solo ve sus filas
   (admin_id = auth.uid()). Preparado para futura IA.
   ========================================================== */
import { supabase } from './supabaseClient.js';

const TASK_SELECT = `
    id, admin_id, title, description, project_id, status, priority,
    estimated_minutes, task_date, task_time, tags, position,
    created_at, updated_at,
    projects:project_id ( id, name, color_hex )
`;

export async function listMyAgendaTasks({ fromDate, toDate } = {}) {
    let query = supabase
        .from('admin_tasks')
        .select(TASK_SELECT)
        .order('task_date', { ascending: true })
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

    if (fromDate) query = query.gte('task_date', fromDate);
    if (toDate) query = query.lte('task_date', toDate);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function createAgendaTask(payload) {
    const {
        admin_id, title, description, project_id, status, priority,
        estimated_minutes, task_date, task_time, tags, position
    } = payload;

    const { data, error } = await supabase
        .from('admin_tasks')
        .insert({
            admin_id,
            title,
            description: description || null,
            project_id: project_id || null,
            status: status || 'pending',
            priority: priority || 'medium',
            estimated_minutes: estimated_minutes || null,
            task_date,
            task_time: task_time || null,
            tags: Array.isArray(tags) ? tags : [],
            position: position ?? 0
        })
        .select(TASK_SELECT)
        .single();
    if (error) throw error;
    return data;
}

export async function updateAgendaTask(taskId, payload) {
    const allowed = {};
    const keys = [
        'title', 'description', 'project_id', 'status', 'priority',
        'estimated_minutes', 'task_date', 'task_time', 'tags', 'position'
    ];
    keys.forEach((key) => {
        if (payload[key] !== undefined) allowed[key] = payload[key];
    });

    const { data, error } = await supabase
        .from('admin_tasks')
        .update(allowed)
        .eq('id', taskId)
        .select(TASK_SELECT)
        .single();
    if (error) throw error;
    return data;
}

export async function deleteAgendaTask(taskId) {
    const { error } = await supabase.from('admin_tasks').delete().eq('id', taskId);
    if (error) throw error;
}

export async function duplicateAgendaTask(task, adminId) {
    return createAgendaTask({
        admin_id: adminId,
        title: `${task.title} (copia)`,
        description: task.description,
        project_id: task.project_id,
        status: 'pending',
        priority: task.priority,
        estimated_minutes: task.estimated_minutes,
        task_date: task.task_date,
        task_time: task.task_time,
        tags: task.tags || [],
        position: (task.position ?? 0) + 1
    });
}

/**
 * Reordena las tareas de un día tras drag & drop.
 * @param {string} dateISO - YYYY-MM-DD
 * @param {string[]} orderedIds - ids en el nuevo orden
 * @param {object} [extraUpdates] - campos extra por id (p.ej. cambiar de día)
 */
export async function reorderAgendaDay(dateISO, orderedIds, extraById = {}) {
    const updates = orderedIds.map((id, index) => {
        const extra = extraById[id] || {};
        return updateAgendaTask(id, {
            task_date: dateISO,
            position: index,
            ...extra
        });
    });
    return Promise.all(updates);
}
