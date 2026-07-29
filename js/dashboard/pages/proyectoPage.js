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
    formatDate, formatDateTime, getInitials, escapeHtml, daysRemaining,
    getTaskResponsibleMeta
} from '../../components/projectUi.js';
import { mountProjectDriveCard } from '../../components/drive/ProjectDriveCard.js';

const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');

const mainEl = document.getElementById('projectDetailMain');
const loadingEl = document.getElementById('projectDetailLoadingState');

let currentUserId = null;
let currentProject = null;
let currentStructure = null;
let currentDeliverables = [];

/** Etapa activa en la línea de tiempo (navegador principal). */
let selectedStageId = null;
let stageSwitchTimer = null;

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
    currentDeliverables = await listProjectDeliverables(projectId);
    const comments = await listComments(projectId, 'project', projectId);
    const events = await listTimelineEvents(projectId);

    ensureSelectedStage(currentStructure.stages, currentStructure.unassignedPhases);

    renderHeader(currentProject);
    mountProjectDriveCard(document.getElementById('pdDriveRoot'), {
        project: currentProject,
        mode: 'client',
        onProjectChange: (updated) => {
            currentProject = { ...currentProject, ...updated };
        }
    });
    renderStageProgress(currentStructure.stages);
    renderTimelineChips(currentStructure.stages);
    renderPhases(currentStructure.stages, currentStructure.unassignedPhases, { animate: false });
    renderStageScopedPanels();
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

function ensureSelectedStage(stages, unassignedPhases) {
    const stageIds = (stages || []).map((s) => s.id);
    if (selectedStageId && stageIds.includes(selectedStageId)) return;
    if (selectedStageId === '__unassigned__' && (unassignedPhases || []).length) return;
    if (stageIds.length) {
        selectedStageId = stageIds[0];
        return;
    }
    if ((unassignedPhases || []).length) {
        selectedStageId = '__unassigned__';
        return;
    }
    selectedStageId = null;
}

function selectStage(stageId) {
    if (!stageId || stageId === selectedStageId) return;
    if (!currentStructure) return;

    selectedStageId = stageId;
    updateTimelineActiveState();
    updateProgressActiveState();
    renderPhases(currentStructure.stages, currentStructure.unassignedPhases, { animate: true });
    renderStageScopedPanels();
}

function getTasksForSelectedStage() {
    if (!currentStructure) return [];
    let phases = [];
    if (selectedStageId === '__unassigned__') {
        phases = currentStructure.unassignedPhases || [];
    } else {
        const stage = (currentStructure.stages || []).find((s) => s.id === selectedStageId);
        phases = stage?.phases || [];
    }
    const tasks = [];
    phases.forEach((phase) => {
        (phase.sections || []).forEach((section) => {
            (section.tasks || []).forEach((task) => tasks.push(task));
        });
    });
    return tasks;
}

function getDeliverablesForSelectedStage() {
    const all = currentDeliverables || [];
    if (selectedStageId === '__unassigned__') {
        return all.filter((d) => !d.timeline_stage_id);
    }
    return all.filter((d) => d.timeline_stage_id === selectedStageId);
}

function collectStageTaskStats(stage) {
    let total = 0;
    let done = 0;
    (stage?.phases || []).forEach((phase) => {
        (phase.sections || []).forEach((section) => {
            (section.tasks || []).forEach((task) => {
                total += 1;
                if (['completed', 'finished', 'approved'].includes(task.status)) done += 1;
            });
        });
    });
    return { total, done, pending: Math.max(0, total - done) };
}

function collectStageDeliverableStats(stageId) {
    const list = (currentDeliverables || []).filter((d) => d.timeline_stage_id === stageId);
    const delivered = list.filter((d) => d.status === 'delivered' || d.status === 'approved').length;
    return { total: list.length, delivered, pending: Math.max(0, list.length - delivered) };
}

function renderStageScopedPanels() {
    renderMyTasks(getTasksForSelectedStage());
    renderDeliverables(getDeliverablesForSelectedStage());
}

function updateTimelineActiveState() {
    document.querySelectorAll('#pdTimelineTrack .dash-timeline-chip[data-stage-id]').forEach((chip) => {
        chip.classList.toggle('is-active', chip.getAttribute('data-stage-id') === selectedStageId);
    });
}

function updateProgressActiveState() {
    document.querySelectorAll('#pdStageProgressList [data-select-stage]').forEach((item) => {
        item.classList.toggle('is-active', item.getAttribute('data-select-stage') === selectedStageId);
    });
}

function renderStageProgress(stages) {
    const list = el('pdStageProgressList');
    if (!stages.length) {
        list.innerHTML = '<span style="color:#6a6a6a; font-size:12px;">Sin etapas todavía.</span>';
        return;
    }
    list.innerHTML = stages.map((stage, idx) => `
        <button type="button" class="dash-stage-progress-item ${selectedStageId === stage.id ? 'is-active' : ''}" data-select-stage="${stage.id}">
            <span class="dash-stage-progress-code" style="--stage-color:${escapeHtml(stage.color_hex)}">A${idx + 1}</span>
            <span class="dash-stage-progress-name">${escapeHtml(stage.name)}</span>
            <span class="dash-stage-progress-percent">${stage.progress_percent || 0}%</span>
        </button>
    `).join('');

    list.querySelectorAll('[data-select-stage]').forEach((btn) => {
        btn.addEventListener('click', () => selectStage(btn.getAttribute('data-select-stage')));
    });
}

function renderTimelineChips(stages) {
    const track = el('pdTimelineTrack');
    const unassigned = currentStructure?.unassignedPhases || [];

    if (!stages.length && !unassigned.length) {
        track.innerHTML = '<span style="color:#6a6a6a; font-size:12px;">Sin etapas todavía.</span>';
        return;
    }

    track.innerHTML = stages.map((stage, idx) => {
        const taskStats = collectStageTaskStats(stage);
        const delivStats = collectStageDeliverableStats(stage.id);
        return `
        <div class="dash-timeline-chip ${selectedStageId === stage.id ? 'is-active' : ''}" data-stage-id="${stage.id}" style="--stage-color:${escapeHtml(stage.color_hex)}" role="button" tabindex="0">
            <div class="dash-timeline-chip-top">
                <span class="dash-timeline-chip-num">${idx + 1}</span>
                <span class="dash-timeline-chip-name">${escapeHtml(stage.name)}</span>
            </div>
            <span class="dash-timeline-chip-sub">${stage.progress_percent || 0}% · ${PROGRESS_STATUS_LABELS[stage.status] || stage.status}</span>
            <div class="dash-timeline-chip-stats">
                <span>${taskStats.total} tarea${taskStats.total === 1 ? '' : 's'}</span>
                <span>${taskStats.done} completada${taskStats.done === 1 ? '' : 's'}</span>
                <span>${taskStats.pending} pendiente${taskStats.pending === 1 ? '' : 's'}</span>
                <span>${delivStats.total} entregable${delivStats.total === 1 ? '' : 's'}</span>
                <span>${delivStats.delivered} entregado${delivStats.delivered === 1 ? '' : 's'}</span>
                <span>${delivStats.pending} pend. entreg.</span>
            </div>
        </div>`;
    }).join('') + (unassigned.length ? `
        <div class="dash-timeline-chip ${selectedStageId === '__unassigned__' ? 'is-active' : ''}" data-stage-id="__unassigned__" style="--stage-color:#8a8a8a" role="button" tabindex="0">
            <div class="dash-timeline-chip-top">
                <span class="dash-timeline-chip-num">·</span>
                <span class="dash-timeline-chip-name">Sin etapa</span>
            </div>
            <span class="dash-timeline-chip-sub">${unassigned.length} bloque${unassigned.length === 1 ? '' : 's'}</span>
        </div>
    ` : '');

    track.querySelectorAll('.dash-timeline-chip[data-stage-id]').forEach((chip) => {
        const activate = () => selectStage(chip.getAttribute('data-stage-id'));
        chip.addEventListener('click', activate);
        chip.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
            }
        });
    });
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
   Bloques / Secciones / Tareas — solo la etapa seleccionada
--------------------------------------------------------- */
function renderPhases(stages, unassignedPhases, { animate = false } = {}) {
    const list = el('phaseList');
    const emptyState = el('phasesEmptyState');
    if (!list) return;

    const paint = () => {
        ensureSelectedStage(stages, unassignedPhases);

        let stage = null;
        let phases = [];

        if (selectedStageId === '__unassigned__') {
            phases = (unassignedPhases || []).map((p) => ({ ...p, stageColor: '#8a8a8a' }));
        } else {
            stage = (stages || []).find((s) => s.id === selectedStageId) || null;
            phases = (stage?.phases || []).map((p) => ({ ...p, stageColor: stage.color_hex }));
        }

        if (!phases.length && !(stages || []).length && !(unassignedPhases || []).length) {
            list.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        if (emptyState) emptyState.style.display = 'none';

        const stageLabel = stage
            ? escapeHtml(stage.name)
            : (selectedStageId === '__unassigned__' ? 'Sin etapa' : '');

        list.innerHTML = `
            ${stage || selectedStageId === '__unassigned__' ? `
                <div class="dash-stage-panel-header">
                    <div>
                        <span class="dash-stage-panel-eyebrow">Etapa activa</span>
                        <h3 class="dash-stage-panel-title" ${stage ? `style="--stage-color:${escapeHtml(stage.color_hex)}"` : ''}>${stageLabel}</h3>
                    </div>
                    ${stage ? `<span class="dash-badge ${DASH_BADGE_CLASS[stage.status] || 'dash-badge--pending'}">${PROGRESS_STATUS_LABELS[stage.status] || stage.status} — ${stage.progress_percent || 0}%</span>` : ''}
                </div>
            ` : ''}
            ${phases.map((phase) => `
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
            `).join('') || '<span class="dash-empty-inline">Esta etapa todavía no tiene bloques.</span>'}
        `;

        wireTaskActions();
        updateTimelineActiveState();
        updateProgressActiveState();
    };

    if (!animate) {
        paint();
        return;
    }

    if (stageSwitchTimer) clearTimeout(stageSwitchTimer);
    list.classList.remove('dash-stage-panel--enter');
    list.classList.add('dash-stage-panel--leave');
    stageSwitchTimer = setTimeout(() => {
        paint();
        list.classList.remove('dash-stage-panel--leave');
        list.classList.add('dash-stage-panel--enter');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => list.classList.remove('dash-stage-panel--enter'));
        });
    }, 180);
}

function renderTaskCard(task, idx) {
    const approval = task.approvals?.[0] || task.approvals;
    let actionHtml = '';
    const meta = getTaskResponsibleMeta(task, currentProject);
    const badgeClass = meta.isClient ? 'dash-task-type-badge--client' : 'dash-task-type-badge--nexa';
    const displayName = meta.isClient && currentUserId && meta.assigneeId === currentUserId
        ? 'Tú'
        : meta.name;

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
        <div class="dash-task-card ${meta.cardClass}">
            <div class="dash-task-card-top">
                <span class="dash-task-card-code">1.${idx + 1}</span>
                <span class="dash-task-card-title">${escapeHtml(task.title)}</span>
                <span class="dash-task-type-badge ${badgeClass}">${meta.badgeLabel}</span>
            </div>
            <span class="dash-badge ${DASH_BADGE_CLASS[task.status] || 'dash-badge--pending'}" style="align-self:flex-start;">${PROGRESS_STATUS_LABELS[task.status] || task.status}</span>
            ${task.description ? `<p class="dash-task-card-desc">${escapeHtml(task.description)}</p>` : ''}
            <div class="dash-task-card-footer">
                <div class="dash-task-avatar-row">
                    <span class="dash-task-avatar">${getInitials(displayName)}</span>
                    <span class="dash-task-avatar-name">${escapeHtml(displayName)}${task.due_date ? ` · ${formatDate(task.due_date)}` : ''}</span>
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
        emptyState.textContent = 'No tienes tareas en esta etapa.';
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
