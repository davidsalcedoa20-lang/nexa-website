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
    WORKWEEK_LABELS,
    startOfWeek,
    addDays,
    toISODate,
    formatAgendaTime,
    formatMinutes,
    sortAgendaTasks,
    computeAgendaStats,
    getAgendaCardTone,
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
    if (el('agendaStatUrgent')) el('agendaStatUrgent').textContent = String(stats.urgentCount);
    if (el('agendaStatImportant')) el('agendaStatImportant').textContent = String(stats.importantCount);
    if (el('agendaStatScheduled')) el('agendaStatScheduled').textContent = String(stats.scheduledCount);
    if (el('agendaStatDone')) el('agendaStatDone').textContent = String(stats.completedCount);
    renderFocusCard(stats);
}

function renderFocusCard(stats) {
    const percent = stats.focusPercent || 0;
    const circumference = 238.76;
    const offset = circumference - (percent / 100) * circumference;
    if (el('wsFocusPercent')) el('wsFocusPercent').textContent = `${percent}%`;
    if (el('wsFocusCount')) el('wsFocusCount').textContent = `${stats.focusDone} de ${stats.focusTotal}`;
    if (el('wsFocusProgress')) el('wsFocusProgress').style.strokeDashoffset = String(offset);
}

function renderWeekLabel() {
    const end = addDays(weekStart, 4);
    const opts = { day: 'numeric', month: 'long' };
    el('agendaWeekLabel').textContent =
        `${weekStart.toLocaleDateString('es-CO', opts)} – ${end.toLocaleDateString('es-CO', { ...opts, year: 'numeric' })}`;
}

function renderWeekBoard() {
    const board = el('agendaWeekView');
    const todayIso = toISODate(new Date());

    board.innerHTML = WORKWEEK_LABELS.map((label, index) => {
        const dayDate = addDays(weekStart, index);
        const iso = toISODate(dayDate);
        const dayTasks = sortAgendaTasks(tasks.filter((t) => t.task_date === iso));
        const isToday = iso === todayIso;
        const dateLabel = dayDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

        return `
            <div class="agenda-day-col ${isToday ? 'is-today' : ''}" data-date="${iso}">
                <div class="agenda-day-header">
                    <div>
                        <strong>${label}</strong>
                        <span class="agenda-day-date">${dateLabel}</span>
                    </div>
                    <span class="agenda-day-count">${dayTasks.length}</span>
                </div>
                <div class="agenda-day-list" data-drop-date="${iso}">
                    ${dayTasks.map((task) => renderCard(task)).join('') || '<span class="agenda-day-empty">Sin tareas</span>'}
                </div>
                <button type="button" class="agenda-add-day-btn" data-add-day="${iso}">+ Agregar tarea</button>
            </div>
        `;
    }).join('');

    wireDragAndDrop();
    wireCardMenus();
    wireAddDayButtons();
}

function wireAddDayButtons() {
    document.querySelectorAll('[data-add-day]').forEach((btn) => {
        btn.addEventListener('click', () => {
            openTaskModal(null, btn.getAttribute('data-add-day'));
        });
    });
}

function renderTodayView() {
    const todayIso = toISODate(new Date());
    const todayTasks = sortAgendaTasks(tasks.filter((t) => t.task_date === todayIso));
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
    const desc = shortDesc.length > 100 ? `${shortDesc.slice(0, 100)}…` : shortDesc;
    const tone = getAgendaCardTone(task);
    const timeLabel = task.task_time ? formatAgendaTime(task.task_time) : '';

    return `
        <article class="agenda-card tone-${tone.key} ${large ? 'is-large' : ''}"
            draggable="true"
            data-task-id="${task.id}"
            data-date="${task.task_date}">
            <div class="agenda-card-top">
                <span class="agenda-tone-label">${tone.label}</span>
                <div class="agenda-card-top-right">
                    ${timeLabel ? `<span class="agenda-card-time">${timeLabel}</span>` : ''}
                    ${tone.key === 'done' ? '<span class="agenda-check">✓</span>' : ''}
                    <button type="button" class="agenda-card-menu-btn" data-open-menu="${task.id}" aria-label="Menú">⋯</button>
                </div>
            </div>
            <strong class="agenda-card-title">${escapeHtml(task.title)}</strong>
            ${projectName ? `<span class="agenda-card-project"><svg viewBox="0 0 24 24" fill="none"><path d="M3 7l9-4 9 4-9 4-9-4Z" stroke="currentColor" stroke-width="1.6"/><path d="M3 12l9 4 9-4" stroke="currentColor" stroke-width="1.6"/></svg>${escapeHtml(projectName)}</span>` : ''}
            <div class="agenda-card-footer">
                <span class="agenda-status-pill status-${task.status}">${AGENDA_STATUS_LABELS[task.status]}</span>
                ${task.estimated_minutes ? `<span class="agenda-card-mins">${formatMinutes(task.estimated_minutes)}</span>` : ''}
            </div>
            ${tags.length ? `<div class="agenda-card-tags">${tags.map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
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
function openTaskModal(task = null, presetDate = null) {
    editingTaskId = task?.id || null;
    el('agendaTaskModalTitle').textContent = task ? 'Editar tarea' : 'Nueva tarea';
    el('agendaTaskSubmitBtn').textContent = task ? 'Guardar cambios' : 'Crear tarea';
    el('agendaTaskDeleteBtn').style.display = task ? 'inline-flex' : 'none';

    el('agendaTaskTitle').value = task?.title || '';
    el('agendaTaskDescription').value = task?.description || '';
    el('agendaTaskProject').value = task?.project_id || '';
    el('agendaTaskDate').value = task?.task_date || presetDate || toISODate(new Date());
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
    const tips = [
        'Enfócate en completar tus tareas urgentes primero para mantener tu productividad al máximo.',
        'Agrupa las tareas similares el mismo día para reducir el cambio de contexto.',
        'Si una tarea toma más de 90 minutos, divídela en bloques más pequeños.',
        'Revisa tu Workspace cada mañana y reprograma lo que ya no es prioritario.'
    ];
    if (el('wsTipText')) {
        el('wsTipText').textContent = tips[Math.floor(Math.random() * tips.length)];
    }

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
