/* ==========================================================
   NEXA HUB — Página: Mi Agenda (admin/mi-agenda.html)
   ==========================================================
   Agenda personal del administrador autenticado.
   Independiente de project_tasks / Ruta NEXA.
   Drag & Drop nativo entre días + reorder.
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import {
    listMyAgendaTasks,
    createAgendaTask,
    updateAgendaTask,
    deleteAgendaTask,
    duplicateAgendaTask
} from '../../services/agendaService.js';
import { listProjects } from '../../services/projectService.js';
import {
    AGENDA_PRIORITY_LABELS,
    AGENDA_STATUS_LABELS,
    WEEKDAY_LABELS,
    startOfWeek,
    addDays,
    toISODate,
    formatAgendaTime,
    formatMinutes,
    formatRemainingMinutes,
    sortAgendaTasks,
    computeAgendaStats,
    computeDayProgress,
    showAgendaToast,
    escapeHtml
} from '../../components/agendaUi.js';

function el(id) { return document.getElementById(id); }

let currentUserId = null;
let projects = [];
let tasks = [];
let weekStart = startOfWeek(new Date());
let activeTab = 'week';
let editingTaskId = null;
let menuTaskId = null;
let dragTaskId = null;
let savingDnD = false;

const PRIORITY_CYCLE = ['critical', 'high', 'medium', 'low'];

/* ---------------------------------------------------------
   Init
--------------------------------------------------------- */
async function init() {
    const { data: authData } = await supabase.auth.getUser();
    currentUserId = authData?.user?.id || null;
    if (!currentUserId) return;

    try {
        projects = await listProjects();
        populateProjectSelect();
        el('agendaTaskDate').value = toISODate(new Date());
        await loadTasks();
        subscribeRealtime();
        wireUi();
    } catch (error) {
        console.error('[miAgendaPage] Error inicializando:', error.message);
        if (el('agendaLoading')) {
            el('agendaLoading').textContent = `No se pudo cargar la agenda: ${error.message}`;
        }
    }
}

function populateProjectSelect() {
    const select = el('agendaTaskProject');
    if (!select) return;
    select.innerHTML = '<option value="">Sin proyecto</option>' +
        projects.map((p) => {
            const client = p.workspaces?.profiles?.full_name || p.workspaces?.name || '';
            const label = client ? `${p.name} — ${client}` : p.name;
            return `<option value="${p.id}">${escapeHtml(label)}</option>`;
        }).join('');
}

async function loadTasks() {
    if (el('agendaLoading')) el('agendaLoading').style.display = 'block';
    const from = toISODate(addDays(weekStart, -7));
    const to = toISODate(addDays(weekStart, 20));
    try {
        tasks = await listMyAgendaTasks({ fromDate: from, toDate: to });
        renderAll();
    } catch (error) {
        console.error('[miAgendaPage] Error cargando tareas:', error.message);
        showAgendaToast(error.message, 'error');
    } finally {
        if (el('agendaLoading')) el('agendaLoading').style.display = 'none';
    }
}

function subscribeRealtime() {
    supabase
        .channel('admin-agenda-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_tasks' }, () => {
            if (!savingDnD) loadTasks();
        })
        .subscribe();
}

/* ---------------------------------------------------------
   Render
--------------------------------------------------------- */
function renderAll() {
    renderStats();
    renderWeekLabel();
    if (activeTab === 'week') {
        el('agendaWeekView').style.display = 'grid';
        el('agendaTodayView').style.display = 'none';
        el('agendaWeekNav').style.display = 'flex';
        renderWeekBoard();
    } else {
        el('agendaWeekView').style.display = 'none';
        el('agendaTodayView').style.display = 'block';
        el('agendaWeekNav').style.display = 'none';
        renderTodayView();
    }
}

function renderStats() {
    const stats = computeAgendaStats(tasks);
    el('agendaStatToday').textContent = String(stats.todayCount);
    el('agendaStatUrgent').textContent = String(stats.urgentCount);
    el('agendaStatProgress').textContent = String(stats.inProgressCount);
    el('agendaStatDone').textContent = String(stats.completedCount);
    el('agendaStatRemaining').textContent = formatRemainingMinutes(stats.remainingMinutes);
}

function renderWeekLabel() {
    const end = addDays(weekStart, 6);
    const opts = { day: 'numeric', month: 'short' };
    el('agendaWeekLabel').textContent =
        `${weekStart.toLocaleDateString('es-CO', opts)} — ${end.toLocaleDateString('es-CO', { ...opts, year: 'numeric' })}`;
}

function renderWeekBoard() {
    const board = el('agendaWeekView');
    const todayIso = toISODate(new Date());

    board.innerHTML = WEEKDAY_LABELS.map((label, index) => {
        const dayDate = addDays(weekStart, index);
        const iso = toISODate(dayDate);
        const dayTasks = sortAgendaTasks(tasks.filter((t) => t.task_date === iso));
        const isToday = iso === todayIso;

        return `
            <div class="agenda-day-col ${isToday ? 'is-today' : ''}" data-date="${iso}">
                <div class="agenda-day-header">
                    <strong>${label}</strong>
                    <span>${dayDate.getDate()}</span>
                </div>
                <div class="agenda-day-list" data-drop-date="${iso}">
                    ${dayTasks.map((task) => renderCard(task)).join('') || '<span class="agenda-day-empty">Sin tareas</span>'}
                </div>
            </div>
        `;
    }).join('');

    wireDragAndDrop();
    wireCardMenus();
}

function renderTodayView() {
    const todayIso = toISODate(new Date());
    const todayTasks = sortAgendaTasks(tasks.filter((t) => t.task_date === todayIso));
    const progress = computeDayProgress(todayTasks);

    el('agendaTodayPercent').textContent = `${progress.percent}%`;
    el('agendaTodayBar').style.width = `${progress.percent}%`;
    el('agendaTodayRemaining').textContent = formatRemainingMinutes(progress.remainingMinutes);
    el('agendaTodayCount').textContent = String(progress.total);

    const list = el('agendaTodayList');
    if (!todayTasks.length) {
        list.innerHTML = '<p class="admin-empty-inline">No tienes tareas para hoy. ¡Buen momento para planificar!</p>';
        return;
    }

    list.innerHTML = todayTasks.map((task) => renderCard(task, { large: true })).join('');
    wireCardMenus();
}

function renderCard(task, { large = false } = {}) {
    const projectName = task.projects?.name || '';
    const tags = (task.tags || []).filter(Boolean);
    const shortDesc = (task.description || '').trim();
    const desc = shortDesc.length > 90 ? `${shortDesc.slice(0, 90)}…` : shortDesc;
    const done = task.status === 'completed';

    return `
        <article class="agenda-card priority-${task.priority} status-${task.status} ${large ? 'is-large' : ''} ${done ? 'is-done' : ''}"
            draggable="true"
            data-task-id="${task.id}"
            data-date="${task.task_date}">
            <div class="agenda-card-top">
                <span class="agenda-priority-dot" title="${AGENDA_PRIORITY_LABELS[task.priority]}"></span>
                <strong class="agenda-card-title">${escapeHtml(task.title)}</strong>
                <button type="button" class="agenda-card-menu-btn" data-open-menu="${task.id}" aria-label="Menú">⋯</button>
            </div>
            ${projectName ? `<span class="agenda-card-project">${escapeHtml(projectName)}</span>` : ''}
            <div class="agenda-card-meta">
                ${task.task_time ? `<span>${formatAgendaTime(task.task_time)}</span>` : ''}
                ${task.estimated_minutes ? `<span>${formatMinutes(task.estimated_minutes)}</span>` : ''}
                <span class="agenda-card-priority-label">${AGENDA_PRIORITY_LABELS[task.priority]}</span>
            </div>
            ${tags.length ? `<div class="agenda-card-tags">${tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
            <div class="agenda-card-footer">
                <span class="agenda-status-pill status-${task.status}">
                    ${done ? '<span class="agenda-check">✓</span>' : ''}
                    ${AGENDA_STATUS_LABELS[task.status]}
                </span>
            </div>
            ${desc ? `<p class="agenda-card-desc">${escapeHtml(desc)}</p>` : ''}
        </article>
    `;
}

/* ---------------------------------------------------------
   Drag & Drop
--------------------------------------------------------- */
function wireDragAndDrop() {
    document.querySelectorAll('.agenda-card[draggable="true"]').forEach((card) => {
        card.addEventListener('dragstart', (e) => {
            dragTaskId = card.dataset.taskId;
            card.classList.add('is-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragTaskId);
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('is-dragging');
            document.querySelectorAll('.agenda-day-list.is-dragover').forEach((n) => n.classList.remove('is-dragover'));
            dragTaskId = null;
        });
    });

    document.querySelectorAll('.agenda-day-list').forEach((list) => {
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            list.classList.add('is-dragover');
            const after = getDragAfterElement(list, e.clientY);
            const dragging = document.querySelector('.agenda-card.is-dragging');
            if (!dragging) return;
            if (!after) list.appendChild(dragging);
            else list.insertBefore(dragging, after);
        });
        list.addEventListener('dragleave', () => list.classList.remove('is-dragover'));
        list.addEventListener('drop', async (e) => {
            e.preventDefault();
            list.classList.remove('is-dragover');
            const dateIso = list.dataset.dropDate;
            const orderedIds = [...list.querySelectorAll('.agenda-card')].map((c) => c.dataset.taskId);
            await persistDayOrder(dateIso, orderedIds);
        });
    });
}

function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll('.agenda-card:not(.is-dragging)')];
    return els.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function persistDayOrder(dateIso, orderedIds) {
    if (!orderedIds.length) return;
    savingDnD = true;
    const movedFromOtherDay = orderedIds.some((id) => {
        const t = tasks.find((x) => x.id === id);
        return t && t.task_date !== dateIso;
    });

    try {
        await Promise.all(orderedIds.map((id, index) =>
            updateAgendaTask(id, { task_date: dateIso, position: index })
        ));

        // Actualiza estado local
        orderedIds.forEach((id, index) => {
            const t = tasks.find((x) => x.id === id);
            if (t) {
                t.task_date = dateIso;
                t.position = index;
            }
        });

        // Limpia "Sin tareas" vacíos / re-render suave
        renderStats();
        if (movedFromOtherDay) {
            showAgendaToast('Tarea reprogramada correctamente');
            renderWeekBoard();
        } else {
            showAgendaToast('Orden actualizado');
        }
    } catch (error) {
        console.error('[miAgendaPage] DnD error:', error.message);
        showAgendaToast(`No se pudo guardar: ${error.message}`, 'error');
        await loadTasks();
    } finally {
        savingDnD = false;
    }
}

/* ---------------------------------------------------------
   Menú de tarjeta
--------------------------------------------------------- */
function wireCardMenus() {
    document.querySelectorAll('[data-open-menu]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCardMenu(btn.getAttribute('data-open-menu'), btn);
        });
    });

    document.querySelectorAll('.agenda-card').forEach((card) => {
        card.addEventListener('dblclick', () => {
            const task = tasks.find((t) => t.id === card.dataset.taskId);
            if (task) openTaskModal(task);
        });
    });
}

function openCardMenu(taskId, anchor) {
    const menu = el('agendaCardMenu');
    menuTaskId = taskId;
    menu.hidden = false;
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6 + windowY}px`;
    menu.style.left = `${Math.min(rect.left, window.innerWidth - 200) + windowX}px`;
}

function closeCardMenu() {
    el('agendaCardMenu').hidden = true;
    menuTaskId = null;
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#agendaCardMenu') && !e.target.closest('[data-open-menu]')) {
        closeCardMenu();
    }
});

el('agendaCardMenu')?.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-menu-action]')?.getAttribute('data-menu-action');
    if (!action || !menuTaskId) return;
    const task = tasks.find((t) => t.id === menuTaskId);
    closeCardMenu();
    if (!task) return;

    try {
        if (action === 'edit') openTaskModal(task);
        if (action === 'duplicate') {
            await duplicateAgendaTask(task, currentUserId);
            showAgendaToast('Tarea duplicada');
            await loadTasks();
        }
        if (action === 'priority') {
            const idx = PRIORITY_CYCLE.indexOf(task.priority);
            const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
            await updateAgendaTask(task.id, { priority: next });
            showAgendaToast(`Prioridad: ${AGENDA_PRIORITY_LABELS[next]}`);
            await loadTasks();
        }
        if (action === 'move') {
            const tomorrow = toISODate(addDays(new Date(task.task_date + 'T12:00:00'), 1));
            await updateAgendaTask(task.id, { task_date: tomorrow });
            showAgendaToast('Tarea reprogramada correctamente');
            await loadTasks();
        }
        if (action === 'delete') {
            if (!window.confirm(`¿Eliminar "${task.title}"?`)) return;
            await deleteAgendaTask(task.id);
            showAgendaToast('Tarea eliminada');
            await loadTasks();
        }
    } catch (error) {
        showAgendaToast(error.message, 'error');
    }
});

/* ---------------------------------------------------------
   Modal CRUD
--------------------------------------------------------- */
function openTaskModal(task = null) {
    editingTaskId = task?.id || null;
    el('agendaTaskModalTitle').textContent = task ? 'Editar tarea' : 'Nueva tarea';
    el('agendaTaskSubmitBtn').textContent = task ? 'Guardar cambios' : 'Crear tarea';
    el('agendaTaskDeleteBtn').style.display = task ? 'inline-flex' : 'none';

    el('agendaTaskTitle').value = task?.title || '';
    el('agendaTaskDescription').value = task?.description || '';
    el('agendaTaskProject').value = task?.project_id || '';
    el('agendaTaskDate').value = task?.task_date || toISODate(new Date());
    el('agendaTaskTime').value = task?.task_time ? String(task.task_time).slice(0, 5) : '';
    el('agendaTaskMinutes').value = task?.estimated_minutes || '';
    el('agendaTaskPriority').value = task?.priority || 'medium';
    el('agendaTaskStatus').value = task?.status || 'pending';
    el('agendaTaskTags').value = (task?.tags || []).join(', ');
    el('agendaTaskFormError').textContent = '';
    el('agendaTaskFormError').classList.remove('active');

    el('agendaTaskModalOverlay').classList.add('active');
    el('agendaTaskTitle').focus();
}

function closeTaskModal() {
    el('agendaTaskModalOverlay').classList.remove('active');
    editingTaskId = null;
}

function parseTags(raw) {
    return String(raw || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8);
}

el('agendaTaskForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = el('agendaTaskFormError');
    errorEl.classList.remove('active');

    const title = el('agendaTaskTitle').value.trim();
    if (!title) {
        errorEl.textContent = 'El título es obligatorio.';
        errorEl.classList.add('active');
        return;
    }

    const payload = {
        title,
        description: el('agendaTaskDescription').value.trim() || null,
        project_id: el('agendaTaskProject').value || null,
        task_date: el('agendaTaskDate').value,
        task_time: el('agendaTaskTime').value || null,
        estimated_minutes: Number(el('agendaTaskMinutes').value) || null,
        priority: el('agendaTaskPriority').value,
        status: el('agendaTaskStatus').value,
        tags: parseTags(el('agendaTaskTags').value)
    };

    try {
        if (editingTaskId) {
            await updateAgendaTask(editingTaskId, payload);
            showAgendaToast('Tarea actualizada');
        } else {
            const dayTasks = tasks.filter((t) => t.task_date === payload.task_date);
            await createAgendaTask({
                ...payload,
                admin_id: currentUserId,
                position: dayTasks.length
            });
            showAgendaToast('Tarea creada');
        }
        closeTaskModal();
        await loadTasks();
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.add('active');
    }
});

el('agendaTaskDeleteBtn')?.addEventListener('click', async () => {
    if (!editingTaskId) return;
    if (!window.confirm('¿Eliminar esta tarea?')) return;
    try {
        await deleteAgendaTask(editingTaskId);
        closeTaskModal();
        showAgendaToast('Tarea eliminada');
        await loadTasks();
    } catch (error) {
        showAgendaToast(error.message, 'error');
    }
});

/* ---------------------------------------------------------
   UI chrome
--------------------------------------------------------- */
function wireUi() {
    el('agendaNewTaskBtn')?.addEventListener('click', () => openTaskModal(null));

    document.querySelectorAll('[data-agenda-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
            activeTab = btn.getAttribute('data-agenda-tab');
            document.querySelectorAll('[data-agenda-tab]').forEach((b) => b.classList.toggle('is-active', b === btn));
            renderAll();
        });
    });

    el('agendaPrevWeek')?.addEventListener('click', async () => {
        weekStart = addDays(weekStart, -7);
        await loadTasks();
    });
    el('agendaNextWeek')?.addEventListener('click', async () => {
        weekStart = addDays(weekStart, 7);
        await loadTasks();
    });
    el('agendaThisWeekBtn')?.addEventListener('click', async () => {
        weekStart = startOfWeek(new Date());
        await loadTasks();
    });

    document.querySelectorAll('[data-close-modal="agendaTaskModalOverlay"]').forEach((btn) => {
        btn.addEventListener('click', closeTaskModal);
    });
    el('agendaTaskModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeTaskModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTaskModal();
            closeCardMenu();
        }
    });
}

init();
