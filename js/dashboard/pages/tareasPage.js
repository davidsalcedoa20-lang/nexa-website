/* ==========================================================
   NEXA HUB — Página: Mis Tareas (cliente)
   dashboard/tareas.html
   ==========================================================
   Muestra TODAS las tareas con task_type = 'client' de todos los
   proyectos del cliente autenticado (RLS ya filtra por su propio
   workspace, ver project_tasks_select_own en
   supabase/migrations/20260727020900_create_projects_engine_rls_policies.sql).

   El cliente solo puede:
     - Leer título, descripción, responsable, prioridad, fecha
       límite y estado de sus tareas.
     - Ver los comentarios del administrador (y comentar).
     - Marcar una tarea como "Completada".
   No puede crear, editar el contenido ni eliminar tareas — eso
   sigue siendo exclusivo del admin (admin/tareas.html y
   admin/proyecto-detalle.html), que reutiliza las mismas tablas.

   Al marcar una tarea como completada:
     - El estado se actualiza en Supabase (setClientTaskStatus).
     - La fecha de finalización ("completed_at") se calcula sola
       con un trigger de base de datos (ver migración
       20260727200000_add_task_completed_at.sql).
     - El progreso del proyecto (projects.progress_percent /
       client_progress_percent) se recalcula solo con los
       triggers ya existentes del motor de Proyectos
       (recalculate_phase_progress / recalculate_project_progress).
     - Este mismo cambio en "project_tasks" dispara Realtime en
       el Resumen del Dashboard (js/dashboard/pages/resumenPage.js),
       así que las cifras se actualizan solas sin recargar la página.
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import { listClientTasks, setClientTaskStatus } from '../../services/taskService.js';
import { listComments, addComment } from '../../services/commentService.js';
import { TASK_PRIORITY_LABELS, PROGRESS_STATUS_LABELS, formatDate, formatDateTime, escapeHtml, getInitials } from '../../components/projectUi.js';

const DONE_STATUSES = ['completed', 'finished', 'approved'];
const REVIEW_STATUSES = ['waiting_approval'];

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

const PRIORITY_BADGE_CLASS = {
    low: 'dash-badge--pending',
    medium: 'dash-badge--progress',
    high: 'dash-badge--waiting',
    urgent: 'dash-badge--blocked'
};

function el(id) { return document.getElementById(id); }

let currentUserId = null;
let allTasks = [];
let currentFilter = 'all';
let currentTask = null;

/* ---------------------------------------------------------
   Clasificación: Pendientes / En revisión / Completadas
--------------------------------------------------------- */
function bucketOf(task) {
    if (REVIEW_STATUSES.includes(task.status)) return 'review';
    if (DONE_STATUSES.includes(task.status) || task.status === 'cancelled') return 'done';
    return 'pending';
}

/* ---------------------------------------------------------
   Aplana la tarea (con sus joins anidados de proyecto/bloque/
   sección) a un objeto simple, fácil de renderizar y filtrar.
--------------------------------------------------------- */
function flattenTask(task) {
    const section = task.project_sections || {};
    const phase = section.project_phases || {};
    const project = phase.projects || {};

    return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        completed_at: task.completed_at,
        sectionName: section.name || null,
        phaseName: phase.name || null,
        projectId: project.id || null,
        projectName: project.name || 'Proyecto',
        projectColor: project.color_hex || '#2D8CFF'
    };
}

/* ---------------------------------------------------------
   Carga inicial + Realtime
--------------------------------------------------------- */
async function init() {
    const { data: authData } = await supabase.auth.getUser();
    currentUserId = authData?.user?.id || null;

    try {
        await loadTasks();
        subscribeRealtime();
    } catch (error) {
        console.error('[tareasPage] Error cargando tareas:', error.message);
        if (el('tasksLoadingState')) el('tasksLoadingState').textContent = `No se pudieron cargar tus tareas: ${error.message}`;
    }
}

async function loadTasks() {
    const tasks = await listClientTasks();
    allTasks = tasks.map(flattenTask);
    if (el('tasksLoadingState')) el('tasksLoadingState').style.display = 'none';
    renderStats();
    renderTasks();
}

let refreshTimer = null;
function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
        loadTasks().catch((error) => console.error('[tareasPage] Error refrescando tareas:', error.message));
    }, 500);
}

function subscribeRealtime() {
    supabase
        .channel('client-tareas-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'project_tasks' }, scheduleRefresh)
        .subscribe();
}

/* ---------------------------------------------------------
   Estadísticas rápidas
--------------------------------------------------------- */
function renderStats() {
    const pending = allTasks.filter((t) => bucketOf(t) === 'pending').length;
    const review = allTasks.filter((t) => bucketOf(t) === 'review').length;
    const done = allTasks.filter((t) => bucketOf(t) === 'done').length;

    if (el('taskStatPending')) el('taskStatPending').textContent = String(pending);
    if (el('taskStatReview')) el('taskStatReview').textContent = String(review);
    if (el('taskStatDone')) el('taskStatDone').textContent = String(done);
}

/* ---------------------------------------------------------
   Lista de tareas (tarjetas) + tabs de filtro
--------------------------------------------------------- */
function renderTasks() {
    const grid = el('tasksGrid');
    const emptyState = el('tasksEmptyState');
    if (!grid || !emptyState) return;

    if (!allTasks.length) {
        grid.innerHTML = '';
        emptyState.innerHTML = 'Todavía no tienes tareas asignadas.<br>Aparecerán aquí en cuanto tu asesor NEXA te asigne alguna.';
        emptyState.style.display = 'block';
        return;
    }

    const filtered = currentFilter === 'all' ? allTasks : allTasks.filter((t) => bucketOf(t) === currentFilter);

    if (!filtered.length) {
        grid.innerHTML = '';
        emptyState.textContent = 'No tienes tareas en esta categoría.';
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    grid.innerHTML = filtered.map((task) => `
        <div class="dash-task-card is-editable" data-task-id="${task.id}" style="--project-color:${escapeHtml(task.projectColor)}">
            <div class="dash-task-card-top">
                <span class="dash-task-card-title">${escapeHtml(task.title)}</span>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <span class="dash-badge ${DASH_BADGE_CLASS[task.status] || 'dash-badge--pending'}">${PROGRESS_STATUS_LABELS[task.status] || task.status}</span>
                <span class="dash-badge ${PRIORITY_BADGE_CLASS[task.priority] || 'dash-badge--pending'}">${TASK_PRIORITY_LABELS[task.priority] || task.priority}</span>
            </div>
            ${task.description ? `<p class="dash-task-card-desc">${escapeHtml(task.description)}</p>` : ''}
            <div class="dash-task-card-footer">
                <div class="dash-task-avatar-row">
                    <span class="dash-task-avatar">${getInitials(task.projectName)}</span>
                    <span class="dash-task-avatar-name">${escapeHtml(task.projectName)}${task.due_date ? ` · ${formatDate(task.due_date)}` : ''}</span>
                </div>
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('[data-task-id]').forEach((card) => {
        card.addEventListener('click', () => openTaskDetail(card.getAttribute('data-task-id')));
    });
}

document.querySelectorAll('[data-task-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-task-filter]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-task-filter');
        renderTasks();
    });
});

/* ---------------------------------------------------------
   Modal de detalle: info completa + comentarios + "Completada"
--------------------------------------------------------- */
async function openTaskDetail(taskId) {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;
    currentTask = task;

    el('taskDetailModalTitle').textContent = task.title;
    el('taskDetailDescription').textContent = task.description || 'Sin descripción.';

    const statusBadge = el('taskDetailStatusBadge');
    statusBadge.className = `dash-badge ${DASH_BADGE_CLASS[task.status] || 'dash-badge--pending'}`;
    statusBadge.textContent = PROGRESS_STATUS_LABELS[task.status] || task.status;

    el('taskDetailProject').textContent = task.projectName;
    el('taskDetailPriority').textContent = TASK_PRIORITY_LABELS[task.priority] || task.priority;
    el('taskDetailDueDate').textContent = task.due_date ? formatDate(task.due_date) : 'Sin fecha';

    const completeBtn = el('taskDetailCompleteBtn');
    const completedWrap = el('taskDetailCompletedWrap');
    const isDone = DONE_STATUSES.includes(task.status);

    completeBtn.style.display = isDone ? 'none' : 'inline-flex';
    completeBtn.disabled = false;
    completeBtn.textContent = 'Marcar como completada';

    completedWrap.style.display = isDone ? 'block' : 'none';
    completedWrap.textContent = isDone && task.completed_at ? `Completada el ${formatDateTime(task.completed_at)}` : '';

    el('taskDetailCommentsList').innerHTML = '<p style="color:#7a7a7a; font-size:12.5px;">Cargando comentarios...</p>';
    el('taskDetailModalOverlay').classList.add('active');

    if (!task.projectId) return;

    try {
        const comments = await listComments(task.projectId, 'task', task.id);
        renderTaskComments(comments);
    } catch (error) {
        console.error('[tareasPage] Error cargando comentarios:', error.message);
        el('taskDetailCommentsList').innerHTML = '<p style="color:#FF6B81; font-size:12.5px;">No se pudieron cargar los comentarios.</p>';
    }
}

function renderTaskComments(comments) {
    const list = el('taskDetailCommentsList');
    if (!list) return;

    if (!comments.length) {
        list.innerHTML = '<p style="color:#7a7a7a; font-size:12.5px;">Todavía no hay comentarios en esta tarea.</p>';
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

el('taskDetailCompleteBtn')?.addEventListener('click', async () => {
    if (!currentTask) return;
    const btn = el('taskDetailCompleteBtn');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        // Esto actualiza "status" en Supabase; "completed_at" lo rellena
        // solo un trigger de base de datos, y el progreso del proyecto
        // (projects.progress_percent / client_progress_percent) se
        // recalcula solo con los triggers ya existentes del motor de
        // Proyectos — no hace falta tocar nada más desde aquí.
        await setClientTaskStatus(currentTask.id, 'completed');
        await loadTasks();
        openTaskDetail(currentTask.id);
    } catch (error) {
        alert(`No se pudo actualizar la tarea: ${error.message}`);
        btn.disabled = false;
        btn.textContent = 'Marcar como completada';
    }
});

el('taskDetailCommentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentTask) return;

    const input = el('taskDetailCommentInput');
    const body = input.value.trim();
    if (!body) return;

    try {
        await addComment({
            projectId: currentTask.projectId,
            commentableType: 'task',
            commentableId: currentTask.id,
            authorId: currentUserId,
            body
        });
        input.value = '';
        const comments = await listComments(currentTask.projectId, 'task', currentTask.id);
        renderTaskComments(comments);
    } catch (error) {
        alert(`No se pudo enviar el comentario: ${error.message}`);
    }
});

function closeTaskDetail() {
    el('taskDetailModalOverlay')?.classList.remove('active');
    currentTask = null;
}

el('taskDetailModalClose')?.addEventListener('click', closeTaskDetail);
el('taskDetailModalOverlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeTaskDetail();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el('taskDetailModalOverlay')?.classList.contains('active')) closeTaskDetail();
});

init();
