/* ==========================================================
   NEXA HUB — Página: Mis Proyectos (dashboard/proyectos.html)
   ========================================================== */
import { listProjects } from '../../services/projectService.js';
import { formatDate, escapeHtml } from '../../components/projectUi.js';

const grid = document.getElementById('clientProjectsGrid');
const emptyState = document.getElementById('clientProjectsEmptyState');

async function load() {
    try {
        const projects = await listProjects();

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
        console.error('[proyectosPage:dashboard] Error cargando proyectos:', error.message);
        grid.innerHTML = `<p style="color:#FF6B81; grid-column:1/-1;">No se pudieron cargar tus proyectos.</p>`;
    }
}

load();
