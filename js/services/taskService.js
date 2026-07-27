/* ==========================================================
   NEXA HUB — Servicio: Tareas y Aprobaciones
   ========================================================== */
import { supabase } from './supabaseClient.js';

export async function createTask(payload) {
    const {
        section_id, title, description, task_type, priority,
        assignee_id, due_date, order_index, created_by
    } = payload;

    const { data: task, error } = await supabase
        .from('project_tasks')
        .insert({
            section_id, title, description: description || null,
            task_type: task_type || 'nexa', priority: priority || 'medium',
            assignee_id: assignee_id || null, due_date: due_date || null,
            order_index: order_index ?? 0, created_by
        })
        .select()
        .single();
    if (error) throw error;

    if (task.task_type === 'approval') {
        const { error: approvalError } = await supabase
            .from('approvals')
            .insert({ task_id: task.id });
        if (approvalError) throw approvalError;
    }

    return task;
}

export async function updateTask(taskId, payload) {
    const { data, error } = await supabase
        .from('project_tasks')
        .update(payload)
        .eq('id', taskId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteTask(taskId) {
    const { error } = await supabase.from('project_tasks').delete().eq('id', taskId);
    if (error) throw error;
}

/** El cliente marca su propia tarea (task_type = client) como completada/en proceso. */
export async function setClientTaskStatus(taskId, status) {
    const { data, error } = await supabase
        .from('project_tasks')
        .update({ status })
        .eq('id', taskId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

/** Decisión del cliente sobre una aprobación. */
export async function decideApproval(approvalId, decision, comment, userId) {
    const { data, error } = await supabase
        .from('approvals')
        .update({
            decision,
            decision_comment: comment || null,
            decided_by: userId,
            decided_at: new Date().toISOString()
        })
        .eq('id', approvalId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function listPendingApprovalsForProject(projectId) {
    const { data, error } = await supabase
        .from('approvals')
        .select(`
            id, decision, decision_comment, decided_at,
            project_tasks!inner (
                id, title, description, section_id,
                project_sections!inner ( id, phase_id, project_phases!inner ( id, project_id, name ) )
            )
        `)
        .eq('project_tasks.project_sections.project_phases.project_id', projectId)
        .eq('decision', 'pending');
    if (error) throw error;
    return data;
}
