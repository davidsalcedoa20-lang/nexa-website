/* ==========================================================
   NEXA HUB — Página: Detalle de Proyecto (admin/proyecto-detalle.html)
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import { getProject, getProjectStructure, duplicateProject } from '../../services/projectService.js';
import { createPhase, deletePhase, createSection, deleteSection } from '../../services/phaseService.js';
import { createTask, updateTask, deleteTask } from '../../services/taskService.js';
import { listProjectFiles, uploadProjectFile, deleteProjectFile, getFileSignedUrl } from '../../services/fileService.js';
import { listComments, addComment } from '../../services/commentService.js';
import { listTimelineEvents } from '../../services/timelineService.js';
import { listAdmins } from '../../services/profileService.js';
import {
    PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_CLASS,
    PROGRESS_STATUS_LABELS, PROGRESS_STATUS_BADGE_CLASS, TASK_TYPE_LABELS, TASK_PRIORITY_LABELS,
    APPROVAL_DECISION_LABELS, TIMELINE_EVENT_ICONS,
    formatDate, formatDateTime, formatFileSize, getInitials, escapeHtml
} from '../../components/projectUi.js';

const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');

const mainEl = document.getElementById('projectDetailMain');
const loadingEl = document.getElementById('projectDetailLoadingState');

let currentUserId = null;
let admins = [];
let activePhaseIdForSection = null;
let activeSectionIdForTask = null;

function el(id) { return document.getElementById(id); }

/* ---------------------------------------------------------
   Carga inicial
--------------------------------------------------------- */
async function init() {
    if (!projectId) {
        loadingEl.innerHTML = '<span>Falta el id del proyecto en la URL.</span>';
        return;
    }

    const { data: authData } = await supabase.auth.getUser();
    currentUserId = authData?.user?.id || null;

    try {
        admins = await listAdmins();
        populateAssigneeSelect();
        await refreshAll();
        loadingEl.style.display = 'none';
        mainEl.style.display = 'flex';
    } catch (error) {
        console.error('[proyectoDetallePage] Error cargando proyecto:', error.message);
        loadingEl.innerHTML = `<span>No se pudo cargar el proyecto: ${escapeHtml(error.message)}</span>`;
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

/* ---------------------------------------------------------
   Header + progreso + resumen
--------------------------------------------------------- */
function renderHeader(project) {
    const color = project.color_hex || project.project_types?.color_hex || '#2D8CFF';
    const clientName = project.workspaces?.profiles?.full_name || project.workspaces?.name || 'Sin cliente';

    document.title = `${project.name} | NEXA Hub`;
    el('detailProjectName').textContent = project.name;
    el('detailProjectClient').textContent = `Cliente: ${clientName}`;

    const statusBadge = el('detailProjectStatusBadge');
    statusBadge.textContent = PROJECT_STATUS_LABELS[project.status] || project.status;
    statusBadge.className = `admin-badge ${PROJECT_STATUS_BADGE_CLASS[project.status] || 'admin-badge--pending'}`;

    const typeTag = el('detailProjectTypeTag');
    typeTag.textContent = project.project_types?.name || 'Sin tipo';
    typeTag.style.setProperty('--project-color', color);

    el('detailOverallProgress').textContent = `${project.progress_percent || 0}%`;
    el('detailOverallProgressBar').style.width = `${project.progress_percent || 0}%`;
    el('detailClientProgress').textContent = `${project.client_progress_percent || 0}%`;
    el('detailClientProgressBar').style.width = `${project.client_progress_percent || 0}%`;
    el('detailNexaProgress').textContent = `${project.nexa_progress_percent || 0}%`;
    el('detailNexaProgressBar').style.width = `${project.nexa_progress_percent || 0}%`;

    el('detailDescription').textContent = project.description || 'Sin descripción.';
    el('detailStartDate').textContent = formatDate(project.start_date);
    el('detailEndDate').textContent = formatDate(project.end_date);
    el('detailResponsible').textContent = admins.find((a) => a.id === project.responsible_id)?.full_name || 'Sin asignar';

    el('detailDuplicateBtn').onclick = async () => {
        const newName = window.prompt('Nombre del nuevo proyecto duplicado:', `${project.name} (copia)`);
        if (!newName) return;
        try {
            const newId = await duplicateProject(projectId, newName);
            window.location.href = `proyecto-detalle.html?id=${newId}`;
        } catch (error) {
            alert(`No se pudo duplicar: ${error.message}`);
        }
    };
}

/* ---------------------------------------------------------
   Tabs
--------------------------------------------------------- */
document.querySelectorAll('.admin-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.querySelector(`[data-tab-panel="${btn.dataset.tab}"]`)?.classList.add('active');
    });
});

/* ---------------------------------------------------------
   Bloques / Secciones / Tareas
--------------------------------------------------------- */
function populateAssigneeSelect() {
    const select = el('taskAssignee');
    if (!select) return;
    select.innerHTML = '<option value="">Sin asignar</option>' +
        admins.map((a) => `<option value="${a.id}">${escapeHtml(a.full_name || a.email)}</option>`).join('');
}

function renderPhases(phases) {
    const list = el('phaseList');
    const emptyState = el('phasesEmptyState');
    el('detailPhasesCount').textContent = String(phases.length);

    if (!phases.length) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    list.innerHTML = phases.map((phase) => `
        <div class="admin-phase" data-phase-id="${phase.id}">
            <div class="admin-phase-header" data-phase-toggle>
                <div class="admin-phase-header-main">
                    <div class="admin-phase-title-row">
                        <strong>${escapeHtml(phase.name)}</strong>
                        <span class="admin-badge ${PROGRESS_STATUS_BADGE_CLASS[phase.status] || 'admin-badge--pending'}">${PROGRESS_STATUS_LABELS[phase.status] || phase.status}</span>
                        ${phase.duration_days ? `<span style="color:#7a7a7a; font-size:12px;">${phase.duration_days} días</span>` : ''}
                    </div>
                    <div class="admin-progress-track" style="max-width:280px;">
                        <div class="admin-progress-fill" style="width:${phase.progress_percent || 0}%"></div>
                    </div>
                </div>
                <button type="button" class="admin-icon-btn danger" data-delete-phase title="Eliminar bloque">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <svg class="admin-phase-caret" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="admin-phase-body">
                ${(phase.sections || []).map((section) => renderSectionBlock(section)).join('')}
                <button type="button" class="admin-inline-add-btn" data-add-section="${phase.id}">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    Agregar sección
                </button>
            </div>
        </div>
    `).join('');

    wirePhaseEvents();
}

function renderSectionBlock(section) {
    return `
        <div class="admin-section-block" data-section-id="${section.id}">
            <div class="admin-section-block-header">
                <h4>${escapeHtml(section.name)}</h4>
                <button type="button" class="admin-icon-btn danger" data-delete-section title="Eliminar sección">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                </button>
            </div>
            <div class="admin-task-list">
                ${(section.tasks || []).map((task) => renderTaskRow(task)).join('') || '<div class="admin-empty-inline">Sin tareas todavía.</div>'}
            </div>
            <button type="button" class="admin-inline-add-btn" data-add-task="${section.id}">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                Agregar tarea
            </button>
        </div>
    `;
}

function renderTaskRow(task) {
    const approval = task.approvals?.[0] || task.approvals;
    const decisionLabel = task.task_type === 'approval' && approval
        ? `<span style="color:#7a7a7a; font-size:11px;">${APPROVAL_DECISION_LABELS[approval.decision] || approval.decision}</span>`
        : '';

    const statusOptions = Object.entries(PROGRESS_STATUS_LABELS)
        .map(([value, label]) => `<option value="${value}" ${task.status === value ? 'selected' : ''}>${label}</option>`)
        .join('');

    return `
        <div class="admin-task-row" data-task-id="${task.id}">
            <span class="admin-task-tag admin-task-tag--${task.task_type}">${TASK_TYPE_LABELS[task.task_type]}</span>
            <div class="admin-task-row-main">
                <strong>${escapeHtml(task.title)}</strong>
                <span>${task.profiles?.full_name ? `Responsable: ${escapeHtml(task.profiles.full_name)}` : 'Sin responsable'} ${task.due_date ? `· Vence ${formatDate(task.due_date)}` : ''}</span>
            </div>
            <span class="admin-task-priority">${TASK_PRIORITY_LABELS[task.priority] || task.priority}</span>
            ${decisionLabel}
            <select class="admin-task-status-select" data-task-status>${statusOptions}</select>
            <button type="button" class="admin-icon-btn danger" data-delete-task title="Eliminar tarea">
                <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
        </div>
    `;
}

function wirePhaseEvents() {
    document.querySelectorAll('[data-phase-toggle]').forEach((header) => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('[data-delete-phase]')) return;
            header.closest('.admin-phase').classList.toggle('is-open');
        });
    });

    document.querySelectorAll('[data-delete-phase]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const phaseId = btn.closest('.admin-phase').dataset.phaseId;
            if (!window.confirm('¿Eliminar este bloque y todo su contenido (secciones y tareas)?')) return;
            try {
                await deletePhase(phaseId);
                await refreshAll();
            } catch (error) {
                alert(`No se pudo eliminar: ${error.message}`);
            }
        });
    });

    document.querySelectorAll('[data-delete-section]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const sectionId = btn.closest('.admin-section-block').dataset.sectionId;
            if (!window.confirm('¿Eliminar esta sección y sus tareas?')) return;
            try {
                await deleteSection(sectionId);
                await refreshAll();
            } catch (error) {
                alert(`No se pudo eliminar: ${error.message}`);
            }
        });
    });

    document.querySelectorAll('[data-delete-task]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const taskId = btn.closest('.admin-task-row').dataset.taskId;
            if (!window.confirm('¿Eliminar esta tarea?')) return;
            try {
                await deleteTask(taskId);
                await refreshAll();
            } catch (error) {
                alert(`No se pudo eliminar: ${error.message}`);
            }
        });
    });

    document.querySelectorAll('[data-task-status]').forEach((select) => {
        select.addEventListener('click', (e) => e.stopPropagation());
        select.addEventListener('change', async () => {
            const taskId = select.closest('.admin-task-row').dataset.taskId;
            try {
                await updateTask(taskId, { status: select.value });
                await refreshAll();
            } catch (error) {
                alert(`No se pudo actualizar el estado: ${error.message}`);
            }
        });
    });

    document.querySelectorAll('[data-add-section]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            activePhaseIdForSection = btn.getAttribute('data-add-section');
            openModal('sectionModalOverlay');
        });
    });

    document.querySelectorAll('[data-add-task]').forEach((btn) => {
        btn.addEventListener('click', () => {
            activeSectionIdForTask = btn.getAttribute('data-add-task');
            openModal('taskModalOverlay');
        });
    });
}

/* ---------------------------------------------------------
   Modales genéricos (abrir/cerrar)
--------------------------------------------------------- */
function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

document.querySelectorAll('[data-close-phase-modal]').forEach((b) => b.addEventListener('click', () => closeModal('phaseModalOverlay')));
document.querySelectorAll('[data-close-section-modal]').forEach((b) => b.addEventListener('click', () => closeModal('sectionModalOverlay')));
document.querySelectorAll('[data-close-task-modal]').forEach((b) => b.addEventListener('click', () => closeModal('taskModalOverlay')));

[['phaseModalOverlay'], ['sectionModalOverlay'], ['taskModalOverlay']].forEach(([id]) => {
    document.getElementById(id)?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal(id);
    });
});

el('detailNewPhaseBtn')?.addEventListener('click', () => openModal('phaseModalOverlay'));

el('phaseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el('phaseName').value.trim();
    const errorEl = el('phaseFormError');
    errorEl.classList.remove('active');
    if (!name) { errorEl.textContent = 'El nombre es obligatorio.'; errorEl.classList.add('active'); return; }

    try {
        await createPhase({
            project_id: projectId,
            name,
            duration_days: Number(el('phaseDuration').value) || null,
            description: el('phaseDescription').value.trim()
        });
        closeModal('phaseModalOverlay');
        el('phaseForm').reset();
        await refreshAll();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

el('sectionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el('sectionName').value.trim();
    const errorEl = el('sectionFormError');
    errorEl.classList.remove('active');
    if (!name || !activePhaseIdForSection) { errorEl.textContent = 'El nombre es obligatorio.'; errorEl.classList.add('active'); return; }

    try {
        await createSection({ phase_id: activePhaseIdForSection, name });
        closeModal('sectionModalOverlay');
        el('sectionForm').reset();
        await refreshAll();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

el('taskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = el('taskTitle').value.trim();
    const errorEl = el('taskFormError');
    errorEl.classList.remove('active');
    if (!title || !activeSectionIdForTask) { errorEl.textContent = 'El título es obligatorio.'; errorEl.classList.add('active'); return; }

    try {
        await createTask({
            section_id: activeSectionIdForTask,
            title,
            description: el('taskDescription').value.trim(),
            task_type: el('taskType').value,
            priority: el('taskPriority').value,
            assignee_id: el('taskAssignee').value || null,
            due_date: el('taskDueDate').value || null,
            created_by: currentUserId
        });
        closeModal('taskModalOverlay');
        el('taskForm').reset();
        await refreshAll();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

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
        <div class="admin-file-row" data-file-id="${file.id}" data-storage-path="${escapeHtml(file.storage_path)}">
            <div class="admin-file-icon">
                <svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 3v5h5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            </div>
            <div class="admin-file-info">
                <strong>${escapeHtml(file.file_name)}</strong>
                <span>${file.folder} · ${formatFileSize(file.size_bytes)} · ${escapeHtml(file.profiles?.full_name || 'NEXA')} · ${formatDate(file.created_at)}</span>
            </div>
            <button type="button" class="admin-icon-btn" data-download-file title="Descargar">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="admin-icon-btn danger" data-delete-file title="Eliminar">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
        </div>
    `).join('');

    list.querySelectorAll('[data-download-file]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const path = btn.closest('.admin-file-row').dataset.storagePath;
            try {
                const url = await getFileSignedUrl(path);
                window.open(url, '_blank');
            } catch (error) {
                alert(`No se pudo generar el enlace: ${error.message}`);
            }
        });
    });

    list.querySelectorAll('[data-delete-file]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('.admin-file-row');
            const file = files.find((f) => f.id === row.dataset.fileId);
            if (!window.confirm(`¿Eliminar "${file.file_name}"?`)) return;
            try {
                await deleteProjectFile(file);
                await refreshAll();
            } catch (error) {
                alert(`No se pudo eliminar: ${error.message}`);
            }
        });
    });
}

el('fileUploadInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        await uploadProjectFile({ projectId, file, uploadedBy: currentUserId });
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
        <div class="admin-comment">
            <div class="admin-comment-avatar">${getInitials(c.profiles?.full_name)}</div>
            <div class="admin-comment-body">
                <div class="admin-comment-header">
                    <strong>${escapeHtml(c.profiles?.full_name || 'Usuario')}</strong>
                    <span>${c.profiles?.role === 'admin' ? 'NEXA' : 'Cliente'} · ${formatDateTime(c.created_at)}</span>
                </div>
                <div class="admin-comment-text">${escapeHtml(c.body)}</div>
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
        <div class="admin-timeline-item">
            <div class="admin-timeline-dot"><svg viewBox="0 0 24 24" fill="none">${TIMELINE_EVENT_ICONS[event.event_type] || '<circle cx="12" cy="12" r="3" fill="currentColor"/>'}</svg></div>
            <div class="admin-timeline-content">
                <p>${escapeHtml(event.description)}</p>
                <span>${formatDateTime(event.created_at)}${event.profiles?.full_name ? ` · ${escapeHtml(event.profiles.full_name)}` : ''}</span>
            </div>
        </div>
    `).join('');
}

init();
