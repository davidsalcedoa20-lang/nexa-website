/* ==========================================================
   NEXA HUB — Componente: tabla de Tareas (standalone, admin)
   ==========================================================
   Componente de interfaz puro: recibe tareas YA aplanadas
   (ver flattenTask en tareasPage.js) y solo renderiza filas +
   un <select> de estado con edición inline. Toda la lógica de
   Supabase vive en taskService.js / tareasPage.js.
   ========================================================== */
import { PROGRESS_STATUS_LABELS, TASK_TYPE_LABELS, TASK_PRIORITY_LABELS, formatDate, escapeHtml, getInitials } from '../../components/projectUi.js';

const STATUS_OPTIONS = ['pending', 'in_progress', 'waiting_approval', 'completed', 'blocked', 'finished'];

const TYPE_BADGE_CLASS = {
    client: 'admin-badge--paused',
    nexa: 'admin-badge--progress',
    approval: 'admin-badge--pending'
};

const PRIORITY_BADGE_CLASS = {
    low: 'admin-badge--pending',
    medium: 'admin-badge--progress',
    high: 'admin-badge--paused',
    urgent: 'admin-badge--completed'
};

const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-.8 12.1a2 2 0 0 1-2 1.9H8.8a2 2 0 0 1-2-1.9L6 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_OPEN = '<svg viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function isOverdue(task) {
    if (!task.due_date) return false;
    if (['completed', 'finished'].includes(task.status)) return false;
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
}

/**
 * @param {HTMLElement} tbody
 * @param {Array<object>} tasks - tareas aplanadas (ver flattenTask)
 * @param {{onStatusChange:Function, onEdit:Function, onDelete:Function}} handlers
 */
export function renderTaskTable(tbody, tasks, handlers) {
    if (!tbody) return;

    if (!tasks.length) {
        tbody.innerHTML = '';
        return;
    }

    tbody.innerHTML = tasks.map((task, index) => {
        const overdue = isOverdue(task);
        const responsibleLabel = task.task_type === 'client'
            ? (task.clientName || 'Cliente')
            : (task.profiles?.full_name || 'Sin asignar');

        return `
            <tr data-row-index="${index}">
                <td>
                    <div class="admin-table-company">
                        <strong>${escapeHtml(task.title)}</strong>
                        ${task.phaseName ? `<span>${escapeHtml(task.phaseName)}${task.sectionName ? ' · ' + escapeHtml(task.sectionName) : ''}</span>` : ''}
                    </div>
                </td>
                <td>
                    <div class="admin-table-company">
                        <strong>${escapeHtml(task.projectName || '—')}</strong>
                        ${task.clientName ? `<span>${escapeHtml(task.clientName)}</span>` : ''}
                    </div>
                </td>
                <td><span class="admin-badge ${TYPE_BADGE_CLASS[task.task_type] || 'admin-badge--pending'}">${TASK_TYPE_LABELS[task.task_type] || task.task_type}</span></td>
                <td>
                    <div class="admin-table-company">
                        <span>${getInitials(responsibleLabel)} · ${escapeHtml(responsibleLabel)}</span>
                    </div>
                </td>
                <td><span class="admin-badge ${PRIORITY_BADGE_CLASS[task.priority] || 'admin-badge--pending'}">${TASK_PRIORITY_LABELS[task.priority] || task.priority}</span></td>
                <td>
                    <select class="admin-select admin-select--compact" data-status-select data-row-index="${index}">
                        ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === task.status ? 'selected' : ''}>${PROGRESS_STATUS_LABELS[s]}</option>`).join('')}
                    </select>
                </td>
                <td style="${overdue ? 'color:#FF6B6B; font-weight:600;' : ''}">${task.due_date ? formatDate(task.due_date) : '—'}${overdue ? ' · Vencida' : ''}</td>
                <td>
                    <div class="admin-table-actions">
                        <a class="admin-action-btn" href="proyecto-detalle.html?id=${task.projectId}" title="Ver proyecto">${ICON_OPEN}</a>
                        <button type="button" class="admin-action-btn" data-action="edit" data-row-index="${index}" title="Editar tarea">${ICON_EDIT}</button>
                        <button type="button" class="admin-action-btn admin-action-btn--danger" data-action="delete" data-row-index="${index}" title="Eliminar tarea">${ICON_TRASH}</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('[data-status-select]').forEach((select) => {
        select.addEventListener('change', () => {
            const task = tasks[Number(select.getAttribute('data-row-index'))];
            if (task && handlers.onStatusChange) handlers.onStatusChange(task, select.value, select);
        });
    });

    tbody.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const rowIndex = Number(btn.getAttribute('data-row-index'));
            const task = tasks[rowIndex];
            const action = btn.getAttribute('data-action');
            if (action === 'edit' && handlers.onEdit) handlers.onEdit(task);
            if (action === 'delete' && handlers.onDelete) handlers.onDelete(task);
        });
    });
}
