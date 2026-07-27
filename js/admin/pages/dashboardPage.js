/* ==========================================================
   NEXA HUB — Página: Dashboard Administrativo (admin/index.html)
   ==========================================================
   Reemplaza los datos simulados que tenía js/admin.js (ahora
   convertido en el "shell" compartido de sidebar/menú). Toda
   métrica viene de Supabase en tiempo real (dashboardService.js)
   y la vista se refresca automáticamente vía Realtime cuando
   cambian clientes, proyectos o tareas.
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import { getDashboardStats, listRecentClientsWithProject } from '../services/dashboardService.js';
import { listRecentActivityForAdmin } from '../../services/timelineService.js';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_CLASS, TIMELINE_EVENT_ICONS, formatDateTime, escapeHtml } from '../../components/projectUi.js';

function el(id) { return document.getElementById(id); }

/* ---------------------------------------------------------
   Estadísticas
--------------------------------------------------------- */
function renderStats(stats) {
    if (el('statClientsValue')) el('statClientsValue').textContent = String(stats.clients.total);
    if (el('statClientsTrend')) {
        el('statClientsTrend').textContent = stats.clients.newThisMonth > 0
            ? `+${stats.clients.newThisMonth} este mes`
            : 'Sin nuevos este mes';
    }

    if (el('statProjectsValue')) el('statProjectsValue').textContent = String(stats.projects.active);
    if (el('statProjectsTrend')) {
        el('statProjectsTrend').textContent = stats.projects.inReview > 0
            ? `${stats.projects.inReview} en revisión`
            : 'Ninguno en revisión';
    }

    if (el('statTasksValue')) el('statTasksValue').textContent = String(stats.tasks.total);
    if (el('statTasksTrend')) {
        el('statTasksTrend').textContent = stats.tasks.urgent > 0
            ? `${stats.tasks.urgent} urgentes`
            : 'Sin urgentes';
    }

    if (el('statDueValue')) {
        el('statDueValue').textContent = stats.nextDue
            ? (stats.nextDue.daysLeft <= 0 ? 'Hoy' : `${stats.nextDue.daysLeft} día${stats.nextDue.daysLeft === 1 ? '' : 's'}`)
            : '—';
    }
    if (el('statDueTrend')) {
        el('statDueTrend').textContent = stats.nextDue
            ? `${stats.nextDue.taskTitle} · ${stats.nextDue.projectName}`
            : 'Sin fechas próximas';
    }
}

/* ---------------------------------------------------------
   Clientes recientes
--------------------------------------------------------- */
function renderRecentClients(clients) {
    const tbody = el('adminClientsTableBody');
    const emptyRow = el('adminClientsEmptyState');
    if (!tbody) return;

    if (!clients.length) {
        tbody.innerHTML = '';
        if (emptyRow) emptyRow.style.display = 'block';
        return;
    }
    if (emptyRow) emptyRow.style.display = 'none';

    tbody.innerHTML = clients.map((client) => {
        const project = client.latestProject;
        const statusLabel = project ? (PROJECT_STATUS_LABELS[project.status] || project.status) : 'Sin proyectos';
        const statusClass = project ? (PROJECT_STATUS_BADGE_CLASS[project.status] || 'admin-badge--pending') : 'admin-badge--pending';
        const startDate = project?.start_date ? new Date(project.start_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

        return (
            '<tr>' +
                `<td><div class="admin-table-company"><strong>${escapeHtml(client.company)}</strong>${client.activeProjects > 1 ? `<span>${client.activeProjects} proyectos activos</span>` : ''}</div></td>` +
                `<td>${escapeHtml(client.contact)}</td>` +
                `<td>${project ? escapeHtml(project.name) : '—'}</td>` +
                `<td><span class="admin-badge ${statusClass}">${escapeHtml(statusLabel)}</span></td>` +
                `<td>${startDate}</td>` +
                '<td>' +
                    '<div class="admin-table-actions">' +
                        `<a class="admin-action-btn" href="clientes.html" title="Ver en Clientes"><svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg></a>` +
                    '</div>' +
                '</td>' +
            '</tr>'
        );
    }).join('');
}

/* ---------------------------------------------------------
   Actividad reciente (todos los proyectos)
--------------------------------------------------------- */
function renderActivity(events) {
    const list = el('adminActivityList');
    if (!list) return;

    if (!events.length) {
        list.innerHTML = '<li class="admin-activity-item"><span>Sin actividad todavía.</span></li>';
        return;
    }

    list.innerHTML = events.map((event) => {
        const projectName = event.projects?.name ? ` — ${escapeHtml(event.projects.name)}` : '';
        return (
            '<li class="admin-activity-item">' +
                '<span class="admin-activity-dot">' +
                    `<svg viewBox="0 0 24 24" fill="none">${TIMELINE_EVENT_ICONS[event.event_type] || '<circle cx="12" cy="12" r="3" fill="currentColor"/>'}</svg>` +
                '</span>' +
                '<span>' +
                    `<span class="admin-activity-text">${escapeHtml(event.description)}${projectName}</span>` +
                    `<span class="admin-activity-time">${formatDateTime(event.created_at)}</span>` +
                '</span>' +
            '</li>'
        );
    }).join('');
}

/* ---------------------------------------------------------
   Carga + Realtime
--------------------------------------------------------- */
async function loadDashboard() {
    try {
        const [stats, recentClients, activity] = await Promise.all([
            getDashboardStats(),
            listRecentClientsWithProject(5),
            listRecentActivityForAdmin(8)
        ]);
        renderStats(stats);
        renderRecentClients(recentClients);
        renderActivity(activity);
    } catch (error) {
        console.error('[dashboardPage] Error cargando el dashboard:', error.message);
    }
}

let refreshTimer = null;
function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadDashboard, 600);
}

function subscribeRealtime() {
    supabase
        .channel('admin-dashboard-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleRefresh)
        .subscribe();
}

loadDashboard();
subscribeRealtime();
