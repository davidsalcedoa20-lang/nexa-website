/* ==========================================================
   NEXA HUB — Página: Detalle de Proyecto (cliente)
   dashboard/proyecto.html
   ==========================================================
   Vista "Plantilla Oficial" en modo SOLO LECTURA: el cliente
   visualiza etapas, bloques, secciones, tareas, entregables,
   comentarios y cronología. Únicamente puede:
     - Marcar como "Lista" sus propias tareas (task_type = client).
     - Aprobar / solicitar cambios en tareas de aprobación.
     - Aprobar / rechazar entregables ya enviados.
     - Comentar.
   No puede crear, eliminar ni modificar títulos/fechas/responsables.
   NEXA Hub no almacena archivos (Supabase Storage): los
   entregables usan un enlace externo opcional (Drive, Figma,
   Canva, Dropbox, etc.) en vez de un archivo subido al sistema.
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import { getProject, getProjectStructure } from '../../services/projectService.js';
import { setClientTaskStatus, decideApproval } from '../../services/taskService.js';
import { listComments, addComment } from '../../services/commentService.js';
import { listTimelineEvents } from '../../services/timelineService.js';
import { listProjectDeliverables, decideDeliverable } from '../../services/deliverableService.js';
import {
    PROGRESS_STATUS_LABELS,
    APPROVAL_DECISION_LABELS, DELIVERABLE_STATUS_LABELS, TIMELINE_EVENT_ICONS,
    formatDate, formatDateTime, getInitials, escapeHtml, daysRemaining
} from '../../components/projectUi.js';

const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');

const mainEl = document.getElementById('projectDetailMain');
const loadingEl = document.getElementById('projectDetailLoadingState');

let currentUserId = null;
let currentProject = null;
let currentStructure = null;

function el(id) { return document.getElementById(id); }

const DASH_BADGE_CLASS = {
    pending: 'dash-badge--pending',
    in_progress: 'dash-badge--progress',
    waiting_approval: 'dash-badge--waiting',
    completed: 'dash-badge--done',
    blocked: 'dash-badge--blocked',
    finished: 'dash-badge--done',
    approved: 'dash-badge--done',
    cancelled: 'dash-badge--pending'
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
    currentProject = await getProject(projectId);
    currentStructure = await getProjectStructure(projectId);
    const deliverables = await listProjectDeliverables(projectId);
    const comments = await listComments(projectId, 'project', projectId);
    const events = await listTimelineEvents(projectId);

    renderHeader(currentProject);
    renderStageProgress(currentStructure.stages);
    renderTimelineChips(currentStructure.stages);
    renderPhases(currentStructure.stages, currentStructure.unassignedPhases);
    renderMyTasks(currentStructure.allTasks);
    renderDeliverables(deliverables);
    renderActivityPreview(events);
    renderComments(comments);
    renderTimeline(events);
}

function renderHeader(project) {
    document.title = `${project.name} | NEXA Hub`;
    el('pdBreadcrumbName').textContent = project.name;

    const titleEl = el('pdTitle');
    const primaryColor = project.color_hex || project.project_types?.color_hex || '#2D8CFF';
    const secondaryColor = project.secondary_color_hex || '#FF8A3D';
    titleEl.style.setProperty('--project-color', primaryColor);
    titleEl.style.setProperty('--project-color-2', secondaryColor);

    if (project.name.includes(' + ')) {
        const [first, ...rest] = project.name.split(' + ');
        titleEl.innerHTML = `<span class="dash-title-part">${escapeHtml(first)}</span><span class="dash-title-sep">+</span><span class="dash-title-part dash-title-part--secondary">${escapeHtml(rest.join(' + '))}</span>`;
    } else {
        titleEl.innerHTML = `<span class="dash-title-part">${escapeHtml(project.name)}</span>`;
    }

    const remaining = daysRemaining(project.end_date);
    el('detailProjectMeta').textContent =
        `${project.project_types?.name || 'Proyecto'} · ${remaining !== null && remaining >= 0 ? `Entrega en ${remaining} día${remaining === 1 ? '' : 's'}` : ''}`;

    el('pdMetaModality').textContent = project.modality || 'Sin definir';
    el('detailOverallProgress').textContent = `${project.progress_percent || 0}%`;
    el('detailOverallProgressBar').style.width = `${project.progress_percent || 0}%`;
    el('detailClientProgress').textContent = `${project.client_progress_percent || 0}%`;
    el('detailNexaProgress').textContent = `${project.nexa_progress_percent || 0}%`;

    el('detailDescription').textContent = project.description || 'Sin descripción.';
    el('detailStartDate').textContent = formatDate(project.start_date);
    el('detailEndDate').textContent = formatDate(project.end_date);
    el('detailResponsible').textContent = project.responsible?.full_name || 'NEXA';
}

function renderStageProgress(stages) {
    const list = el('pdStageProgressList');
    if (!stages.length) {
        list.innerHTML = '<span style="color:#6a6a6a; font-size:12px;">Sin etapas todavía.</span>';
        return;
    }
    list.innerHTML = stages.map((stage, idx) => `
        <div class="dash-stage-progress-item">
            <span class="dash-stage-progress-code" style="--stage-color:${escapeHtml(stage.color_hex)}">A${idx + 1}</span>
            <span class="dash-stage-progress-name">${escapeHtml(stage.name)}</span>
            <span class="dash-stage-progress-percent">${stage.progress_percent || 0}%</span>
        </div>
    `).join('');
}

function renderTimelineChips(stages) {
    const track = el('pdTimelineTrack');
    if (!stages.length) {
        track.innerHTML = '<span style="color:#6a6a6a; font-size:12px;">Sin etapas todavía.</span>';
        return;
    }
    track.innerHTML = stages.map((stage, idx) => `
        <div class="dash-timeline-chip" style="--stage-color:${escapeHtml(stage.color_hex)}">
            <div class="dash-timeline-chip-top">
                <span class="dash-timeline-chip-num">${idx + 1}</span>
                <span class="dash-timeline-chip-name">${escapeHtml(stage.name)}</span>
            </div>
            <span class="dash-timeline-chip-sub">${stage.progress_percent || 0}% · ${PROGRESS_STATUS_LABELS[stage.status] || stage.status}</span>
        </div>
    `).join('');
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
   Bloques / Secciones / Tareas (solo lectura + acciones propias)
--------------------------------------------------------- */
function renderPhases(stages, unassignedPhases) {
    const list = el('phaseList');
    const emptyState = el('phasesEmptyState');

    const allPhases = [...stages.flatMap((s) => s.phases.map((p) => ({ ...p, stageColor: s.color_hex }))), ...unassignedPhases];

    if (!allPhases.length) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    list.innerHTML = allPhases.map((phase) => `
        <div class="dash-block">
            <div class="dash-block-header">
                <div>
                    <div class="dash-block-title">
                        <span class="dash-block-title-dot" style="--stage-color:${escapeHtml(phase.stageColor || '#2D8CFF')}"></span>
                        <strong>${escapeHtml(phase.name)}</strong>
                        <span class="dash-badge ${DASH_BADGE_CLASS[phase.status] || 'dash-badge--pending'}">${PROGRESS_STATUS_LABELS[phase.status] || phase.status} — ${phase.progress_percent || 0}%</span>
                    </div>
                    ${phase.description ? `<span class="dash-block-desc">${escapeHtml(phase.description)}</span>` : ''}
                </div>
            </div>
            <div class="dash-block-body">
                ${(phase.sections || []).map((section) => `
                    <div>
                        <div class="dash-section-group-header">
                            <span class="dash-section-group-dot" style="--section-color:${escapeHtml(section.color_hex || '#2D8CFF')}"></span>
                            <span class="dash-section-group-name">${escapeHtml(section.name)}</span>
                            ${section.handle ? `<span class="dash-section-group-handle">—@${escapeHtml(section.handle)}</span>` : ''}
                        </div>
                        <div class="dash-task-grid">
                            ${(section.tasks || []).map((task, idx) => renderTaskCard(task, idx)).join('') || '<span style="color:#7a7a7a; font-size:12px;">Sin tareas.</span>'}
                        </div>
                    </div>
                `).join('') || '<span class="dash-empty-inline">Este bloque todavía no tiene secciones.</span>'}
            </div>
        </div>
    `).join('');

    wireTaskActions();
}

function renderTaskCard(task, idx) {
    const approval = task.approvals?.[0] || task.approvals;
    let actionHtml = '';

    if (task.task_type === 'client' && !['completed', 'finished', 'approved'].includes(task.status)) {
        actionHtml = `<button type="button" class="dash-task-mark-btn" data-complete-task="${task.id}">Marcar como lista</button>`;
    } else if (task.task_type === 'approval' && approval && approval.decision === 'pending') {
        actionHtml = `
            <div style="display:flex; gap:8px; margin-top:4px;">
                <button type="button" class="dash-task-mark-btn" data-approve="${approval.id}">Aprobar</button>
                <button type="button" class="dash-btn-outline" data-request-changes="${approval.id}">Solicitar cambios</button>
            </div>`;
    } else if (task.task_type === 'approval' && approval) {
        actionHtml = `<span class="dash-badge ${approval.decision === 'approved' ? 'dash-badge--done' : 'dash-badge--waiting'}">${APPROVAL_DECISION_LABELS[approval.decision]}</span>`;
    }

    return `
        <div class="dash-task-card">
            <div class="dash-task-card-top">
                <span class="dash-task-card-code">1.${idx + 1}</span>
                <span class="dash-task-card-title">${escapeHtml(task.title)}</span>
            </div>
            <span class="dash-badge ${DASH_BADGE_CLASS[task.status] || 'dash-badge--pending'}" style="align-self:flex-start;">${PROGRESS_STATUS_LABELS[task.status] || task.status}</span>
            ${task.description ? `<p class="dash-task-card-desc">${escapeHtml(task.description)}</p>` : ''}
            <div class="dash-task-card-footer">
                <div class="dash-task-avatar-row">
                    <span class="dash-task-avatar">${getInitials(task.task_type === 'client' ? 'Tú' : (task.profiles?.full_name || 'NEXA'))}</span>
                    <span class="dash-task-avatar-name">${task.task_type === 'client' ? 'Tú' : escapeHtml(task.profiles?.full_name || 'Equipo NEXA')}${task.due_date ? ` · ${formatDate(task.due_date)}` : ''}</span>
                </div>
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
            btn.textContent = 'Guardando...';
            try {
                await setClientTaskStatus(taskId, 'completed');
                await refreshAll();
            } catch (error) {
                alert(`No se pudo actualizar la tarea: ${error.message}`);
                btn.disabled = false;
                btn.textContent = 'Marcar como lista';
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
   "Tus tareas" (resumen) — atajo directo sin entrar a Bloques
--------------------------------------------------------- */
function renderMyTasks(tasks) {
    const list = el('pdMyTasksList');
    const emptyState = el('pdMyTasksEmptyState');
    const myTasks = tasks.filter((t) => t.task_type === 'client' || t.task_type === 'approval');

    if (!myTasks.length) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    list.innerHTML = myTasks.map((task) => `
        <div class="dash-task-checkrow ${['completed', 'finished', 'approved'].includes(task.status) ? 'is-done' : ''}">
            <span class="dash-badge ${DASH_BADGE_CLASS[task.status] || 'dash-badge--pending'}">${PROGRESS_STATUS_LABELS[task.status] || task.status}</span>
            <span class="dash-task-checkrow-title">${escapeHtml(task.title)}</span>
        </div>
    `).join('');
}

/* ---------------------------------------------------------
   Entregables
--------------------------------------------------------- */
function renderDeliverables(deliverables) {
    const list = el('pdDeliverablesList');
    const emptyState = el('pdDeliverablesEmptyState');

    if (!deliverables.length) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    const doneCheck = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const linkIcon = '<svg viewBox="0 0 24 24" fill="none" style="width:13px;height:13px;"><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    list.innerHTML = deliverables.map((d) => {
        const isDone = d.status === 'approved';
        const canDecide = d.status === 'delivered';
        return `
            <div class="dash-deliverable-row" data-deliverable-id="${d.id}" style="flex-wrap:wrap;">
                <span class="dash-deliverable-check" style="background:${isDone ? 'rgba(60,210,140,.16)' : 'rgba(255,177,45,.16)'}; color:${isDone ? '#4ADE80' : '#FFC15F'};">${isDone ? doneCheck : ''}</span>
                <span class="dash-deliverable-title">${escapeHtml(d.title)}${d.due_date ? ` <span style="color:#7a7a7a; font-weight:400;">· vence ${formatDate(d.due_date)}</span>` : ''}</span>
                <span class="dash-badge ${isDone ? 'dash-badge--done' : 'dash-badge--pending'}">${DELIVERABLE_STATUS_LABELS[d.status] || d.status}</span>
                ${d.external_link ? `<a href="${escapeHtml(d.external_link)}" target="_blank" rel="noopener" class="dash-btn-outline" title="Abrir enlace externo" style="text-decoration:none;">${linkIcon} Ver enlace</a>` : ''}
                ${canDecide ? `
                    <div style="display:flex; gap:8px; width:100%; margin-top:4px;">
                        <button type="button" class="dash-task-mark-btn" data-approve-deliverable="${d.id}">Aprobar</button>
                        <button type="button" class="dash-btn-outline" data-reject-deliverable="${d.id}">Rechazar</button>
                    </div>` : ''}
            </div>
        `;
    }).join('');

    list.querySelectorAll('[data-approve-deliverable]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
                await decideDeliverable(btn.getAttribute('data-approve-deliverable'), 'approved');
                await refreshAll();
            } catch (error) {
                alert(`No se pudo actualizar el entregable: ${error.message}`);
                btn.disabled = false;
            }
        });
    });

    list.querySelectorAll('[data-reject-deliverable]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
                await decideDeliverable(btn.getAttribute('data-reject-deliverable'), 'rejected');
                await refreshAll();
            } catch (error) {
                alert(`No se pudo actualizar el entregable: ${error.message}`);
                btn.disabled = false;
            }
        });
    });
}

/* ---------------------------------------------------------
   Actividad reciente (vista corta en Resumen)
--------------------------------------------------------- */
function renderActivityPreview(events) {
    const list = el('pdActivityList');
    if (!events.length) {
        list.innerHTML = '<span style="color:#6a6a6a; font-size:12px;">Sin actividad todavía.</span>';
        return;
    }
    list.innerHTML = events.slice(0, 6).map((event) => `
        <div class="dash-activity-item">
            <span class="dash-activity-avatar">${getInitials(event.profiles?.full_name)}</span>
            <div>
                <span class="dash-activity-text">${escapeHtml(event.description)}</span>
                <span class="dash-activity-time">${formatDateTime(event.created_at)}</span>
            </div>
        </div>
    `).join('');
}

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
