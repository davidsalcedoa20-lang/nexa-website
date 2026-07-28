/* ==========================================================
   NEXA HUB — Página: Resumen del cliente (dashboard/index.html)
   ==========================================================
   Se refresca solo (Realtime) cuando cambian sus proyectos o
   tareas — por ejemplo, al marcar una tarea como completada
   desde "Mis Tareas" (dashboard/tareas.html), el progreso
   promedio y las aprobaciones pendientes se actualizan aquí
   sin necesidad de recargar la página.
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import { listProjects } from '../../services/projectService.js';
import { formatDate, escapeHtml } from '../../components/projectUi.js';

const grid = document.getElementById('dashProjectsGrid');
const emptyState = document.getElementById('dashProjectsEmptyState');

async function loadSummary() {
    try {
        const projects = await listProjects();
        const active = projects.filter((p) => p.status === 'in_progress');

        document.getElementById('dashActiveProjectsValue').textContent = String(active.length);

        const avgProgress = projects.length
            ? Math.round(projects.reduce((sum, p) => sum + (p.progress_percent || 0), 0) / projects.length)
            : 0;
        document.getElementById('dashAvgProgressValue').textContent = `${avgProgress}%`;

        const { count } = await supabase
            .from('approvals')
            .select('id', { count: 'exact', head: true })
            .eq('decision', 'pending');
        document.getElementById('dashPendingApprovalsValue').textContent = String(count || 0);

        if (!projects.length) {
            emptyState.style.display = 'block';
            grid.innerHTML = '';
            return;
        }
        emptyState.style.display = 'none';

        grid.innerHTML = projects.map((p) => {
            const color = p.color_hex || p.project_types?.color_hex || '#2D8CFF';
            return `
            <a href="proyecto.html?id=${p.id}" class="dash-project-card" style="--project-color:${color}">
                <div class="dash-project-name">${escapeHtml(p.name)}</div>
                <span class="dash-project-type">${escapeHtml(p.project_types?.name || 'Proyecto')}</span>
                <div class="dash-progress-track"><div class="dash-progress-fill" style="width:${p.progress_percent || 0}%"></div></div>
                <div class="dash-project-meta">
                    <span>${p.progress_percent || 0}% completado</span>
                    <span>${formatDate(p.end_date)}</span>
                </div>
            </a>`;
        }).join('');
    } catch (error) {
        console.error('[resumenPage] Error cargando resumen:', error.message);
    }
}

let refreshTimer = null;
function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(loadSummary, 500);
}

function subscribeRealtime() {
    supabase
        .channel('client-resumen-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, scheduleRefresh)
        .subscribe();
}

loadSummary();
subscribeRealtime();
