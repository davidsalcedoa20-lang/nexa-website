/* ==========================================================
   NEXA HUB — Servicio: Dashboard Administrativo (métricas reales)
   ==========================================================
   Agrega datos YA existentes en Supabase (workspaces, projects,
   project_tasks) para las tarjetas de estadísticas y la tabla
   "Clientes recientes" de admin/index.html. No crea tablas ni
   duplica datos: todo se calcula al vuelo con consultas reales.
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import { listClients } from './clientService.js';
import { listProjectsByWorkspace } from '../../services/projectService.js';

const OPEN_TASK_STATUSES = ['pending', 'in_progress', 'waiting_approval'];

/** Total de clientes (1 workspace = 1 cliente) + cuántos se crearon este mes. */
async function getClientsStat() {
    const { count: total, error: totalError } = await supabase
        .from('workspaces')
        .select('id', { count: 'exact', head: true });
    if (totalError) throw totalError;

    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const { count: newThisMonth, error: newError } = await supabase
        .from('workspaces')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', firstDayOfMonth.toISOString());
    if (newError) throw newError;

    return { total: total || 0, newThisMonth: newThisMonth || 0 };
}

/** Proyectos activos (status = in_progress, no archivados) + cuántos están "waiting_approval" en alguna fase. */
async function getActiveProjectsStat() {
    const { count: active, error } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in_progress')
        .is('archived_at', null);
    if (error) throw error;

    const { count: inReview, error: reviewError } = await supabase
        .from('project_phases')
        .select('id, projects!inner ( id, status, archived_at )', { count: 'exact', head: true })
        .eq('status', 'waiting_approval')
        .eq('projects.status', 'in_progress')
        .is('projects.archived_at', null);
    if (reviewError) throw reviewError;

    return { active: active || 0, inReview: inReview || 0 };
}

/** Tareas pendientes (pending / in_progress / waiting_approval) de proyectos activos. */
async function getPendingTasksStat() {
    const { count: total, error } = await supabase
        .from('project_tasks')
        .select(`
            id,
            project_sections!inner (
                id,
                project_phases!inner (
                    id,
                    projects!inner ( id, status, archived_at )
                )
            )
        `, { count: 'exact', head: true })
        .in('status', OPEN_TASK_STATUSES)
        .eq('project_sections.project_phases.projects.status', 'in_progress')
        .is('project_sections.project_phases.projects.archived_at', null);
    if (error) throw error;

    const { count: urgent, error: urgentError } = await supabase
        .from('project_tasks')
        .select(`
            id,
            project_sections!inner (
                id,
                project_phases!inner (
                    id,
                    projects!inner ( id, status, archived_at )
                )
            )
        `, { count: 'exact', head: true })
        .in('status', OPEN_TASK_STATUSES)
        .eq('priority', 'urgent')
        .eq('project_sections.project_phases.projects.status', 'in_progress')
        .is('project_sections.project_phases.projects.archived_at', null);
    if (urgentError) throw urgentError;

    return { total: total || 0, urgent: urgent || 0 };
}

/** Próxima tarea (de un proyecto activo) con fecha límite más cercana desde hoy. */
async function getNextDueItem() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
        .from('project_tasks')
        .select(`
            id, title, due_date, status,
            project_sections!inner (
                id,
                project_phases!inner (
                    id,
                    projects!inner ( id, name, status, archived_at )
                )
            )
        `)
        .not('due_date', 'is', null)
        .gte('due_date', today)
        .in('status', OPEN_TASK_STATUSES)
        .eq('project_sections.project_phases.projects.status', 'in_progress')
        .is('project_sections.project_phases.projects.archived_at', null)
        .order('due_date', { ascending: true })
        .limit(1);
    if (error) throw error;

    const item = data && data[0];
    if (!item) return null;

    const dueDate = new Date(item.due_date);
    const now = new Date();
    dueDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((dueDate - now) / 86400000);

    return {
        taskTitle: item.title,
        projectName: item.project_sections?.project_phases?.projects?.name || 'Proyecto',
        dueDate: item.due_date,
        daysLeft
    };
}

/**
 * Trae todas las métricas del Dashboard en una sola llamada.
 * Devuelve valores en 0 / null razonables si algo falla (nunca
 * lanza para no romper el render de toda la página).
 */
export async function getDashboardStats() {
    const [clients, projects, tasks, nextDue] = await Promise.all([
        getClientsStat().catch((e) => { console.error('[dashboardService] clients:', e.message); return { total: 0, newThisMonth: 0 }; }),
        getActiveProjectsStat().catch((e) => { console.error('[dashboardService] projects:', e.message); return { active: 0, inReview: 0 }; }),
        getPendingTasksStat().catch((e) => { console.error('[dashboardService] tasks:', e.message); return { total: 0, urgent: 0 }; }),
        getNextDueItem().catch((e) => { console.error('[dashboardService] nextDue:', e.message); return null; })
    ]);
    return { clients, projects, tasks, nextDue };
}

/**
 * Últimos N clientes registrados, con su proyecto más reciente
 * (nombre + estado + fecha de inicio) para la tabla "Clientes
 * recientes" del Dashboard. Un cliente puede tener 0 o varios
 * proyectos: se muestra siempre el más reciente.
 */
export async function listRecentClientsWithProject(limit = 5) {
    const clients = await listClients();
    const recent = clients.slice(0, limit);

    return Promise.all(recent.map(async (client) => {
        let latestProject = null;
        let activeProjects = 0;
        try {
            const projects = await listProjectsByWorkspace(client.workspaceId);
            latestProject = projects[0] || null;
            activeProjects = projects.filter((p) => p.status === 'in_progress').length;
        } catch (error) {
            console.error('[dashboardService] Error cargando proyectos del cliente:', error.message);
        }
        return { ...client, latestProject, activeProjects };
    }));
}
