/* ==========================================================
   NEXA HUB — Componente: tablero de Tareas por responsable
   ==========================================================
   Vista NEXA | CLIENTE. Agrupa admins por persona y clientes
   por perfil. No toca Supabase: solo render + handlers.
   ========================================================== */
import { PROGRESS_STATUS_LABELS, TASK_PRIORITY_LABELS, formatDate, escapeHtml, getInitials } from '../../components/projectUi.js';

const STATUS_OPTIONS = ['pending', 'in_progress', 'waiting_approval', 'completed', 'blocked', 'finished'];

const PRIORITY_BADGE_CLASS = {
    low: 'admin-badge--pending',
    medium: 'admin-badge--progress',
    high: 'admin-badge--paused',
    urgent: 'admin-badge--completed'
};

const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-.8 12.1a2 2 0 0 1-2 1.9H8.8a2 2 0 0 1-2-1.9L6 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_OPEN = '<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function isClientTask(task) {
    if (task.task_type === 'client' || task.task_type === 'approval') return true;
    if (task.assignee_id && task.clientId && task.assignee_id === task.clientId) return true;
    if (task.profiles?.role === 'client') return true;
    return false;
}

function isOverdue(task) {
    if (!task.due_date) return false;
    if (['completed', 'finished', 'approved', 'cancelled'].includes(task.status)) return false;
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
}

function groupByPerson(tasks, { clientSide = false } = {}) {
    const map = new Map();

    tasks.forEach((task) => {
        let key;
        let label;

        if (clientSide) {
            key = task.clientId || task.assignee_id || 'client';
            label = task.clientName || task.profiles?.full_name || 'Cliente';
        } else {
            key = task.assignee_id || 'unassigned';
            label = task.profiles?.full_name || 'Sin asignar';
        }

        if (!map.has(key)) {
            map.set(key, { key, label, tasks: [] });
        }
        map.get(key).tasks.push(task);
    });

    return [...map.values()].sort((a, b) => {
        if (a.key === 'unassigned') return 1;
        if (b.key === 'unassigned') return -1;
        return a.label.localeCompare(b.label, 'es');
    });
}

function renderTaskItem(task, index) {
    const overdue = isOverdue(task);
    const statusOptions = STATUS_OPTIONS.map((s) =>
        `<option value="${s}" ${task.status === s ? 'selected' : ''}>${PROGRESS_STATUS_LABELS[s] || s}</option>`
    ).join('');

    return `
        <article class="task-board-item ${overdue ? 'is-overdue' : ''}" data-task-index="${index}">
            <div class="task-board-item-top">
                <strong class="task-board-item-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</strong>
                <div class="task-board-item-actions">
                    ${task.projectId ? `<a class="admin-action-btn" href="proyecto-detalle.html?id=${task.projectId}" title="Abrir proyecto">${ICON_OPEN}</a>` : ''}
                    <button type="button" class="admin-action-btn" data-board-action="edit" data-task-index="${index}" title="Editar">${ICON_EDIT}</button>
                    <button type="button" class="admin-action-btn admin-action-btn--danger" data-board-action="delete" data-task-index="${index}" title="Eliminar">${ICON_TRASH}</button>
                </div>
            </div>
            <p class="task-board-item-meta">
                ${escapeHtml(task.projectName || 'Proyecto')}${task.phaseName ? ` · ${escapeHtml(task.phaseName)}` : ''}
            </p>
            <div class="task-board-item-footer">
                <span class="admin-badge ${PRIORITY_BADGE_CLASS[task.priority] || 'admin-badge--pending'}">${TASK_PRIORITY_LABELS[task.priority] || task.priority}</span>
                <select class="admin-select admin-select--compact task-board-status" data-board-action="status" data-task-index="${index}" title="Cambiar estado">
                    ${statusOptions}
                </select>
                <span class="task-board-item-due ${overdue ? 'is-overdue' : ''}">${task.due_date ? formatDate(task.due_date) : 'Sin fecha'}</span>
            </div>
        </article>
    `;
}

function renderPersonGroup(group, flatIndexOffset, sideClass) {
    const items = group.tasks.map((task, i) => {
        const globalIndex = flatIndexOffset + i;
        return renderTaskItem(task, globalIndex);
    }).join('');

    return `
        <div class="task-board-person ${sideClass}">
            <div class="task-board-person-header">
                <span class="task-board-person-avatar">${getInitials(group.label)}</span>
                <div class="task-board-person-info">
                    <strong>${escapeHtml(group.label)}</strong>
                    <span>${group.tasks.length} tarea${group.tasks.length === 1 ? '' : 's'}</span>
                </div>
            </div>
            <div class="task-board-person-list">
                ${items || '<span class="admin-empty-inline">Sin tareas.</span>'}
            </div>
        </div>
    `;
}

/**
 * @param {HTMLElement} container
 * @param {Array<object>} tasks - tareas aplanadas
 * @param {{onStatusChange:Function, onEdit:Function, onDelete:Function}} handlers
 */
export function renderTaskBoard(container, tasks, handlers) {
    if (!container) return;

    const nexaTasks = [];
    const clientTasks = [];
    const indexMap = [];

    tasks.forEach((task) => {
        if (isClientTask(task)) clientTasks.push(task);
        else nexaTasks.push(task);
    });

    const nexaGroups = groupByPerson(nexaTasks, { clientSide: false });
    const clientGroups = groupByPerson(clientTasks, { clientSide: true });

    // Índice global estable para handlers
    let cursor = 0;
    const ordered = [];
    nexaGroups.forEach((g) => {
        g._offset = cursor;
        g.tasks.forEach((t) => { indexMap[cursor] = t; ordered.push(t); cursor += 1; });
    });
    clientGroups.forEach((g) => {
        g._offset = cursor;
        g.tasks.forEach((t) => { indexMap[cursor] = t; ordered.push(t); cursor += 1; });
    });

    container.innerHTML = `
        <div class="task-board-column task-board-column--nexa">
            <div class="task-board-column-header">
                <span class="task-board-column-badge task-board-column-badge--nexa">NEXA</span>
                <span class="task-board-column-count">${nexaTasks.length}</span>
            </div>
            <div class="task-board-column-body">
                ${nexaGroups.length
                    ? nexaGroups.map((g) => renderPersonGroup(g, g._offset, 'is-nexa')).join('')
                    : '<span class="admin-empty-inline">No hay tareas del equipo NEXA con estos filtros.</span>'}
            </div>
        </div>
        <div class="task-board-column task-board-column--client">
            <div class="task-board-column-header">
                <span class="task-board-column-badge task-board-column-badge--client">CLIENTE</span>
                <span class="task-board-column-count">${clientTasks.length}</span>
            </div>
            <div class="task-board-column-body">
                ${clientGroups.length
                    ? clientGroups.map((g) => renderPersonGroup(g, g._offset, 'is-client')).join('')
                    : '<span class="admin-empty-inline">No hay tareas del cliente con estos filtros.</span>'}
            </div>
        </div>
    `;

    container.querySelectorAll('[data-board-action]').forEach((elm) => {
        const action = elm.getAttribute('data-board-action');
        const idx = Number(elm.getAttribute('data-task-index'));
        const task = indexMap[idx] || ordered[idx];
        if (!task) return;

        if (action === 'status') {
            elm.addEventListener('change', () => handlers.onStatusChange?.(task, elm.value, elm));
        } else if (action === 'edit') {
            elm.addEventListener('click', () => handlers.onEdit?.(task));
        } else if (action === 'delete') {
            elm.addEventListener('click', () => handlers.onDelete?.(task));
        }
    });
}
