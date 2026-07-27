/* ==========================================================
   NEXA HUB — Página: Tareas standalone (admin/tareas.html)
   ==========================================================
   Vista cross-proyecto de TODAS las tareas de TODOS los clientes,
   reutilizando las mismas tablas del motor de Proyectos
   (project_tasks, project_sections, project_phases, projects,
   workspaces). No crea ninguna tabla nueva ni un segundo sistema
   de tareas: es solo una vista + edición agregada.

   Estructura reutilizada: PROYECTO -> BLOQUE -> SECCIÓN -> TAREA.
   Para crear una tarea nueva desde aquí, el admin elige primero
   en qué proyecto/bloque/sección debe vivir (misma jerarquía que
   ya usa admin/proyecto-detalle.html).
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import { listAllTasksForAdmin, createTask, updateTask, deleteTask } from '../../services/taskService.js';
import { listProjects, getProjectStructure } from '../../services/projectService.js';
import { listAdmins } from '../../services/profileService.js';
import { renderTaskTable } from '../components/taskTable.js';
import { escapeHtml } from '../../components/projectUi.js';

const tbody = document.getElementById('tasksTableBody');
const emptyState = document.getElementById('tasksEmptyState');
const loadingState = document.getElementById('tasksLoadingState');
const errorState = document.getElementById('tasksErrorState');
const tableWrapper = document.getElementById('tasksTableWrapper');
const noResultsState = document.getElementById('tasksNoResultsState');

const searchInput = document.getElementById('taskSearchInput');
const projectFilter = document.getElementById('taskProjectFilter');
const clientFilter = document.getElementById('taskClientFilter');
const statusFilter = document.getElementById('taskStatusFilter');
const typeFilter = document.getElementById('taskTypeFilter');
const priorityFilter = document.getElementById('taskPriorityFilter');

let currentUserId = null;
let admins = [];
let allProjects = [];
let allTasksFlat = [];
let editingTaskId = null;
let editingTaskSectionId = null;

function el(id) { return document.getElementById(id); }

function setView(view) {
    if (loadingState) loadingState.style.display = view === 'loading' ? 'flex' : 'none';
    if (emptyState) emptyState.style.display = view === 'empty' ? 'flex' : 'none';
    if (errorState) errorState.style.display = view === 'error' ? 'flex' : 'none';
    if (noResultsState) noResultsState.style.display = view === 'no-results' ? 'flex' : 'none';
    if (tableWrapper) tableWrapper.style.display = (view === 'table' || view === 'no-results') ? 'block' : 'none';
    if (tableWrapper) tableWrapper.style.opacity = view === 'no-results' ? '0.35' : '1';
}

/* ---------------------------------------------------------
   Aplanar una tarea (con sus joins anidados) a un objeto plano
   fácil de filtrar/renderizar.
--------------------------------------------------------- */
function flattenTask(task) {
    const section = task.project_sections || {};
    const phase = section.project_phases || {};
    const project = phase.projects || {};
    const workspace = project.workspaces || {};
    const client = workspace.profiles || {};

    return {
        id: task.id,
        title: task.title,
        description: task.description,
        task_type: task.task_type,
        status: task.status,
        priority: task.priority,
        assignee_id: task.assignee_id,
        due_date: task.due_date,
        order_index: task.order_index,
        section_id: task.section_id,
        profiles: task.profiles,
        sectionName: section.name || null,
        phaseId: phase.id || null,
        phaseName: phase.name || null,
        projectId: project.id || null,
        projectName: project.name || null,
        projectStatus: project.status || null,
        projectArchived: !!project.archived_at,
        clientId: client.id || null,
        clientName: client.full_name || null
    };
}

/* ---------------------------------------------------------
   Carga inicial
--------------------------------------------------------- */
async function init() {
    const { data: authData } = await supabase.auth.getUser();
    currentUserId = authData?.user?.id || null;

    setView('loading');
    try {
        const [tasks, projects, adminList] = await Promise.all([
            listAllTasksForAdmin(),
            listProjects(),
            listAdmins()
        ]);
        allTasksFlat = tasks.map(flattenTask);
        allProjects = projects;
        admins = adminList;

        populateFilterOptions();
        populateAssigneeSelect();
        populateProjectSelect();
        renderStats(allTasksFlat);
        applyFiltersAndRender();
        subscribeRealtime();
    } catch (error) {
        console.error('[tareasPage] Error cargando tareas:', error.message);
        setView('error');
    }
}

async function refreshTasks() {
    try {
        const tasks = await listAllTasksForAdmin();
        allTasksFlat = tasks.map(flattenTask);
        const selectedProject = projectFilter?.value || '';
        const selectedClient = clientFilter?.value || '';
        populateFilterOptions();
        if (projectFilter && selectedProject) projectFilter.value = selectedProject;
        if (clientFilter && selectedClient) clientFilter.value = selectedClient;
        renderStats(allTasksFlat);
        applyFiltersAndRender();
    } catch (error) {
        console.error('[tareasPage] Error refrescando tareas:', error.message);
    }
}

/* ---------------------------------------------------------
   Realtime: cualquier cambio en project_tasks (de cualquier
   proyecto/cliente) refresca automáticamente esta vista.
--------------------------------------------------------- */
function subscribeRealtime() {
    supabase
        .channel('admin-tareas-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, () => {
            refreshTasks();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, async () => {
            try {
                allProjects = await listProjects();
                populateProjectSelect();
            } catch (error) {
                console.error('[tareasPage] Error refrescando proyectos:', error.message);
            }
        })
        .subscribe();
}

/* ---------------------------------------------------------
   Estadísticas rápidas
--------------------------------------------------------- */
function renderStats(tasks) {
    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const inProgress = tasks.filter((t) => ['in_progress', 'waiting_approval'].includes(t.status)).length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = tasks.filter((t) => {
        if (!t.due_date || ['completed', 'finished'].includes(t.status)) return false;
        const due = new Date(t.due_date); due.setHours(0, 0, 0, 0);
        return due < today;
    }).length;

    if (el('taskStatTotal')) el('taskStatTotal').textContent = String(total);
    if (el('taskStatPending')) el('taskStatPending').textContent = String(pending);
    if (el('taskStatProgress')) el('taskStatProgress').textContent = String(inProgress);
    if (el('taskStatOverdue')) el('taskStatOverdue').textContent = String(overdue);
}

/* ---------------------------------------------------------
   Filtros
--------------------------------------------------------- */
function populateFilterOptions() {
    const projectsMap = new Map();
    const clientsMap = new Map();
    allTasksFlat.forEach((t) => {
        if (t.projectId && !projectsMap.has(t.projectId)) projectsMap.set(t.projectId, t.projectName);
        if (t.clientId && !clientsMap.has(t.clientId)) clientsMap.set(t.clientId, t.clientName);
    });

    if (projectFilter) {
        projectFilter.innerHTML = '<option value="">Todos los proyectos</option>' +
            Array.from(projectsMap.entries()).map(([id, name]) => `<option value="${id}">${escapeHtml(name || 'Sin nombre')}</option>`).join('');
    }
    if (clientFilter) {
        clientFilter.innerHTML = '<option value="">Todos los clientes</option>' +
            Array.from(clientsMap.entries()).map(([id, name]) => `<option value="${id}">${escapeHtml(name || 'Sin nombre')}</option>`).join('');
    }
}

function applyFiltersAndRender() {
    const search = (searchInput?.value || '').trim().toLowerCase();
    const projectId = projectFilter?.value || '';
    const clientId = clientFilter?.value || '';
    const status = statusFilter?.value || '';
    const taskType = typeFilter?.value || '';
    const priority = priorityFilter?.value || '';

    const filtered = allTasksFlat.filter((t) => {
        if (search && !t.title.toLowerCase().includes(search)) return false;
        if (projectId && t.projectId !== projectId) return false;
        if (clientId && t.clientId !== clientId) return false;
        if (status && t.status !== status) return false;
        if (taskType && t.task_type !== taskType) return false;
        if (priority && t.priority !== priority) return false;
        return true;
    });

    if (!allTasksFlat.length) {
        setView('empty');
        return;
    }
    if (!filtered.length) {
        setView('no-results');
        tbody.innerHTML = '';
        return;
    }

    setView('table');
    renderTaskTable(tbody, filtered, {
        onStatusChange: handleStatusChange,
        onEdit: (task) => openTaskModal(task),
        onDelete: handleDelete
    });
}

[searchInput, projectFilter, clientFilter, statusFilter, typeFilter, priorityFilter].forEach((elm) => {
    if (!elm) return;
    elm.addEventListener(elm.tagName === 'SELECT' ? 'change' : 'input', applyFiltersAndRender);
});

/* ---------------------------------------------------------
   Cambiar estado desde el <select> inline de la tabla
--------------------------------------------------------- */
async function handleStatusChange(task, newStatus, selectEl) {
    const previous = task.status;
    selectEl.disabled = true;
    try {
        await updateTask(task.id, { status: newStatus });
        task.status = newStatus;
        renderStats(allTasksFlat);
    } catch (error) {
        alert(`No se pudo actualizar el estado: ${error.message}`);
        selectEl.value = previous;
    } finally {
        selectEl.disabled = false;
    }
}

async function handleDelete(task) {
    if (!window.confirm(`¿Eliminar la tarea "${task.title}"? Esta acción no se puede deshacer.`)) return;
    try {
        await deleteTask(task.id);
        await refreshTasks();
    } catch (error) {
        alert(`No se pudo eliminar la tarea: ${error.message}`);
    }
}

/* ---------------------------------------------------------
   Modal: Nueva / Editar Tarea
--------------------------------------------------------- */
function populateAssigneeSelect() {
    const select = el('taskAssignee');
    if (!select) return;
    select.innerHTML = '<option value="">Sin asignar</option>' +
        admins.map((a) => `<option value="${a.id}">${escapeHtml(a.full_name || a.email)}</option>`).join('');
}

function populateProjectSelect() {
    const select = el('taskProjectSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Selecciona un proyecto...</option>' +
        allProjects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}${p.workspaces?.profiles?.full_name ? ' — ' + escapeHtml(p.workspaces.profiles.full_name) : ''}</option>`).join('');
}

async function populatePhaseSelect(projectId) {
    const phaseSelect = el('taskPhaseSelect');
    const sectionSelect = el('taskSectionSelect');
    if (!phaseSelect || !sectionSelect) return;
    phaseSelect.innerHTML = '<option value="">Cargando bloques...</option>';
    sectionSelect.innerHTML = '<option value="">Selecciona primero un bloque</option>';
    if (!projectId) {
        phaseSelect.innerHTML = '<option value="">Selecciona primero un proyecto</option>';
        return;
    }
    try {
        const structure = await getProjectStructure(projectId);
        const phases = structure.allPhases || [];
        phaseSelect.dataset.phases = JSON.stringify(phases.map((p) => ({ id: p.id, name: p.name, sections: (p.sections || []).map((s) => ({ id: s.id, name: s.name })) })));
        phaseSelect.innerHTML = phases.length
            ? '<option value="">Selecciona un bloque...</option>' + phases.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')
            : '<option value="">Este proyecto no tiene bloques todavía</option>';
    } catch (error) {
        phaseSelect.innerHTML = '<option value="">Error cargando bloques</option>';
        console.error('[tareasPage] Error cargando estructura del proyecto:', error.message);
    }
}

function populateSectionSelect(phaseId) {
    const phaseSelect = el('taskPhaseSelect');
    const sectionSelect = el('taskSectionSelect');
    if (!phaseSelect || !sectionSelect) return;
    if (!phaseId) {
        sectionSelect.innerHTML = '<option value="">Selecciona primero un bloque</option>';
        return;
    }
    const phases = JSON.parse(phaseSelect.dataset.phases || '[]');
    const phase = phases.find((p) => p.id === phaseId);
    const sections = phase?.sections || [];
    sectionSelect.innerHTML = sections.length
        ? '<option value="">Selecciona una sección...</option>' + sections.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')
        : '<option value="">Este bloque no tiene secciones todavía</option>';
}

el('taskProjectSelect')?.addEventListener('change', (e) => populatePhaseSelect(e.target.value));
el('taskPhaseSelect')?.addEventListener('change', (e) => populateSectionSelect(e.target.value));

function toggleAssigneeField() {
    const type = el('taskType').value;
    const field = el('taskAssignee').closest('.admin-field');
    if (field) field.style.display = type === 'nexa' ? 'flex' : 'none';
}
el('taskType')?.addEventListener('change', toggleAssigneeField);

function openTaskModal(task) {
    editingTaskId = task?.id || null;
    editingTaskSectionId = task?.section_id || null;

    el('taskModalTitle').textContent = task ? 'Editar Tarea' : 'Nueva Tarea';
    el('taskFormSubmitBtn').textContent = task ? 'Guardar cambios' : 'Crear Tarea';

    const locationField = el('taskLocationField');
    const pickerField = el('taskLocationPicker');
    if (task) {
        if (locationField) {
            locationField.style.display = 'block';
            locationField.textContent = `Proyecto: ${task.projectName || '—'} · Bloque: ${task.phaseName || '—'} · Sección: ${task.sectionName || '—'}`;
        }
        if (pickerField) pickerField.style.display = 'none';
    } else {
        if (locationField) locationField.style.display = 'none';
        if (pickerField) pickerField.style.display = 'block';
        el('taskProjectSelect').value = '';
        populatePhaseSelect('');
    }

    el('taskTitle').value = task?.title || '';
    el('taskType').value = task?.task_type || 'nexa';
    el('taskAssignee').value = task?.assignee_id || '';
    el('taskPriority').value = task?.priority || 'medium';
    el('taskStatusSelect').value = task?.status || 'pending';
    el('taskDueDate').value = task?.due_date || '';
    el('taskDescription').value = task?.description || '';
    toggleAssigneeField();

    el('taskFormError').textContent = '';
    el('taskFormError').classList.remove('active');
    el('taskDeleteBtn').style.display = task ? 'inline-flex' : 'none';

    document.getElementById('taskModalOverlay')?.classList.add('active');
}

function closeTaskModal() {
    document.getElementById('taskModalOverlay')?.classList.remove('active');
    editingTaskId = null;
    editingTaskSectionId = null;
}

el('newTaskBtn')?.addEventListener('click', () => openTaskModal(null));

document.querySelectorAll('[data-close-modal="taskModalOverlay"]').forEach((btn) => {
    btn.addEventListener('click', closeTaskModal);
});
document.getElementById('taskModalOverlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTaskModal();
});

el('taskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = el('taskFormError');
    errorEl.classList.remove('active');

    const title = el('taskTitle').value.trim();
    if (!title) { errorEl.textContent = 'El título es obligatorio.'; errorEl.classList.add('active'); return; }

    const taskType = el('taskType').value;
    const payload = {
        title,
        description: el('taskDescription').value.trim() || null,
        task_type: taskType,
        priority: el('taskPriority').value,
        assignee_id: taskType === 'nexa' ? (el('taskAssignee').value || null) : null,
        due_date: el('taskDueDate').value || null,
        status: el('taskStatusSelect').value
    };

    try {
        if (editingTaskId) {
            await updateTask(editingTaskId, payload);
        } else {
            const sectionId = el('taskSectionSelect').value;
            if (!sectionId) { errorEl.textContent = 'Selecciona proyecto, bloque y sección.'; errorEl.classList.add('active'); return; }
            await createTask({ ...payload, section_id: sectionId, created_by: currentUserId });
        }
        closeTaskModal();
        await refreshTasks();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

el('taskDeleteBtn')?.addEventListener('click', async () => {
    if (!editingTaskId) return;
    if (!window.confirm('¿Eliminar esta tarea?')) return;
    try {
        await deleteTask(editingTaskId);
        closeTaskModal();
        await refreshTasks();
    } catch (error) {
        alert(`No se pudo eliminar: ${error.message}`);
    }
});

init();
