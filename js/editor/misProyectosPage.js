/* ==========================================================
   Portal Editor — Mi trabajo / Calendario / Ajustes
   ========================================================== */
import {
    getMyEmployee,
    listMyEmployeeTasks,
    updateProjectTask,
    listTaskComments,
    addTaskComment,
    subscribeEmployeeChannel,
    listEmployeeProjects
} from '../services/employeeService.js';
import {
    TASK_STATUSES, CHECKLIST_ITEMS, statusLabel, normalizeTaskStatus,
    folderDisplayName, formatTaskDate
} from '../services/employeeTaskHelpers.js';
import { escapeHtml } from '../components/projectUi.js';

const root = document.getElementById('editorRoot');
const titleEl = document.getElementById('editorTopTitle');
const userChip = document.getElementById('editorUserChip');

let employee = null;
let tasks = [];
let view = 'trabajo';
let filter = 'todos';
let expandedId = null;
let unsubs = [];
let calendarCursor = new Date();
calendarCursor.setDate(1);
calendarCursor.setHours(0, 0, 0, 0);
let notesTimers = {};

function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function folderOf(task) {
    return task.folder_url || task.drive_url || task.project_drive_url || null;
}

function checklistOf(task) {
    return task.checklist && typeof task.checklist === 'object' ? task.checklist : {};
}

async function loadTasks() {
    tasks = (await listMyEmployeeTasks()).map((t) => ({
        ...t,
        status: normalizeTaskStatus(t.status)
    }));
}

async function init() {
    if (!root) return;
    root.innerHTML = '<div class="admin-state" style="display:flex"><div class="admin-spinner"></div><span>Cargando…</span></div>';
    employee = await getMyEmployee();
    if (!employee) {
        root.innerHTML = '<div class="emp-empty">No se encontró tu perfil de empleado.</div>';
        return;
    }
    if (userChip) userChip.textContent = employee.first_name || 'Editor';
    await loadTasks();
    bindNav();
    render();
    bindRealtime();
}

function bindNav() {
    document.querySelectorAll('[data-editor-view]').forEach((btn) => {
        btn.addEventListener('click', () => {
            view = btn.getAttribute('data-editor-view');
            document.querySelectorAll('[data-editor-view]').forEach((b) => b.classList.toggle('active', b === btn));
            const labels = { trabajo: 'Mi trabajo', calendario: 'Calendario', ajustes: 'Ajustes' };
            if (titleEl) titleEl.textContent = labels[view] || 'Mi trabajo';
            render();
        });
    });
}

function render() {
    if (view === 'calendario') renderCalendarView();
    else if (view === 'ajustes') renderSettingsView();
    else renderWorkView();
}

function filteredTasks() {
    if (filter === 'todos') return tasks;
    return tasks.filter((t) => normalizeTaskStatus(t.status) === filter);
}

function renderWorkView() {
    const list = filteredTasks();
    root.innerHTML = `
        <div class="emp-page editor-work">
            <div class="emp-hero editor-hero">
                <div>
                    <span class="emp-kicker">Espacio de trabajo</span>
                    <h1>¡Hola, ${escapeHtml(employee.first_name)}!</h1>
                    <p>Aquí están tus proyectos audiovisuales, el material y las fechas de entrega.</p>
                </div>
            </div>

            <div class="editor-section-head">
                <h2>Mi trabajo</h2>
                <div class="editor-filters">
                    ${[['todos', 'Todos'], ...TASK_STATUSES.map((s) => [s.id, s.label])].map(([id, label]) => `
                        <button type="button" class="editor-filter${filter === id ? ' is-active' : ''}" data-filter="${id}">${label}</button>
                    `).join('')}
                </div>
            </div>

            <div class="editor-work-list">
                ${list.length
                    ? list.map(renderWorkCard).join('')
                    : '<div class="emp-empty">No hay trabajos en este filtro.</div>'}
            </div>
        </div>
    `;
    bindWorkUi();
}

function renderWorkCard(t) {
    const st = normalizeTaskStatus(t.status);
    const folder = folderOf(t);
    const open = expandedId === t.id;
    const descPreview = (t.description || 'Sin descripción.').slice(0, 160);
    const checklist = checklistOf(t);

    return `
        <article class="editor-job-card${open ? ' is-open' : ''}" data-task-id="${t.id}">
            <div class="editor-job-main">
                <div class="editor-job-thumb">
                    ${t.cover_url
                        ? `<img src="${escapeHtml(t.cover_url)}" alt="">`
                        : '<div class="editor-job-thumb-fallback"></div>'}
                </div>
                <div class="editor-job-info">
                    <div class="editor-job-title-row">
                        <h2>${escapeHtml(t.name)}</h2>
                        <span class="emp-chip status-${st}">${statusLabel(st)}</span>
                    </div>
                    <p class="editor-job-excerpt">${escapeHtml(descPreview)}${(t.description || '').length > 160 ? '…' : ''}</p>
                    <div class="editor-job-actions-row">
                        ${folder
                            ? `<a class="emp-link-btn" href="${escapeHtml(folder)}" target="_blank" rel="noopener">Abrir carpeta</a>`
                            : '<span class="emp-chip">Sin carpeta</span>'}
                        <button type="button" class="admin-btn-secondary" data-expand="${t.id}">${open ? 'Ocultar detalle' : 'Ver detalle'}</button>
                    </div>
                </div>
                <div class="editor-job-side">
                    <div>
                        <span class="editor-meta-label">Fecha límite</span>
                        <strong class="editor-meta-date status-text-${st}">${escapeHtml(formatTaskDate(t.delivery_date))}</strong>
                    </div>
                    <div>
                        <span class="editor-meta-label">Estado</span>
                        <span class="editor-status-dot status-${st}">${statusLabel(st)}</span>
                    </div>
                </div>
            </div>

            ${open ? `
            <div class="editor-job-detail">
                <section>
                    <h3>Descripción</h3>
                    <div class="editor-job-desc">${escapeHtml(t.description || 'Sin instrucciones.').replace(/\n/g, '<br>')}</div>
                </section>

                <section class="editor-material-block">
                    <h3>Material</h3>
                    <div class="editor-material-row">
                        <div>
                            <strong>Carpeta de Google Drive</strong>
                            <p>${escapeHtml(folderDisplayName(t))}</p>
                        </div>
                        ${folder
                            ? `<a class="emp-link-btn emp-link-btn--lg" href="${escapeHtml(folder)}" target="_blank" rel="noopener">Abrir Material</a>`
                            : '<span class="emp-chip">Sin carpeta vinculada</span>'}
                    </div>
                </section>

                <section>
                    <h3>Checklist</h3>
                    <div class="editor-checklist">
                        ${CHECKLIST_ITEMS.map((item) => `
                            <label class="editor-check">
                                <input type="checkbox" data-check="${t.id}" data-key="${item.id}" ${checklist[item.id] ? 'checked' : ''}>
                                <span>${item.label}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>

                <section>
                    <h3>Notas del Editor</h3>
                    <textarea class="editor-notes" data-notes="${t.id}" rows="4" placeholder="Observaciones, dudas o avances…">${escapeHtml(t.editor_notes || '')}</textarea>
                </section>

                <section>
                    <h3>Estado</h3>
                    <div class="editor-status-btns">
                        ${TASK_STATUSES.map((s) => `
                            <button type="button" class="editor-status-btn${st === s.id ? ' is-active' : ''}" data-set-status="${t.id}" data-value="${s.id}">${s.label}</button>
                        `).join('')}
                    </div>
                </section>

                <section>
                    <h3>Comentarios</h3>
                    <button type="button" class="admin-btn-secondary" data-chat="${t.id}">Abrir comentarios</button>
                    <div class="emp-chat editor-job-chat" id="ed-chat-${t.id}" hidden></div>
                </section>
            </div>` : ''}
        </article>
    `;
}

function bindWorkUi() {
    document.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
            filter = btn.getAttribute('data-filter');
            renderWorkView();
        });
    });

    document.querySelectorAll('[data-expand]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-expand');
            expandedId = expandedId === id ? null : id;
            renderWorkView();
        });
    });

    document.querySelectorAll('[data-set-status]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-set-status');
            const value = btn.getAttribute('data-value');
            await updateProjectTask(id, { status: value });
            await loadTasks();
            renderWorkView();
        });
    });

    document.querySelectorAll('[data-check]').forEach((input) => {
        input.addEventListener('change', async () => {
            const id = input.getAttribute('data-check');
            const key = input.getAttribute('data-key');
            const task = tasks.find((t) => t.id === id);
            const next = { ...checklistOf(task), [key]: input.checked };
            await updateProjectTask(id, { checklist: next });
            const idx = tasks.findIndex((t) => t.id === id);
            if (idx >= 0) tasks[idx].checklist = next;
        });
    });

    document.querySelectorAll('[data-notes]').forEach((area) => {
        area.addEventListener('input', () => {
            const id = area.getAttribute('data-notes');
            clearTimeout(notesTimers[id]);
            notesTimers[id] = setTimeout(async () => {
                await updateProjectTask(id, { editor_notes: area.value });
                const idx = tasks.findIndex((t) => t.id === id);
                if (idx >= 0) tasks[idx].editor_notes = area.value;
            }, 500);
        });
    });

    document.querySelectorAll('[data-chat]').forEach((btn) => {
        btn.addEventListener('click', () => toggleChat(btn.getAttribute('data-chat')));
    });
}

async function toggleChat(taskId) {
    const box = document.getElementById(`ed-chat-${taskId}`);
    if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    const comments = await listTaskComments(taskId);
    box.innerHTML = `
        ${comments.map((c) => `<div class="emp-chat-msg"><strong>${escapeHtml(c.profiles?.full_name || 'Usuario')}</strong><div>${escapeHtml(c.body)}</div></div>`).join('') || '<div class="emp-chat-msg">Sin comentarios.</div>'}
        <form class="emp-chat-form"><input name="body" required placeholder="Escribir comentario…"><button type="submit" class="emp-mini-btn">Enviar</button></form>
    `;
    box.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = e.target.body.value.trim();
        if (!body) return;
        await addTaskComment(taskId, body);
        box.hidden = true;
        toggleChat(taskId);
    });
}

function renderCalendarView() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const monthLabel = calendarCursor.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push({ empty: true });
    for (let day = 1; day <= daysInMonth; day++) {
        const key = ymd(new Date(year, month, day));
        cells.push({
            empty: false,
            day,
            key,
            items: tasks.filter((t) => t.delivery_date === key)
        });
    }
    const unscheduled = tasks.filter((t) => !t.delivery_date);

    root.innerHTML = `
        <div class="emp-page editor-cal-page">
            <div class="emp-hero">
                <div>
                    <span class="emp-kicker">Planificación</span>
                    <h1>Calendario</h1>
                    <p>Arrastra un video a otro día para indicar cuándo planeas entregarlo.</p>
                </div>
                <div class="editor-cal-nav">
                    <button type="button" class="admin-btn-secondary" id="calToday">Hoy</button>
                    <button type="button" class="admin-btn-secondary" id="calPrev">←</button>
                    <strong>${escapeHtml(monthLabel)}</strong>
                    <button type="button" class="admin-btn-secondary" id="calNext">→</button>
                </div>
            </div>
            <div class="editor-cal-grid">
                ${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => `<div class="editor-cal-dow">${d}</div>`).join('')}
                ${cells.map((cell) => {
                    if (cell.empty) return '<div class="editor-cal-cell is-empty"></div>';
                    return `
                        <div class="editor-cal-cell emp-day" data-date="${cell.key}">
                            <div class="editor-cal-daynum">${cell.day}</div>
                            ${cell.items.map((t) => {
                                const st = normalizeTaskStatus(t.status);
                                return `<div class="emp-day-task status-cal-${st}" draggable="true" data-task-id="${t.id}">${escapeHtml(t.name)}</div>`;
                            }).join('')}
                        </div>`;
                }).join('')}
            </div>
            <p class="editor-cal-hint">Arrastra y suelta las tareas en el día deseado para reprogramar la fecha límite. El administrador lo verá al instante.</p>
            ${unscheduled.length ? `
                <section class="emp-ws-card" style="margin-top:16px">
                    <div class="emp-ws-head"><div><h2>Sin fecha programada</h2></div></div>
                    <div class="editor-unscheduled">
                        ${unscheduled.map((t) => `<div class="emp-day-task" draggable="true" data-task-id="${t.id}">${escapeHtml(t.name)}</div>`).join('')}
                    </div>
                </section>` : ''}
        </div>
    `;

    document.getElementById('calPrev')?.addEventListener('click', () => {
        calendarCursor.setMonth(calendarCursor.getMonth() - 1);
        renderCalendarView();
    });
    document.getElementById('calNext')?.addEventListener('click', () => {
        calendarCursor.setMonth(calendarCursor.getMonth() + 1);
        renderCalendarView();
    });
    document.getElementById('calToday')?.addEventListener('click', () => {
        calendarCursor = new Date();
        calendarCursor.setDate(1);
        calendarCursor.setHours(0, 0, 0, 0);
        renderCalendarView();
    });
    bindCalendarDnD();
}

function bindCalendarDnD() {
    let dragId = null;
    document.querySelectorAll('.emp-day-task[draggable]').forEach((el) => {
        el.addEventListener('dragstart', (e) => {
            dragId = el.getAttribute('data-task-id');
            e.dataTransfer.setData('text/task-id', dragId);
            el.classList.add('is-dragging');
        });
        el.addEventListener('dragend', () => el.classList.remove('is-dragging'));
    });
    document.querySelectorAll('.editor-cal-cell[data-date]').forEach((day) => {
        day.addEventListener('dragover', (e) => { e.preventDefault(); day.classList.add('is-over'); });
        day.addEventListener('dragleave', () => day.classList.remove('is-over'));
        day.addEventListener('drop', async (e) => {
            e.preventDefault();
            day.classList.remove('is-over');
            const id = e.dataTransfer.getData('text/task-id') || dragId;
            const date = day.getAttribute('data-date');
            if (!id || !date) return;
            await updateProjectTask(id, { delivery_date: date });
            await loadTasks();
            renderCalendarView();
        });
    });
}

function renderSettingsView() {
    const email = employee.profiles?.email || '';
    root.innerHTML = `
        <div class="emp-page">
            <div class="emp-hero">
                <div>
                    <span class="emp-kicker">Cuenta</span>
                    <h1>Ajustes</h1>
                    <p>Tu perfil de editor en NEXA Hub.</p>
                </div>
            </div>
            <section class="emp-ws-card" style="max-width:560px">
                <div class="emp-ws-head"><div><h2>Perfil</h2></div></div>
                <p style="margin:0;color:#cfcfcf;font-size:14px;line-height:1.7">
                    <strong style="color:#fff">${escapeHtml(`${employee.first_name} ${employee.last_name}`)}</strong><br>
                    ${escapeHtml(employee.employee_roles?.label || 'Editor')}<br>
                    ${escapeHtml(email || 'Sin correo visible')}
                </p>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
                    <a class="admin-btn-secondary" href="../portal/change-password.html">Cambiar contraseña</a>
                    <button type="button" class="admin-btn-primary" data-logout>Cerrar sesión</button>
                </div>
            </section>
        </div>
    `;
}

function bindRealtime() {
    unsubs.forEach((fn) => fn());
    unsubs = [];
    listEmployeeProjects(employee.id).then((projects) => {
        unsubs = projects.map((p) =>
            subscribeEmployeeChannel(`editor-tasks-${p.id}`, 'employee_tasks', `project_id=eq.${p.id}`, async () => {
                await loadTasks();
                render();
            })
        );
    }).catch(() => {});
}

init().catch((e) => {
    if (root) root.innerHTML = `<div class="emp-empty">${escapeHtml(e.message)}</div>`;
});
