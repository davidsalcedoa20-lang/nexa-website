/* ==========================================================
   NEXA HUB — Servicio Empleados (aislado del módulo Clientes)
   ========================================================== */
import { supabase } from '../admin/supabase/client.js';

const ROLE_LABELS_FALLBACK = {
    editor: 'Editor',
    designer: 'Diseñador',
    photographer: 'Fotógrafo',
    community: 'Community Manager',
    admin_ops: 'Administrador'
};

function mapEmployee(row) {
    if (!row) return row;
    const roleLabel = row.employee_roles?.label || ROLE_LABELS_FALLBACK[row.role_key] || row.role_key;
    return {
        ...row,
        employee_roles: row.employee_roles || { key: row.role_key, label: roleLabel }
    };
}

export async function listEmployees() {
    const { data, error } = await supabase
        .from('employees')
        .select('*, profiles:profile_id ( id, email, is_active )')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapEmployee);
}

export async function getEmployee(employeeId) {
    const { data, error } = await supabase
        .from('employees')
        .select('*, profiles:profile_id ( id, email, is_active, full_name )')
        .eq('id', employeeId)
        .maybeSingle();
    if (error) throw error;
    return mapEmployee(data);
}

export async function getMyEmployee() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
        .from('employees')
        .select(`*, employee_roles ( key, label ), profiles:profile_id ( id, email, full_name )`)
        .eq('profile_id', user.id)
        .maybeSingle();
    if (error) throw error;
    return data;
}

export async function createEmployee(payload) {
    // No mandar dataURL enormes a la Edge Function
    const body = { ...payload };
    if (body.photo_url && String(body.photo_url).length > 180000) {
        body.photo_url = null;
    }

    const { data, error } = await supabase.functions.invoke('create-employee', { body });

    if (error) {
        let serverMessage = data && data.error;
        try {
            // A veces el body de error viene en error.context
            if (!serverMessage && error.context && typeof error.context.json === 'function') {
                const parsed = await error.context.json();
                serverMessage = parsed?.error;
            }
        } catch (_) { /* ignore */ }
        throw new Error(serverMessage || error.message || 'No se pudo crear el empleado.');
    }

    if (data?.error) throw new Error(data.error);
    return data;
}

export async function updateEmployeeRow(employeeId, patch) {
    const { data, error } = await supabase
        .from('employees')
        .update(patch)
        .eq('id', employeeId)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function getEmployeeStats(employeeId) {
    const { data: projects, error: pErr } = await supabase
        .from('employee_projects')
        .select('id')
        .eq('employee_id', employeeId);
    if (pErr) throw pErr;
    const ids = (projects || []).map((p) => p.id);
    if (!ids.length) {
        return { pending: 0, delivered: 0, lastDelivery: null, productivity: 0 };
    }
    const { data: tasks, error: tErr } = await supabase
        .from('employee_tasks')
        .select('status, delivered_at, updated_at')
        .in('project_id', ids);
    if (tErr) throw tErr;
    const list = tasks || [];
    const pending = list.filter((t) => t.status !== 'entregado').length;
    const delivered = list.filter((t) => t.status === 'entregado').length;
    const total = list.length || 1;
    const last = list
        .filter((t) => t.delivered_at)
        .sort((a, b) => new Date(b.delivered_at) - new Date(a.delivered_at))[0];
    return {
        pending,
        delivered,
        lastDelivery: last?.delivered_at || null,
        productivity: Math.round((delivered / total) * 100)
    };
}

export async function listEmployeeProjects(employeeId) {
    const { data, error } = await supabase
        .from('employee_projects')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function createEmployeeProject(payload) {
    const { data, error } = await supabase
        .from('employee_projects')
        .insert(payload)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function updateEmployeeProject(projectId, patch) {
    const { data, error } = await supabase
        .from('employee_projects')
        .update(patch)
        .eq('id', projectId)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function listProjectTasks(projectId) {
    const { data, error } = await supabase
        .from('employee_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
        .order('number', { ascending: true });
    if (error) throw error;
    return data || [];
}

/** Todas las tareas del empleado autenticado (todos sus proyectos). */
export async function listMyEmployeeTasks() {
    const me = await getMyEmployee();
    if (!me) return [];
    const projects = await listEmployeeProjects(me.id);
    if (!projects.length) return [];
    const projectIds = projects.map((p) => p.id);
    const { data, error } = await supabase
        .from('employee_tasks')
        .select('*, employee_projects!inner ( id, title, drive_url, employee_id )')
        .in('project_id', projectIds)
        .order('delivery_date', { ascending: true })
        .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => ({
        ...row,
        project_title: row.employee_projects?.title || '',
        project_drive_url: row.employee_projects?.drive_url || null,
        folder_url: row.drive_url || row.employee_projects?.drive_url || null
    }));
}

export async function createProjectTask(payload) {
    const { data, error } = await supabase
        .from('employee_tasks')
        .insert(payload)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function updateProjectTask(taskId, patch) {
    const { data, error } = await supabase
        .from('employee_tasks')
        .update(patch)
        .eq('id', taskId)
        .select('*')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteProjectTask(taskId) {
    const { error } = await supabase.from('employee_tasks').delete().eq('id', taskId);
    if (error) throw error;
}

export async function reorderProjectTasks(orderedIds) {
    await Promise.all(orderedIds.map((id, index) =>
        supabase.from('employee_tasks').update({ sort_order: index }).eq('id', id)
    ));
}

export async function listTaskComments(taskId) {
    const { data, error } = await supabase
        .from('employee_comments')
        .select('*, profiles:author_id ( full_name, role )')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function addTaskComment(taskId, body) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sin sesión');
    const { data, error } = await supabase
        .from('employee_comments')
        .insert({ task_id: taskId, author_id: user.id, body })
        .select('*, profiles:author_id ( full_name, role )')
        .single();
    if (error) throw error;
    return data;
}

export async function listDeliveriesCalendar({ from, to, employeeId = null } = {}) {
    let q = supabase
        .from('employee_tasks')
        .select(`
            id, name, priority, status, delivery_date, number, project_id,
            employee_projects!inner ( id, title, employee_id,
                employees ( id, first_name, last_name, color_hex )
            )
        `)
        .not('delivery_date', 'is', null)
        .gte('delivery_date', from)
        .lte('delivery_date', to)
        .order('delivery_date', { ascending: true });

    if (employeeId) {
        q = q.eq('employee_projects.employee_id', employeeId);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
}

export function subscribeEmployeeChannel(name, table, filter, onChange) {
    const channel = supabase
        .channel(name)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table,
            ...(filter ? { filter } : {})
        }, onChange)
        .subscribe();
    return () => { supabase.removeChannel(channel); };
}
