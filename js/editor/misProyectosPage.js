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
import { escapeHtml } from '../components/projectUi.js';

const root = document.getElementById('editorRoot');
const titleEl = document.getElementById('editorTopTitle');
const userChip = document.getElementById('editorUserChip');

let employee = null;
let tasks = [];
let view = 'trabajo';
let unsubs = [];
let calendarCursor = new Date();
calendarCursor.setDate(1);
calendarCursor.setHours(0, 0, 0, 0);

function statusLabel(s) {
    return ({ pendiente: 'Pendiente', en_edicion: 'En edición', entregado: 'Entregado' })[s] || s;
}

function formatDate(iso) {
    if (!iso) return 'Sin fecha límite';
    const d = iso.length <= 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
}

function ymd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function folderOf(task) {
    return task.folder_url || task.drive_url || task.project_drive_url || null;
}

async function loadTasks() {
    tasks = await listMyEmployeeTasks();
}

async function init() {
    if (!root) return;
    root.innerHTML = '<div class="admin-state" style="display:flex"><div class="admin-spinner"></div><span>Cargando…</span></div>';

    employee = await getMyEmployee();
    if (!employee) {
        root.innerHTML = '<div class="emp-empty">No se encontró tu perfil de empleado.</div>';
        return;
    }

    if (userChip) {
        userChip.textContent = `${employee.first_name || 'Editor'}`;
    }

    await loadTasks();
    bindNav();
    render();
    bindRealtime();
}

function bindNav() {
    document.querySelectorAll('[data-editor-view]').forEach((btn) => {
        btn.addEventListener('click', () => {
            view = btn.getAttribute('data-editor-view');
            document.querySelectorAll('[data-editor-view]').forEach((b) => {
                b.classList.toggle('active', b === btn);
            });
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

function renderWorkView() {
    root.innerHTML = `
        <div class="emp-page editor-work">
            <div class="emp-hero">
                <div>
                    <span class="emp-kicker">Portal editor</span>
                    <h1>Mi trabajo</h1>
                    <p>Hola ${escapeHtml(employee.first_name)}. Aquí están tus videos, el material y las fechas de entrega.</p>
                </div>
            </div>
            <div class="editor-work-list">
                ${tasks.length
                    ? tasks.map(renderWorkCard).join('')
                    : '<div class="emp-empty">Aún no tienes videos asignados.</div>'}
            </div>
        </div>
    `;
    bindWorkUi();
}

function renderWorkCard(t) {
    const folder = folderOf(t);
    const desc = escapeHtml(t.description || 'Sin instrucciones.').replace(/\n/g, '<br>');
    return `
        <article class="editor-job-card" data-task-id="${t.id}">
            <div class="editor-job-head">
                <div>
                    <span class="emp-kicker">${escapeHtml(t.project_title || 'Proyecto')}</span>
                    <h2>${escapeHtml(t.name)}</h2>
                </div>
                <span class="emp-chip status-${t.status}">${statusLabel(t.status)}</span>
            </div>
            <div class="editor-job-desc">${desc}</div>
            <div class="editor-job-meta">
                <span class="emp-chip">Fecha límite: ${escapeHtml(formatDate(t.delivery_date))}</span>
            </div>
            <div class="editor-job-actions">
                ${folder
                    ? `<a class="emp-link-btn" href="${escapeHtml(folder)}" target="_blank" rel="noopener">Abrir carpeta</a>`
                    : '<span class="emp-chip">Sin carpeta</span>'}
                <label class="editor-status-label">
                    Estado
                    <select data-status="${t.id}">
                        <option value="pendiente" ${t.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="en_edicion" ${t.status === 'en_edicion' ? 'selected' : ''}>En edición</option>
                        <option value="entregado" ${t.status === 'entregado' ? 'selected' : ''}>Entregado</option>
                    </select>
                </label>
                <button type="button" class="admin-btn-secondary" data-chat="${t.id}">Comentarios</button>
            </div>
            <div class="emp-chat editor-job-chat" id="ed-chat-${t.id}" hidden></div>
        </article>
    `;
}

function bindWorkUi() {
    document.querySelectorAll('[data-status]').forEach((sel) => {
        sel.addEventListener('change', async () => {
            await updateProjectTask(sel.getAttribute('data-status'), { status: sel.value });
            await loadTasks();
            render();
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
        const date = new Date(year, month, day);
        const key = ymd(date);
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
                    <p>Arrastra un video a otro día para indicar cuándo planeas entregarlo. El administrador lo verá al instante.</p>
                </div>
                <div class="editor-cal-nav">
                    <button type="button" class="admin-btn-secondary" id="calPrev">←</button>
                    <strong>${escapeHtml(monthLabel)}</strong>
                    <button type="button" class="admin-btn-secondary" id="calNext">→</button>
                </div>
            </div>

            <div class="editor-cal-grid" id="editorCalGrid">
                ${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => `<div class="editor-cal-dow">${d}</div>`).join('')}
                ${cells.map((cell) => {
                    if (cell.empty) return '<div class="editor-cal-cell is-empty"></div>';
                    return `
                        <div class="editor-cal-cell emp-day" data-date="${cell.key}">
                            <div class="editor-cal-daynum">${cell.day}</div>
                            ${cell.items.map((t) => `
                                <div class="emp-day-task" draggable="true" data-task-id="${t.id}" style="--emp-color:${escapeHtml(employee.color_hex || '#8C52FF')}">
                                    ${escapeHtml(t.name)}
                                </div>
                            `).join('')}
                        </div>
                    `;
                }).join('')}
            </div>

            ${unscheduled.length ? `
                <section class="emp-ws-card" style="margin-top:16px">
                    <div class="emp-ws-head"><div><h2>Sin fecha programada</h2><p>Arrástralos al calendario</p></div></div>
                    <div class="editor-unscheduled" id="editorUnscheduled">
                        ${unscheduled.map((t) => `
                            <div class="emp-day-task" draggable="true" data-task-id="${t.id}" style="--emp-color:${escapeHtml(employee.color_hex || '#8C52FF')}">
                                ${escapeHtml(t.name)}
                            </div>
                        `).join('')}
                    </div>
                </section>
            ` : ''}
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
    bindCalendarDnD();
}

function bindCalendarDnD() {
    let dragId = null;

    document.querySelectorAll('.emp-day-task[draggable]').forEach((el) => {
        el.addEventListener('dragstart', (e) => {
            dragId = el.getAttribute('data-task-id');
            e.dataTransfer.setData('text/task-id', dragId);
            e.dataTransfer.effectAllowed = 'move';
            el.classList.add('is-dragging');
        });
        el.addEventListener('dragend', () => el.classList.remove('is-dragging'));
    });

    document.querySelectorAll('.editor-cal-cell[data-date]').forEach((day) => {
        day.addEventListener('dragover', (e) => {
            e.preventDefault();
            day.classList.add('is-over');
        });
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
