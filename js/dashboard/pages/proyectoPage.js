/* ==========================================================
   NEXA HUB — Página: Detalle de Proyecto (cliente)
   dashboard/proyecto.html
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import { getProject, getProjectStructure } from '../../services/projectService.js';
import { setClientTaskStatus, decideApproval } from '../../services/taskService.js';
import { listProjectFiles, uploadProjectFile, getFileSignedUrl } from '../../services/fileService.js';
import { listComments, addComment } from '../../services/commentService.js';
import { listTimelineEvents } from '../../services/timelineService.js';
import {
    PROJECT_STATUS_LABELS, PROGRESS_STATUS_LABELS, TASK_TYPE_LABELS,
    APPROVAL_DECISION_LABELS, TIMELINE_EVENT_ICONS,
    formatDate, formatDateTime, formatFileSize, getInitials, escapeHtml
} from '../../components/projectUi.js';

const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');

const mainEl = document.getElementById('projectDetailMain');
const loadingEl = document.getElementById('projectDetailLoadingState');

let currentUserId = null;

function el(id) { return document.getElementById(id); }

const DASH_BADGE_CLASS = {
    pending: 'dash-badge--pending',
    in_progress: 'dash-badge--progress',
    waiting_approval: 'dash-badge--waiting',
    completed: 'dash-badge--done',
    blocked: 'dash-badge--blocked',
    finished: 'dash-badge--done'
};

async function init() {
    if (!projectId) {
        loadingEl.textContent = 'Falta el id del proyecto en la URL.';
        return;
    }

    const { data: authData } = await supabase.auth.getUser();
    currentUserId = authData?.user?.id || null;

    try {
        await refreshAll();
        loadingEl.style.display = 'none';
        mainEl.style.display = 'flex';
    } catch (error) {
        console.error('[proyectoPage] Error cargando proyecto:', error.message);
        loadingEl.textContent = `No se pudo cargar el proyecto: ${error.message}`;
    }
}

async function refreshAll() {
    const project = await getProject(projectId);
    renderHeader(project);

    const phases = await getProjectStructure(projectId);
    renderPhases(phases);

    const files = await listProjectFiles(projectId);
    renderFiles(files);

    const comments = await listComments(projectId, 'project', projectId);
    renderComments(comments);

    const events = await listTimelineEvents(projectId);
    renderTimeline(events);
}

function renderHeader(project) {
    document.title = `${project.name} | NEXA Hub`;
    el('detailProjectName').textContent = project.name;
    el('detailProjectMeta').textContent =
        `${project.project_types?.name || 'Proyecto'} · ${PROJECT_STATUS_LABELS[project.status] || project.status}`;

    el('detailOverallProgress').textContent = `${project.progress_percent || 0}%`;
    el('detailOverallProgressBar').style.width = `${project.progress_percent || 0}%`;
    el('detailClientProgress').textContent = `${project.client_progress_percent || 0}%`;
    el('detailClientProgressBar').style.width = `${project.client_progress_percent || 0}%`;
    el('detailNexaProgress').textContent = `${project.nexa_progress_percent || 0}%`;
    el('detailNexaProgressBar').style.width = `${project.nexa_progress_percent || 0}%`;

    el('detailDescription').textContent = project.description || 'Sin descripción.';
    el('detailStartDate').textContent = formatDate(project.start_date);
    el('detailEndDate').textContent = formatDate(project.end_date);
}

/* ---------------------------------------------------------
   Tabs
--------------------------------------------------------- */
document.querySelectorAll('.dash-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.dash-tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.dash-tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.querySelector(`[data-tab-panel="${btn.dataset.tab}"]`)?.classList.add('active');
    });
});

/* ---------------------------------------------------------
   Bloques / Tareas / Aprobaciones
--------------------------------------------------------- */
function renderPhases(phases) {
    const list = el('phaseList');
    const emptyState = el('phasesEmptyState');

    if (!phases.length) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    list.innerHTML = phases.map((phase) => `
        <div class="dash-phase" data-phase-id="${phase.id}">
            <div class="dash-phase-header" data-phase-toggle>
                <div class="dash-phase-header-main">
                    <div class="dash-phase-title-row">
                        <strong>${escapeHtml(phase.name)}</strong>
                        <span class="dash-badge ${DASH_BADGE_CLASS[phase.status] || 'dash-badge--pending'}">${PROGRESS_STATUS_LABELS[phase.status] || phase.status}</span>
                        ${phase.duration_days ? `<span style="color:#7a7a7a; font-size:12px;">${phase.duration_days} días</span>` : ''}
                    </div>
                    <div class="dash-progress-track" style="max-width:260px;">
                        <div class="dash-progress-fill" style="width:${phase.progress_percent || 0}%"></div>
                    </div>
                </div>
                <svg class="dash-phase-caret" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="dash-phase-body">
                ${(phase.sections || []).map((section) => `
                    <div class="dash-section-block">
                        <h4>${escapeHtml(section.name)}</h4>
                        ${(section.tasks || []).map((task) => renderTaskRow(task)).join('') || '<span style="color:#7a7a7a; font-size:12px;">Sin tareas.</span>'}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    document.querySelectorAll('[data-phase-toggle]').forEach((header) => {
        header.addEventListener('click', () => header.closest('.dash-phase').classList.toggle('is-open'));
    });

    wireTaskActions();
}

function renderTaskRow(task) {
    const approval = task.approvals?.[0] || task.approvals;
    let actionHtml = '';

    if (task.task_type === 'client' && task.status !== 'completed' && task.status !== 'finished') {
        actionHtml = `<button type="button" class="dash-btn-small" data-complete-task="${task.id}">Marcar como hecha</button>`;
    } else if (task.task_type === 'approval' && approval && approval.decision === 'pending') {
        actionHtml = `
            <button type="button" class="dash-btn-small" data-approve="${approval.id}">Aprobar</button>
            <button type="button" class="dash-btn-outline" data-request-changes="${approval.id}">Solicitar cambios</button>`;
    } else if (task.task_type === 'approval' && approval) {
        actionHtml = `<span class="dash-badge ${approval.decision === 'approved' ? 'dash-badge--done' : 'dash-badge--waiting'}">${APPROVAL_DECISION_LABELS[approval.decision]}</span>`;
    }

    return `
        <div class="dash-task-row">
            <span class="dash-task-tag dash-task-tag--${task.task_type}">${TASK_TYPE_LABELS[task.task_type]}</span>
            <div class="dash-task-row-main">
                <strong>${escapeHtml(task.title)}</strong>
                <span>${task.due_date ? `Vence ${formatDate(task.due_date)}` : PROGRESS_STATUS_LABELS[task.status] || task.status}</span>
            </div>
            ${actionHtml}
        </div>
    `;
}

function wireTaskActions() {
    document.querySelectorAll('[data-complete-task]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const taskId = btn.getAttribute('data-complete-task');
            btn.disabled = true;
            try {
                await setClientTaskStatus(taskId, 'completed');
                await refreshAll();
            } catch (error) {
                alert(`No se pudo actualizar la tarea: ${error.message}`);
                btn.disabled = false;
            }
        });
    });

    document.querySelectorAll('[data-approve]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const approvalId = btn.getAttribute('data-approve');
            btn.disabled = true;
            try {
                await decideApproval(approvalId, 'approved', null, currentUserId);
                await refreshAll();
            } catch (error) {
                alert(`No se pudo registrar la aprobación: ${error.message}`);
                btn.disabled = false;
            }
        });
    });

    document.querySelectorAll('[data-request-changes]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const approvalId = btn.getAttribute('data-request-changes');
            const comment = window.prompt('Cuéntanos qué cambios necesitas:');
            if (comment === null) return;
            btn.disabled = true;
            try {
                await decideApproval(approvalId, 'changes_requested', comment, currentUserId);
                await refreshAll();
            } catch (error) {
                alert(`No se pudo enviar la solicitud: ${error.message}`);
                btn.disabled = false;
            }
        });
    });
}

/* ---------------------------------------------------------
   Archivos
--------------------------------------------------------- */
function renderFiles(files) {
    const list = el('filesList');
    const emptyState = el('filesEmptyState');

    if (!files.length) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    list.innerHTML = files.map((file) => `
        <div class="dash-file-row" data-storage-path="${escapeHtml(file.storage_path)}">
            <div class="dash-file-icon">
                <svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 3v5h5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            </div>
            <div class="dash-file-info">
                <strong>${escapeHtml(file.file_name)}</strong>
                <span>${file.folder} · ${formatFileSize(file.size_bytes)} · ${formatDate(file.created_at)}</span>
            </div>
            <button type="button" class="dash-btn-outline" data-download-file>Descargar</button>
        </div>
    `).join('');

    list.querySelectorAll('[data-download-file]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const path = btn.closest('.dash-file-row').dataset.storagePath;
            try {
                const url = await getFileSignedUrl(path);
                window.open(url, '_blank');
            } catch (error) {
                alert(`No se pudo generar el enlace: ${error.message}`);
            }
        });
    });
}

el('fileUploadInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        await uploadProjectFile({ projectId, folder: 'Cliente', file, uploadedBy: currentUserId });
        await refreshAll();
    } catch (error) {
        alert(`No se pudo subir el archivo: ${error.message}`);
    } finally {
        e.target.value = '';
    }
});

/* ---------------------------------------------------------
   Comentarios
--------------------------------------------------------- */
function renderComments(comments) {
    const list = el('commentsList');
    if (!comments.length) {
        list.innerHTML = '<p style="color:#7a7a7a; font-size:13px;">Todavía no hay comentarios.</p>';
        return;
    }

    list.innerHTML = comments.map((c) => `
        <div class="dash-comment">
            <div class="dash-comment-avatar">${getInitials(c.profiles?.full_name)}</div>
            <div class="dash-comment-body">
                <div class="dash-comment-header">
                    <strong>${escapeHtml(c.profiles?.full_name || 'Usuario')}</strong>
                    <span>${c.profiles?.role === 'admin' ? 'NEXA' : 'Tú'} · ${formatDateTime(c.created_at)}</span>
                </div>
                <div class="dash-comment-text">${escapeHtml(c.body)}</div>
            </div>
        </div>
    `).join('');
}

el('commentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = el('commentInput').value.trim();
    if (!body) return;

    try {
        await addComment({ projectId, commentableType: 'project', commentableId: projectId, authorId: currentUserId, body });
        el('commentInput').value = '';
        const comments = await listComments(projectId, 'project', projectId);
        renderComments(comments);
    } catch (error) {
        alert(`No se pudo enviar el comentario: ${error.message}`);
    }
});

/* ---------------------------------------------------------
   Cronología
--------------------------------------------------------- */
function renderTimeline(events) {
    const list = el('timelineList');
    const emptyState = el('timelineEmptyState');

    if (!events.length) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    list.innerHTML = events.map((event) => `
        <div class="dash-timeline-item">
            <div class="dash-timeline-dot"><svg viewBox="0 0 24 24" fill="none">${TIMELINE_EVENT_ICONS[event.event_type] || '<circle cx="12" cy="12" r="3" fill="currentColor"/>'}</svg></div>
            <div class="dash-timeline-content">
                <p>${escapeHtml(event.description)}</p>
                <span>${formatDateTime(event.created_at)}</span>
            </div>
        </div>
    `).join('');
}

init();
