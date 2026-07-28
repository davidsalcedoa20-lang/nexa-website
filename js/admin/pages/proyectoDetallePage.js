/* ==========================================================
   NEXA HUB — Página: Detalle de Proyecto (admin/proyecto-detalle.html)
   ==========================================================
   Vista "Plantilla Oficial": Proyecto -> Etapas (línea de tiempo)
   -> Bloques -> Secciones -> Tareas. El administrador puede
   editar absolutamente todo desde esta página.
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import { getProject, getProjectStructure, duplicateProject, updateProject, setProjectStatus, archiveProject } from '../../services/projectService.js';
import { createPhase, updatePhase, deletePhase, createSection, updateSection, deleteSection } from '../../services/phaseService.js';
import { createStage, updateStage, deleteStage } from '../../services/timelineStageService.js';
import { createTask, updateTask, deleteTask, ensureApprovalRecord } from '../../services/taskService.js';
import { listComments, addComment } from '../../services/commentService.js';
import { listTimelineEvents } from '../../services/timelineService.js';
import { listProjectDeliverables, createDeliverable, updateDeliverable, deleteDeliverable } from '../../services/deliverableService.js';
import { listAdmins } from '../../services/profileService.js';
import {
    PROJECT_STATUS_LABELS, PROGRESS_STATUS_LABELS, PD_STATUS_BADGE_CLASS,
    TASK_TYPE_LABELS, TASK_PRIORITY_LABELS, DELIVERABLE_STATUS_LABELS, TIMELINE_EVENT_ICONS,
    formatDate, formatDateTime, getInitials, escapeHtml, daysRemaining,
    getProjectClientProfile, populateResponsibleSelect, resolveTaskAssignment, getTaskResponsibleMeta
} from '../../components/projectUi.js';

// Valores reales del enum public.progress_status (project_tasks.status).
// "approved"/"cancelled" NO existen en este enum (son solo estados válidos
// para approvals.decision / projects.status respectivamente); usarlos aquí
// provocaría un error de Postgres al guardar.
const TASK_STATUS_OPTIONS = ['pending', 'in_progress', 'waiting_approval', 'completed', 'blocked', 'finished'];

const params = new URLSearchParams(window.location.search);
const projectId = params.get('id');

const mainEl = document.getElementById('projectDetailMain');
const loadingEl = document.getElementById('projectDetailLoadingState');

let currentUserId = null;
let admins = [];
let currentProject = null;
let currentStructure = null;
let currentDeliverables = [];
let currentEvents = [];

/** Etapa activa en la línea de tiempo (navegador principal). */
let selectedStageId = null;
let stageSwitchTimer = null;

let activeStageIdForPhase = null;
let activePhaseIdForSection = null;
let activeSectionIdForTask = null;
let editingStageId = null;
let editingPhaseId = null;
let editingSectionId = null;
let editingDeliverableId = null;
let activeTaskId = null;

const ICON_PENCIL = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

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
        populateSelect(el('stageResponsible'), admins, 'Sin asignar');
        populateSelect(el('editProjectResponsible'), admins, 'Sin asignar');
        populateTaskStatusSelect(el('taskDetailStatus'));
        refreshResponsibleSelectors();

        await refreshAll();
        loadingEl.style.display = 'none';
        mainEl.style.display = 'flex';
    } catch (error) {
        console.error('[proyectoDetallePage] Error cargando proyecto:', error.message);
        loadingEl.innerHTML = `<span>No se pudo cargar el proyecto: ${escapeHtml(error.message)}</span>`;
    }
}

function refreshResponsibleSelectors(selectedId = '') {
    const client = getProjectClientProfile(currentProject);
    populateResponsibleSelect(el('taskAssignee'), {
        client,
        admins,
        emptyLabel: 'Selecciona un responsable',
        selectedId
    });
    populateResponsibleSelect(el('taskDetailAssignee'), {
        client,
        admins,
        emptyLabel: 'Selecciona un responsable',
        selectedId
    });
    syncApprovalFieldVisibility('taskAssignee', 'taskApprovalField', 'taskRequiresApproval');
    syncApprovalFieldVisibility('taskDetailAssignee', 'taskDetailApprovalField', 'taskDetailRequiresApproval');
}

function syncApprovalFieldVisibility(assigneeSelectId, fieldId, checkboxId) {
    const select = el(assigneeSelectId);
    const field = el(fieldId);
    if (!select || !field) return;
    const client = getProjectClientProfile(currentProject);
    const isClient = !!(client?.id && select.value === client.id);
    field.style.display = isClient ? 'flex' : 'none';
    if (!isClient && el(checkboxId)) el(checkboxId).checked = false;
}

function populateSelect(select, items, emptyLabel) {
    if (!select) return;
    select.innerHTML = `<option value="">${emptyLabel}</option>` +
        items.map((a) => `<option value="${a.id}">${escapeHtml(a.full_name || a.email)}</option>`).join('');
}

function populateTaskStatusSelect(select) {
    if (!select) return;
    select.innerHTML = TASK_STATUS_OPTIONS
        .map((status) => `<option value="${status}">${PROGRESS_STATUS_LABELS[status]}</option>`)
        .join('');
}

async function refreshAll() {
    currentProject = await getProject(projectId);
    currentStructure = await getProjectStructure(projectId);
    currentDeliverables = await listProjectDeliverables(projectId);
    currentEvents = await listTimelineEvents(projectId);
    const comments = await listComments(projectId, 'project', projectId);

    ensureSelectedStage(currentStructure.stages, currentStructure.unassignedPhases);
    refreshResponsibleSelectors();

    renderHeader(currentProject);
    renderProgressCards(currentProject, currentStructure.stages);
    renderTimeline(currentStructure.stages);
    renderBlocks(currentStructure.stages, currentStructure.unassignedPhases, { animate: false });
    renderTasksByResponsible(currentStructure.allTasks, currentProject);
    renderDeliverables(currentDeliverables);
    renderActivity(currentEvents);
    renderFullTimeline(currentEvents);
    renderComments(comments);
    renderFooterBar(currentProject);
}

/* ---------------------------------------------------------
   Header
--------------------------------------------------------- */
function renderHeader(project) {
    const clientName = project.workspaces?.profiles?.full_name || project.workspaces?.name || 'Sin cliente';
    document.title = `${project.name} | NEXA Hub`;
    el('pdBreadcrumbName').textContent = project.name;

    const titleEl = el('pdTitle');
    const primaryColor = project.color_hex || project.project_types?.color_hex || '#2D8CFF';
    const secondaryColor = project.secondary_color_hex || '#FF8A3D';
    titleEl.style.setProperty('--project-color', primaryColor);
    titleEl.style.setProperty('--project-color-2', secondaryColor);

    if (project.name.includes(' + ')) {
        const [first, ...rest] = project.name.split(' + ');
        titleEl.innerHTML = `<span class="pd-title-part">${escapeHtml(first)}</span><span class="pd-title-sep">+</span><span class="pd-title-part pd-title-part--secondary">${escapeHtml(rest.join(' + '))}</span>`;
    } else {
        titleEl.innerHTML = `<span class="pd-title-part">${escapeHtml(project.name)}</span>`;
    }

    el('pdDescription').textContent = project.description || 'Sin descripción.';
    el('pdMetaClient').textContent = clientName;
    el('pdMetaModality').textContent = project.modality || 'Sin definir';
    el('pdMetaStart').textContent = formatDate(project.start_date);
    el('pdMetaEnd').textContent = formatDate(project.end_date);

    [el('pdEditProjectBtn'), el('pdEditProjectBtn2')].forEach((btn) => {
        btn.onclick = () => openEditProjectModal(project);
    });

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

function renderFooterBar(project) {
    const responsibleName = admins.find((a) => a.id === project.responsible_id)?.full_name
        || project.responsible?.full_name || 'Sin asignar';
    el('pdFooterResponsible').textContent = responsibleName;
    el('pdFooterUpdated').textContent = formatDateTime(project.updated_at || project.created_at);

    const isActive = project.status === 'in_progress' && !project.archived_at;
    el('pdStatusDot').style.background = isActive ? '#4ADE80' : '#8a8a8a';
    el('pdStatusDot').style.boxShadow = isActive ? '0 0 8px rgba(74,222,128,.6)' : 'none';
    el('pdStatusLabel').textContent = project.archived_at
        ? 'Proyecto archivado'
        : `Proyecto ${(PROJECT_STATUS_LABELS[project.status] || project.status).toLowerCase()}`;
}

/* ---------------------------------------------------------
   Progreso general + por etapa
--------------------------------------------------------- */
function renderProgressCards(project, stages) {
    el('pdOverallProgressBig').textContent = `${project.progress_percent || 0}%`;
    el('pdOverallProgressBar').style.width = `${project.progress_percent || 0}%`;

    const remaining = daysRemaining(project.end_date);
    el('pdDaysRemaining').textContent = remaining === null
        ? ''
        : remaining >= 0 ? `Entrega en ${remaining} día${remaining === 1 ? '' : 's'}` : `Entrega vencida hace ${Math.abs(remaining)} día${Math.abs(remaining) === 1 ? '' : 's'}`;

    const list = el('pdStageProgressList');
    if (!stages.length) {
        list.innerHTML = '<span style="color:#6a6a6a; font-size:12px;">Sin etapas todavía.</span>';
        return;
    }
    list.innerHTML = stages.map((stage, idx) => `
        <button type="button" class="pd-stage-progress-item ${selectedStageId === stage.id ? 'is-active' : ''}" data-select-stage="${stage.id}">
            <span class="pd-stage-progress-code" style="--stage-color:${escapeHtml(stage.color_hex)}">A${idx + 1}</span>
            <span class="pd-stage-progress-name">${escapeHtml(stage.name)}</span>
            <span class="pd-stage-progress-percent">${stage.progress_percent || 0}%</span>
        </button>
    `).join('');

    list.querySelectorAll('[data-select-stage]').forEach((btn) => {
        btn.addEventListener('click', () => selectStage(btn.getAttribute('data-select-stage')));
    });
}

/* ---------------------------------------------------------
   Línea de tiempo (etapas) — navegador principal del proyecto
--------------------------------------------------------- */
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
    renderBlocks(currentStructure.stages, currentStructure.unassignedPhases, { animate: true });
}

function updateTimelineActiveState() {
    document.querySelectorAll('#pdTimelineTrack .pd-timeline-chip[data-stage-id]').forEach((chip) => {
        chip.classList.toggle('is-active', chip.getAttribute('data-stage-id') === selectedStageId);
    });
}

function updateProgressActiveState() {
    document.querySelectorAll('#pdStageProgressList [data-select-stage]').forEach((item) => {
        item.classList.toggle('is-active', item.getAttribute('data-select-stage') === selectedStageId);
    });
}

function renderTimeline(stages) {
    const track = el('pdTimelineTrack');
    const unassigned = currentStructure?.unassignedPhases || [];

    track.innerHTML = stages.map((stage, idx) => `
        <div class="pd-timeline-chip ${selectedStageId === stage.id ? 'is-active' : ''}" data-stage-id="${stage.id}" style="--stage-color:${escapeHtml(stage.color_hex)}" role="button" tabindex="0">
            <div class="pd-timeline-chip-top">
                <span class="pd-timeline-chip-num">${idx + 1}</span>
                <span class="pd-timeline-chip-name">${escapeHtml(stage.name)}</span>
                <button type="button" class="pd-timeline-chip-edit" data-edit-stage="${stage.id}" title="Editar etapa">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
                </button>
            </div>
            <span class="pd-timeline-chip-sub">${stage.progress_percent || 0}% · ${(PROGRESS_STATUS_LABELS[stage.status] || stage.status)}</span>
        </div>
    `).join('') + (unassigned.length ? `
        <div class="pd-timeline-chip ${selectedStageId === '__unassigned__' ? 'is-active' : ''}" data-stage-id="__unassigned__" style="--stage-color:#8a8a8a" role="button" tabindex="0">
            <div class="pd-timeline-chip-top">
                <span class="pd-timeline-chip-num">·</span>
                <span class="pd-timeline-chip-name">Sin etapa</span>
            </div>
            <span class="pd-timeline-chip-sub">${unassigned.length} bloque${unassigned.length === 1 ? '' : 's'}</span>
        </div>
    ` : '') + `
        <button type="button" class="pd-timeline-add-chip" id="pdAddStageChipBtn">
            <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Nueva etapa
        </button>
    `;

    track.querySelectorAll('.pd-timeline-chip[data-stage-id]').forEach((chip) => {
        const activate = () => selectStage(chip.getAttribute('data-stage-id'));
        chip.addEventListener('click', (e) => {
            if (e.target.closest('[data-edit-stage]')) return;
            activate();
        });
        chip.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
            }
        });
    });

    track.querySelectorAll('[data-edit-stage]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const stage = stages.find((s) => s.id === btn.getAttribute('data-edit-stage'));
            if (stage) openStageModal(stage);
        });
    });

    el('pdAddStageChipBtn')?.addEventListener('click', () => openStageModal(null));
}

/* ---------------------------------------------------------
   Bloques / Secciones / Tareas — solo la etapa seleccionada
--------------------------------------------------------- */
function renderBlocks(stages, unassignedPhases, { animate = false } = {}) {
    const list = el('pdBlocksList');
    const emptyState = el('pdBlocksEmptyState');
    if (!list) return;

    const paint = () => {
        ensureSelectedStage(stages, unassignedPhases);

        let stage = null;
        let phases = [];

        if (selectedStageId === '__unassigned__') {
            phases = unassignedPhases || [];
        } else {
            stage = (stages || []).find((s) => s.id === selectedStageId) || null;
            phases = stage?.phases || [];
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
                <div class="pd-stage-panel-header">
                    <div>
                        <span class="pd-stage-panel-eyebrow">Etapa activa</span>
                        <h3 class="pd-stage-panel-title" ${stage ? `style="--stage-color:${escapeHtml(stage.color_hex)}"` : ''}>${stageLabel}</h3>
                    </div>
                    ${stage ? `<span class="pd-badge ${PD_STATUS_BADGE_CLASS[stage.status] || 'pd-badge--pending'}">${PROGRESS_STATUS_LABELS[stage.status] || stage.status} — ${stage.progress_percent || 0}%</span>` : ''}
                </div>
            ` : ''}
            ${phases.map((phase) => renderPhaseCard(phase, stage)).join('') || '<span class="admin-empty-inline">Esta etapa todavía no tiene bloques.</span>'}
            <button type="button" class="pd-timeline-add-chip" style="align-self:flex-start; padding:10px 18px;" data-add-phase-to-stage="${stage ? stage.id : ''}">
                <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                Nuevo bloque ${stage ? `en "${escapeHtml(stage.name)}"` : ''}
            </button>
        `;

        wireBlockEvents();
        updateTimelineActiveState();
        updateProgressActiveState();
    };

    if (!animate) {
        paint();
        return;
    }

    if (stageSwitchTimer) clearTimeout(stageSwitchTimer);
    list.classList.remove('pd-stage-panel--enter');
    list.classList.add('pd-stage-panel--leave');
    stageSwitchTimer = setTimeout(() => {
        paint();
        list.classList.remove('pd-stage-panel--leave');
        list.classList.add('pd-stage-panel--enter');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => list.classList.remove('pd-stage-panel--enter'));
        });
    }, 180);
}

function renderPhaseCard(phase, stage) {
    const stageColor = stage?.color_hex || '#2D8CFF';
    return `
        <div class="pd-block" data-phase-id="${phase.id}">
            <div class="pd-block-header">
                <div class="pd-block-header-main">
                    <div class="pd-block-title">
                        <span class="pd-block-title-dot" style="--stage-color:${escapeHtml(stageColor)}"></span>
                        <strong>${escapeHtml(phase.name)}</strong>
                        <button type="button" class="admin-icon-btn pd-inline-edit-btn" data-edit-phase="${phase.id}" title="Editar bloque">${ICON_PENCIL}</button>
                        <span class="pd-badge ${PD_STATUS_BADGE_CLASS[phase.status] || 'pd-badge--pending'}">${(PROGRESS_STATUS_LABELS[phase.status] || phase.status)} — ${phase.progress_percent || 0}%</span>
                    </div>
                    ${phase.description ? `<span class="pd-block-desc">${escapeHtml(phase.description)}</span>` : ''}
                </div>
                <div class="pd-block-header-actions">
                    <button type="button" class="admin-icon-btn" data-add-section="${phase.id}" title="Agregar sección">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </button>
                    <button type="button" class="admin-icon-btn danger" data-delete-phase title="Eliminar bloque">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                </div>
            </div>
            <div class="pd-block-body">
                ${(phase.sections || []).map((section) => renderSectionGroup(section)).join('') || '<span class="admin-empty-inline">Este bloque todavía no tiene secciones.</span>'}
            </div>
        </div>
    `;
}

function renderSectionGroup(section) {
    const color = section.color_hex || '#2D8CFF';
    return `
        <div class="pd-section-group" data-section-id="${section.id}">
            <div class="pd-section-group-header">
                <span class="pd-section-group-dot" style="--section-color:${escapeHtml(color)}"></span>
                <span class="pd-section-group-name">${escapeHtml(section.name)}</span>
                ${section.handle ? `<span class="pd-section-group-handle">—@${escapeHtml(section.handle)}</span>` : ''}
                <div class="pd-section-group-actions">
                    <button type="button" class="admin-icon-btn" data-edit-section="${section.id}" title="Editar sección">${ICON_PENCIL}</button>
                    <button type="button" class="admin-icon-btn danger" data-delete-section title="Eliminar sección">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
            </div>
            <div class="pd-task-grid">
                ${(section.tasks || []).map((task, idx) => renderTaskCard(task, idx)).join('')}
                <button type="button" class="pd-add-task-card" data-add-task="${section.id}">
                    <svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    Nueva tarea
                </button>
            </div>
        </div>
    `;
}

function renderTaskCard(task, idx) {
    const meta = getTaskResponsibleMeta(task, currentProject);
    const badgeClass = meta.isClient ? 'pd-task-type-badge--client' : 'pd-task-type-badge--nexa';

    return `
        <button type="button" class="pd-task-card ${meta.cardClass}" data-task-id="${task.id}">
            <div class="pd-task-card-top">
                <span class="pd-task-card-code">1.${idx + 1}</span>
                <span class="pd-task-card-title">${escapeHtml(task.title)}</span>
                <span class="pd-task-type-badge ${badgeClass}">${meta.badgeLabel}</span>
            </div>
            <span class="pd-badge ${PD_STATUS_BADGE_CLASS[task.status] || 'pd-badge--pending'}" style="align-self:flex-start;">${PROGRESS_STATUS_LABELS[task.status] || task.status}</span>
            ${task.description ? `<p class="pd-task-card-desc">${escapeHtml(task.description)}</p>` : ''}
            <div class="pd-task-card-footer">
                <div class="pd-task-avatar-row">
                    <span class="pd-task-avatar">${getInitials(meta.name)}</span>
                    <span class="pd-task-avatar-name">${escapeHtml(meta.name)}</span>
                </div>
            </div>
        </button>
    `;
}

function wireBlockEvents() {
    document.querySelectorAll('[data-add-phase-to-stage]').forEach((btn) => {
        btn.addEventListener('click', () => {
            activeStageIdForPhase = btn.getAttribute('data-add-phase-to-stage') || null;
            openPhaseModal(null);
        });
    });

    document.querySelectorAll('[data-edit-phase]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const phaseId = btn.getAttribute('data-edit-phase');
            const phase = (currentStructure?.allPhases || []).find((p) => p.id === phaseId);
            if (phase) openPhaseModal(phase);
        });
    });

    document.querySelectorAll('[data-delete-phase]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const phaseId = btn.closest('.pd-block').dataset.phaseId;
            if (!window.confirm('¿Eliminar este bloque y todo su contenido (secciones y tareas)?')) return;
            try {
                await deletePhase(phaseId);
                await refreshAll();
            } catch (error) {
                alert(`No se pudo eliminar: ${error.message}`);
            }
        });
    });

    document.querySelectorAll('[data-add-section]').forEach((btn) => {
        btn.addEventListener('click', () => {
            activePhaseIdForSection = btn.getAttribute('data-add-section');
            openSectionModal(null);
        });
    });

    document.querySelectorAll('[data-edit-section]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sectionId = btn.getAttribute('data-edit-section');
            const section = findSectionById(sectionId);
            if (section) openSectionModal(section);
        });
    });

    document.querySelectorAll('[data-delete-section]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const sectionId = btn.closest('.pd-section-group').dataset.sectionId;
            if (!window.confirm('¿Eliminar esta sección y sus tareas?')) return;
            try {
                await deleteSection(sectionId);
                await refreshAll();
            } catch (error) {
                alert(`No se pudo eliminar: ${error.message}`);
            }
        });
    });

    document.querySelectorAll('[data-add-task]').forEach((btn) => {
        btn.addEventListener('click', () => {
            activeSectionIdForTask = btn.getAttribute('data-add-task');
            refreshResponsibleSelectors();
            if (el('taskRequiresApproval')) el('taskRequiresApproval').checked = false;
            openModal('taskModalOverlay');
        });
    });

    document.querySelectorAll('[data-task-id]').forEach((card) => {
        card.addEventListener('click', () => openTaskDetailModal(card.dataset.taskId));
    });
}

function findSectionById(sectionId) {
    for (const phase of (currentStructure?.allPhases || [])) {
        const section = (phase.sections || []).find((s) => s.id === sectionId);
        if (section) return section;
    }
    return null;
}

function openPhaseModal(phase) {
    editingPhaseId = phase?.id || null;
    el('phaseModalTitle').textContent = phase ? 'Editar Bloque' : 'Nuevo Bloque';
    el('phaseFormSubmitBtn').textContent = phase ? 'Guardar cambios' : 'Crear Bloque';
    el('phaseName').value = phase?.name || '';
    el('phaseDuration').value = phase?.duration_days || '';
    el('phaseDescription').value = phase?.description || '';
    el('phaseFormError').textContent = '';
    el('phaseFormError').classList.remove('active');
    openModal('phaseModalOverlay');
}

function openSectionModal(section) {
    editingSectionId = section?.id || null;
    if (section) activePhaseIdForSection = section.phase_id || activePhaseIdForSection;
    el('sectionModalTitle').textContent = section ? 'Editar Sección' : 'Nueva Sección';
    el('sectionFormSubmitBtn').textContent = section ? 'Guardar cambios' : 'Crear Sección';
    el('sectionName').value = section?.name || '';
    el('sectionHandle').value = section?.handle || '';
    el('sectionColor').value = section?.color_hex || '#2D8CFF';
    el('sectionFormError').textContent = '';
    el('sectionFormError').classList.remove('active');
    openModal('sectionModalOverlay');
}

/* ---------------------------------------------------------
   Tareas agrupadas por responsable (panel inferior)
--------------------------------------------------------- */
function renderTasksByResponsible(tasks, project) {
    const container = el('pdTasksByResponsible');
    if (!tasks.length) {
        container.innerHTML = '<span style="color:#6a6a6a; font-size:12px;">Sin tareas todavía.</span>';
        return;
    }

    const nexaGroups = new Map();
    const clientGroups = new Map();

    tasks.forEach((task) => {
        const meta = getTaskResponsibleMeta(task, project);
        const target = meta.isClient ? clientGroups : nexaGroups;
        const key = meta.assigneeId || (meta.isClient ? 'client' : 'unassigned');
        if (!target.has(key)) {
            target.set(key, { label: meta.name, tasks: [] });
        }
        target.get(key).tasks.push(task);
    });

    const renderColumn = (title, badgeClass, groups) => `
        <div class="pd-tasks-split-column">
            <div class="pd-tasks-split-header">
                <span class="pd-task-type-badge ${badgeClass}">${title}</span>
                <span class="pd-tasks-split-count">${[...groups.values()].reduce((n, g) => n + g.tasks.length, 0)}</span>
            </div>
            <div class="pd-tasks-split-body">
                ${groups.size ? [...groups.values()].map((group) => `
                    <div class="pd-task-responsible-group">
                        <span class="pd-task-responsible-header">${escapeHtml(group.label)}</span>
                        ${group.tasks.map((task) => `
                            <div class="pd-task-checkrow ${['completed', 'finished', 'approved'].includes(task.status) ? 'is-done' : ''}" data-task-id="${task.id}">
                                <span class="pd-badge ${PD_STATUS_BADGE_CLASS[task.status] || 'pd-badge--pending'}">${PROGRESS_STATUS_LABELS[task.status] || task.status}</span>
                                <span class="pd-task-checkrow-title">${escapeHtml(task.title)}</span>
                            </div>
                        `).join('')}
                    </div>
                `).join('') : '<span class="admin-empty-inline">Sin tareas.</span>'}
            </div>
        </div>
    `;

    container.innerHTML = `
        <div class="pd-tasks-split">
            ${renderColumn('NEXA', 'pd-task-type-badge--nexa', nexaGroups)}
            ${renderColumn('CLIENTE', 'pd-task-type-badge--client', clientGroups)}
        </div>
    `;

    container.querySelectorAll('[data-task-id]').forEach((row) => {
        row.addEventListener('click', () => openTaskDetailModal(row.dataset.taskId));
    });
}

/* ---------------------------------------------------------
   Modal: Nueva/Editar Etapa
--------------------------------------------------------- */
function openStageModal(stage) {
    editingStageId = stage?.id || null;
    el('stageModalTitle').textContent = stage ? 'Editar Etapa' : 'Nueva Etapa';
    el('stageFormSubmitBtn').textContent = stage ? 'Guardar cambios' : 'Crear Etapa';
    el('stageDeleteBtn').style.display = stage ? 'inline-flex' : 'none';
    el('stageName').value = stage?.name || '';
    el('stageColor').value = stage?.color_hex || '#2D8CFF';
    el('stageResponsible').value = stage?.responsible_id || '';
    el('stageEstimatedDate').value = stage?.estimated_date || '';
    el('stageDescription').value = stage?.description || '';
    el('stageFormError').textContent = '';
    el('stageFormError').classList.remove('active');
    openModal('stageModalOverlay');
}

el('stageForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el('stageName').value.trim();
    const errorEl = el('stageFormError');
    errorEl.classList.remove('active');
    if (!name) { errorEl.textContent = 'El nombre es obligatorio.'; errorEl.classList.add('active'); return; }

    const payload = {
        name,
        color_hex: el('stageColor').value,
        responsible_id: el('stageResponsible').value || null,
        estimated_date: el('stageEstimatedDate').value || null,
        description: el('stageDescription').value.trim() || null
    };

    try {
        if (editingStageId) {
            await updateStage(editingStageId, payload);
        } else {
            await createStage({ project_id: projectId, order_index: (currentStructure?.stages.length || 0), ...payload });
        }
        closeModal('stageModalOverlay');
        await refreshAll();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

el('stageDeleteBtn')?.addEventListener('click', async () => {
    if (!editingStageId) return;
    if (!window.confirm('¿Eliminar esta etapa? Los bloques que contiene quedarán sin etapa asignada.')) return;
    try {
        await deleteStage(editingStageId);
        closeModal('stageModalOverlay');
        await refreshAll();
    } catch (error) {
        alert(`No se pudo eliminar: ${error.message}`);
    }
});

/* ---------------------------------------------------------
   Modal: Nuevo / Editar Bloque
--------------------------------------------------------- */
el('phaseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el('phaseName').value.trim();
    const errorEl = el('phaseFormError');
    errorEl.classList.remove('active');
    if (!name) { errorEl.textContent = 'El nombre es obligatorio.'; errorEl.classList.add('active'); return; }

    const payload = {
        name,
        duration_days: Number(el('phaseDuration').value) || null,
        description: el('phaseDescription').value.trim() || null
    };

    try {
        if (editingPhaseId) {
            await updatePhase(editingPhaseId, payload);
        } else {
            await createPhase({
                project_id: projectId,
                timeline_stage_id: activeStageIdForPhase || null,
                ...payload
            });
        }
        closeModal('phaseModalOverlay');
        el('phaseForm').reset();
        editingPhaseId = null;
        await refreshAll();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

/* ---------------------------------------------------------
   Modal: Nueva / Editar Sección
--------------------------------------------------------- */
el('sectionForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el('sectionName').value.trim();
    const errorEl = el('sectionFormError');
    errorEl.classList.remove('active');
    if (!name) { errorEl.textContent = 'El nombre es obligatorio.'; errorEl.classList.add('active'); return; }
    if (!editingSectionId && !activePhaseIdForSection) {
        errorEl.textContent = 'El nombre es obligatorio.';
        errorEl.classList.add('active');
        return;
    }

    const payload = {
        name,
        handle: el('sectionHandle').value.trim() || null,
        color_hex: el('sectionColor').value || null
    };

    try {
        if (editingSectionId) {
            await updateSection(editingSectionId, payload);
        } else {
            await createSection({
                phase_id: activePhaseIdForSection,
                ...payload
            });
        }
        closeModal('sectionModalOverlay');
        el('sectionForm').reset();
        editingSectionId = null;
        await refreshAll();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

/* ---------------------------------------------------------
   Modal: Nueva Tarea
--------------------------------------------------------- */
el('taskAssignee')?.addEventListener('change', () => {
    syncApprovalFieldVisibility('taskAssignee', 'taskApprovalField', 'taskRequiresApproval');
});

el('taskDetailAssignee')?.addEventListener('change', () => {
    syncApprovalFieldVisibility('taskDetailAssignee', 'taskDetailApprovalField', 'taskDetailRequiresApproval');
});

el('taskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = el('taskTitle').value.trim();
    const errorEl = el('taskFormError');
    errorEl.classList.remove('active');
    if (!title || !activeSectionIdForTask) { errorEl.textContent = 'El título es obligatorio.'; errorEl.classList.add('active'); return; }

    const assigneeId = el('taskAssignee').value;
    if (!assigneeId) { errorEl.textContent = 'Selecciona un responsable.'; errorEl.classList.add('active'); return; }

    const client = getProjectClientProfile(currentProject);
    const assignment = resolveTaskAssignment(assigneeId, client?.id, {
        isApproval: !!el('taskRequiresApproval')?.checked
    });

    try {
        await createTask({
            section_id: activeSectionIdForTask,
            title,
            description: el('taskDescription').value.trim(),
            task_type: assignment.task_type,
            priority: el('taskPriority').value,
            assignee_id: assignment.assignee_id,
            due_date: el('taskDueDate').value || null,
            created_by: currentUserId
        });
        closeModal('taskModalOverlay');
        el('taskForm').reset();
        refreshResponsibleSelectors();
        await refreshAll();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

/* ---------------------------------------------------------
   Modal: Detalle de Tarea (edición + archivos + comentarios)
--------------------------------------------------------- */
function findTaskById(taskId) {
    return (currentStructure?.allTasks || []).find((t) => t.id === taskId);
}

async function openTaskDetailModal(taskId) {
    const task = findTaskById(taskId);
    if (!task) return;
    activeTaskId = taskId;

    const client = getProjectClientProfile(currentProject);
    const selectedAssignee = task.assignee_id
        || ((task.task_type === 'client' || task.task_type === 'approval') ? client?.id : '')
        || '';

    refreshResponsibleSelectors(selectedAssignee);

    el('taskDetailTitle').textContent = task.title;
    el('taskDetailTitleInput').value = task.title;
    el('taskDetailDescription').value = task.description || '';
    el('taskDetailStatus').value = task.status;
    el('taskDetailPriority').value = task.priority;
    el('taskDetailAssignee').value = selectedAssignee;
    if (el('taskDetailRequiresApproval')) {
        el('taskDetailRequiresApproval').checked = task.task_type === 'approval';
    }
    syncApprovalFieldVisibility('taskDetailAssignee', 'taskDetailApprovalField', 'taskDetailRequiresApproval');
    el('taskDetailDueDate').value = task.due_date || '';
    el('taskDetailFormError').textContent = '';
    el('taskDetailFormError').classList.remove('active');

    openModal('taskDetailModalOverlay');

    try {
        const comments = await listComments(projectId, 'task', taskId);
        renderTaskDetailComments(comments);
    } catch (error) {
        console.error('[proyectoDetallePage] Error cargando detalle de tarea:', error.message);
    }
}

function renderTaskDetailComments(comments) {
    const list = el('taskDetailCommentsList');
    if (!comments.length) {
        list.innerHTML = '<span style="color:#6a6a6a; font-size:12px;">Sin comentarios.</span>';
        return;
    }
    list.innerHTML = comments.map((c) => `
        <div class="admin-comment" style="padding:8px 0;">
            <div class="admin-comment-avatar" style="width:26px; height:26px; font-size:10px;">${getInitials(c.profiles?.full_name)}</div>
            <div class="admin-comment-body">
                <div class="admin-comment-header"><strong style="font-size:12px;">${escapeHtml(c.profiles?.full_name || 'Usuario')}</strong><span style="font-size:10px;">${formatDateTime(c.created_at)}</span></div>
                <div class="admin-comment-text" style="font-size:12px;">${escapeHtml(c.body)}</div>
            </div>
        </div>
    `).join('');
}

el('taskDetailForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeTaskId) return;
    const errorEl = el('taskDetailFormError');
    errorEl.classList.remove('active');
    const title = el('taskDetailTitleInput').value.trim();
    if (!title) { errorEl.textContent = 'El título es obligatorio.'; errorEl.classList.add('active'); return; }

    try {
        const assigneeId = el('taskDetailAssignee').value;
        if (!assigneeId) { errorEl.textContent = 'Selecciona un responsable.'; errorEl.classList.add('active'); return; }

        const client = getProjectClientProfile(currentProject);
        const previousType = findTaskById(activeTaskId)?.task_type;
        const assignment = resolveTaskAssignment(assigneeId, client?.id, {
            isApproval: !!el('taskDetailRequiresApproval')?.checked
        });

        await updateTask(activeTaskId, {
            title,
            description: el('taskDetailDescription').value.trim() || null,
            status: el('taskDetailStatus').value,
            priority: el('taskDetailPriority').value,
            assignee_id: assignment.assignee_id,
            task_type: assignment.task_type,
            due_date: el('taskDetailDueDate').value || null
        });

        if (assignment.task_type === 'approval' && previousType !== 'approval') {
            await ensureApprovalRecord(activeTaskId);
        }

        closeModal('taskDetailModalOverlay');
        await refreshAll();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

el('taskDetailDeleteBtn')?.addEventListener('click', async () => {
    if (!activeTaskId) return;
    if (!window.confirm('¿Eliminar esta tarea?')) return;
    try {
        await deleteTask(activeTaskId);
        closeModal('taskDetailModalOverlay');
        await refreshAll();
    } catch (error) {
        alert(`No se pudo eliminar: ${error.message}`);
    }
});

el('taskDetailCommentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = el('taskDetailCommentInput').value.trim();
    if (!body || !activeTaskId) return;
    try {
        await addComment({ projectId, commentableType: 'task', commentableId: activeTaskId, authorId: currentUserId, body });
        el('taskDetailCommentInput').value = '';
        const comments = await listComments(projectId, 'task', activeTaskId);
        renderTaskDetailComments(comments);
    } catch (error) {
        alert(`No se pudo enviar el comentario: ${error.message}`);
    }
});

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

    const linkIcon = '<svg viewBox="0 0 24 24" fill="none"><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const editIcon = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

    list.innerHTML = deliverables.map((d) => {
        const isDone = d.status === 'delivered' || d.status === 'approved';
        return `
            <div class="pd-deliverable-row" data-deliverable-id="${d.id}">
                <span class="pd-deliverable-check" style="background:${isDone ? 'rgba(60,210,140,.16)' : 'rgba(255,177,45,.16)'}; color:${isDone ? '#4ADE80' : '#FFC15F'};">${isDone ? doneCheck : ''}</span>
                <span class="pd-deliverable-title">${escapeHtml(d.title)}${d.due_date ? ` <span style="color:#7a7a7a; font-weight:400;">· vence ${formatDate(d.due_date)}</span>` : ''}</span>
                <span class="pd-badge ${isDone ? 'pd-badge--completed' : 'pd-badge--pending'}">${DELIVERABLE_STATUS_LABELS[d.status] || d.status}</span>
                ${d.external_link ? `<a href="${escapeHtml(d.external_link)}" target="_blank" rel="noopener" class="admin-action-btn" title="Abrir enlace externo" data-stop-row>${linkIcon}</a>` : ''}
                <button type="button" class="admin-action-btn" data-edit-deliverable title="Editar entregable">${editIcon}</button>
            </div>
        `;
    }).join('');

    list.querySelectorAll('[data-deliverable-id]').forEach((row) => {
        const deliverableId = row.dataset.deliverableId;

        row.querySelector('.pd-deliverable-check').addEventListener('click', async () => {
            const deliverable = deliverables.find((d) => d.id === deliverableId);
            if (!deliverable) return;
            const nextStatus = deliverable.status === 'draft' ? 'delivered'
                : deliverable.status === 'delivered' ? 'approved'
                : 'draft';
            try {
                await updateDeliverable(deliverable.id, { status: nextStatus });
                currentDeliverables = await listProjectDeliverables(projectId);
                renderDeliverables(currentDeliverables);
            } catch (error) {
                alert(`No se pudo actualizar: ${error.message}`);
            }
        });

        const editBtn = row.querySelector('[data-edit-deliverable]');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const deliverable = deliverables.find((d) => d.id === deliverableId);
                if (deliverable) openDeliverableModal(deliverable);
            });
        }
    });
}

function openDeliverableModal(deliverable) {
    editingDeliverableId = deliverable?.id || null;
    el('deliverableModalTitle').textContent = deliverable ? 'Editar Entregable' : 'Nuevo Entregable';
    el('deliverableFormSubmitBtn').textContent = deliverable ? 'Guardar cambios' : 'Crear Entregable';
    el('deliverableDeleteBtn').style.display = deliverable ? 'inline-flex' : 'none';
    el('deliverableTitle').value = deliverable?.title || '';
    el('deliverableDescription').value = deliverable?.description || '';
    el('deliverableStatus').value = deliverable?.status || 'draft';
    el('deliverableDueDate').value = deliverable?.due_date || '';
    el('deliverableDeliveredAt').value = deliverable?.delivered_at ? deliverable.delivered_at.slice(0, 10) : '';
    el('deliverableExternalLink').value = deliverable?.external_link || '';
    el('deliverableNotes').value = deliverable?.notes || '';
    el('deliverableFormError').textContent = '';
    el('deliverableFormError').classList.remove('active');
    openModal('deliverableModalOverlay');
}

el('pdAddDeliverableBtn')?.addEventListener('click', () => openDeliverableModal(null));

el('deliverableForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = el('deliverableTitle').value.trim();
    const errorEl = el('deliverableFormError');
    errorEl.classList.remove('active');
    if (!title) { errorEl.textContent = 'El título es obligatorio.'; errorEl.classList.add('active'); return; }

    const payload = {
        title,
        description: el('deliverableDescription').value.trim() || null,
        status: el('deliverableStatus').value,
        due_date: el('deliverableDueDate').value || null,
        delivered_at: el('deliverableDeliveredAt').value || null,
        external_link: el('deliverableExternalLink').value.trim() || null,
        notes: el('deliverableNotes').value.trim() || null
    };

    try {
        if (editingDeliverableId) {
            await updateDeliverable(editingDeliverableId, payload);
        } else {
            await createDeliverable({ project_id: projectId, ...payload });
        }
        closeModal('deliverableModalOverlay');
        el('deliverableForm').reset();
        currentDeliverables = await listProjectDeliverables(projectId);
        renderDeliverables(currentDeliverables);
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

el('deliverableDeleteBtn')?.addEventListener('click', async () => {
    if (!editingDeliverableId) return;
    if (!window.confirm('¿Eliminar este entregable?')) return;
    try {
        await deleteDeliverable(editingDeliverableId);
        closeModal('deliverableModalOverlay');
        currentDeliverables = await listProjectDeliverables(projectId);
        renderDeliverables(currentDeliverables);
    } catch (error) {
        alert(`No se pudo eliminar: ${error.message}`);
    }
});

/* ---------------------------------------------------------
   Actividad reciente
--------------------------------------------------------- */
function renderActivity(events) {
    const list = el('pdActivityList');
    if (!events.length) {
        list.innerHTML = '<span style="color:#6a6a6a; font-size:12px;">Sin actividad todavía.</span>';
        return;
    }
    list.innerHTML = events.slice(0, 8).map((event) => `
        <div class="pd-activity-item">
            <span class="pd-activity-avatar">${getInitials(event.profiles?.full_name)}</span>
            <div>
                <span class="pd-activity-text">${escapeHtml(event.description)}</span>
                <span class="pd-activity-time">${formatDateTime(event.created_at)}</span>
            </div>
        </div>
    `).join('');
}

function renderFullTimeline(events) {
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

el('pdViewAllActivityBtn')?.addEventListener('click', () => openDrawer('activityDrawerOverlay'));

/* ---------------------------------------------------------
   Comentarios del proyecto (drawer)
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
   Editar proyecto
--------------------------------------------------------- */
function openEditProjectModal(project) {
    el('editProjectName').value = project.name;
    el('editProjectDescription').value = project.description || '';
    el('editProjectModality').value = project.modality || '';
    el('editProjectResponsible').value = project.responsible_id || '';
    el('editProjectStart').value = project.start_date || '';
    el('editProjectEnd').value = project.end_date || '';
    el('editProjectColor').value = project.color_hex || '#2D8CFF';
    el('editProjectColor2').value = project.secondary_color_hex || '#FF8A3D';
    el('editProjectFormError').textContent = '';
    el('editProjectFormError').classList.remove('active');
    openModal('editProjectModalOverlay');
}

el('editProjectForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el('editProjectName').value.trim();
    const errorEl = el('editProjectFormError');
    errorEl.classList.remove('active');
    if (!name) { errorEl.textContent = 'El nombre es obligatorio.'; errorEl.classList.add('active'); return; }

    try {
        await updateProject(projectId, {
            name,
            description: el('editProjectDescription').value.trim() || null,
            modality: el('editProjectModality').value.trim() || null,
            responsible_id: el('editProjectResponsible').value || null,
            start_date: el('editProjectStart').value || null,
            end_date: el('editProjectEnd').value || null,
            color_hex: el('editProjectColor').value || null,
            secondary_color_hex: el('editProjectColor2').value || null
        });
        closeModal('editProjectModalOverlay');
        await refreshAll();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

/* ---------------------------------------------------------
   Menú "..." (estado del proyecto / archivar)
--------------------------------------------------------- */
el('pdMoreMenuBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    el('pdMoreMenu').classList.toggle('active');
});
document.addEventListener('click', () => el('pdMoreMenu')?.classList.remove('active'));

document.querySelectorAll('[data-project-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-project-action');
        try {
            if (action === 'archive') {
                if (!window.confirm('¿Archivar este proyecto?')) return;
                await archiveProject(projectId);
                window.location.href = 'proyectos.html';
                return;
            }
            await setProjectStatus(projectId, action);
            await refreshAll();
        } catch (error) {
            alert(`No se pudo actualizar el estado: ${error.message}`);
        }
    });
});

/* ---------------------------------------------------------
   Modales / drawers genéricos
--------------------------------------------------------- */
function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.admin-modal-overlay.active').forEach((overlay) => {
        overlay.classList.remove('active');
    });
    editingPhaseId = null;
    editingSectionId = null;
});
function openDrawer(id) { document.getElementById(id)?.classList.add('active'); }
function closeDrawer(id) { document.getElementById(id)?.classList.remove('active'); }

document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close-modal')));
});
document.querySelectorAll('.admin-modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) overlay.classList.remove('active');
    });
});

document.querySelectorAll('[data-close-drawer]').forEach((btn) => {
    btn.addEventListener('click', () => closeDrawer(btn.getAttribute('data-close-drawer')));
});
document.querySelectorAll('.pd-drawer-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) overlay.classList.remove('active');
    });
});

el('pdCommentsBtn')?.addEventListener('click', () => openDrawer('commentsDrawerOverlay'));

init();
