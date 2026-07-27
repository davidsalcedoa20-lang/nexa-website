/* ==========================================================
   NEXA HUB — Componente: tarjeta de Proyecto (grid admin)
   ========================================================== */
import {
    PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_CLASS,
    formatDate, daysRemaining, escapeHtml
} from '../../components/projectUi.js';

const ICON_EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/>';
const ICON_COPY = '<rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.6"/>';
const ICON_PAUSE = '<rect x="6" y="4" width="4" height="16" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="4" width="4" height="16" rx="1" stroke="currentColor" stroke-width="1.6"/>';
const ICON_PLAY = '<path d="M7 4.5v15l13-7.5-13-7.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
const ICON_FINISH = '<path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
const ICON_ARCHIVE = '<rect x="3" y="4" width="18" height="5" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
const ICON_DOTS = '<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>';

function icon(paths, size = 24) {
    return `<svg viewBox="0 0 ${size} ${size}" fill="none">${paths}</svg>`;
}

export function renderProjectsGrid(container, projects, handlers) {
    if (!container) return;

    if (!projects.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = projects.map((project) => {
        const color = project.color_hex || project.project_types?.color_hex || '#2D8CFF';
        const clientName = project.workspaces?.profiles?.full_name || project.workspaces?.name || 'Sin cliente';
        const typeName = project.project_types?.name || 'Sin tipo';
        const remaining = daysRemaining(project.end_date);
        const remainingLabel = remaining === null
            ? 'Sin fecha límite'
            : remaining < 0 ? `Vencido hace ${Math.abs(remaining)}d` : `${remaining}d restantes`;

        return `
        <article class="admin-project-card" style="--project-color:${color}" data-project-id="${project.id}">
            <div class="admin-project-card-top">
                <div>
                    <div class="admin-project-title">${escapeHtml(project.name)}</div>
                    <div class="admin-project-client">${escapeHtml(clientName)}</div>
                </div>
                <div class="admin-project-menu" data-menu>
                    <button type="button" class="admin-icon-btn" data-menu-toggle aria-label="Más opciones">${icon(ICON_DOTS)}</button>
                    <div class="admin-project-menu-list" data-menu-list>
                        <button type="button" class="admin-project-menu-item" data-action="view">${icon(ICON_EYE, 24)} Ver detalle</button>
                        <button type="button" class="admin-project-menu-item" data-action="duplicate">${icon(ICON_COPY, 24)} Duplicar</button>
                        ${project.status === 'in_progress'
                            ? `<button type="button" class="admin-project-menu-item" data-action="pause">${icon(ICON_PAUSE, 24)} Pausar</button>`
                            : `<button type="button" class="admin-project-menu-item" data-action="resume">${icon(ICON_PLAY, 24)} Activar</button>`}
                        <button type="button" class="admin-project-menu-item" data-action="finish">${icon(ICON_FINISH, 24)} Finalizar</button>
                        <button type="button" class="admin-project-menu-item danger" data-action="archive">${icon(ICON_ARCHIVE, 24)} Archivar</button>
                    </div>
                </div>
            </div>

            <span class="admin-project-type-tag">${escapeHtml(typeName)}</span>

            <div class="admin-project-progress-row">
                <div class="admin-project-progress-label">
                    <span>Progreso general</span>
                    <strong>${project.progress_percent || 0}%</strong>
                </div>
                <div class="admin-progress-track">
                    <div class="admin-progress-fill" style="width:${project.progress_percent || 0}%"></div>
                </div>
            </div>

            <div class="admin-project-meta-row">
                <span>${escapeHtml(PROJECT_STATUS_LABELS[project.status] || project.status)}</span>
                <span>${escapeHtml(remainingLabel)}</span>
            </div>

            <div class="admin-project-card-footer">
                <span class="admin-badge ${PROJECT_STATUS_BADGE_CLASS[project.status] || 'admin-badge--pending'}">${PROJECT_STATUS_LABELS[project.status] || project.status}</span>
                <span style="color:#7a7a7a; font-size:12px;">${formatDate(project.start_date)} — ${formatDate(project.end_date)}</span>
            </div>
        </article>`;
    }).join('');

    // Click en la tarjeta (fuera del menú) => ver detalle.
    container.querySelectorAll('.admin-project-card').forEach((card) => {
        const projectId = card.getAttribute('data-project-id');

        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-menu]')) return;
            handlers.onView?.(projectId);
        });

        const menu = card.querySelector('[data-menu]');
        const toggle = card.querySelector('[data-menu-toggle]');

        toggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.admin-project-menu.is-open').forEach((m) => {
                if (m !== menu) m.classList.remove('is-open');
            });
            menu.classList.toggle('is-open');
        });

        card.querySelectorAll('[data-action]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.remove('is-open');
                const action = btn.getAttribute('data-action');
                if (action === 'view') handlers.onView?.(projectId);
                if (action === 'duplicate') handlers.onDuplicate?.(projectId);
                if (action === 'pause') handlers.onStatusChange?.(projectId, 'paused');
                if (action === 'resume') handlers.onStatusChange?.(projectId, 'in_progress');
                if (action === 'finish') handlers.onStatusChange?.(projectId, 'completed');
                if (action === 'archive') handlers.onArchive?.(projectId);
            });
        });
    });
}

// Registrado una sola vez: cierra cualquier menú abierto al hacer clic fuera.
document.addEventListener('click', () => {
    document.querySelectorAll('.admin-project-menu.is-open').forEach((m) => m.classList.remove('is-open'));
});
