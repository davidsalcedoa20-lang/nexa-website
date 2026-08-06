/* ==========================================================
   Portal Editor — Mi trabajo (sin calendario independiente)
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
    TASK_STATUSES, statusLabel, normalizeTaskStatus, priorityLabel,
    folderDisplayName, normalizeChecklist, checklistProgress,
    deliveryUrgency, formatDeliveryShort
} from '../services/employeeTaskHelpers.js';
import { escapeHtml } from '../components/projectUi.js';

const root = document.getElementById('editorRoot');
const titleEl = document.getElementById('editorTopTitle');
const userChip = document.getElementById('editorUserChip');

let employee = null;
let tasks = [];
let view = 'trabajo';
let filter = 'todos';
let unsubs = [];

function folderOf(task) {
    return task.folder_url || task.drive_url || task.project_drive_url || null;
}

async function loadTasks() {
    tasks = (await listMyEmployeeTasks()).map((t) => ({
        ...t,
        status: normalizeTaskStatus(t.status),
        checklist: normalizeChecklist(t.checklist)
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
            view = btn.getAttribute('data-editor-view') || 'trabajo';
            document.querySelectorAll('[data-editor-view]').forEach((b) => b.classList.toggle('active', b === btn));
            if (titleEl) titleEl.textContent = view === 'ajustes' ? 'Ajustes' : 'Mi trabajo';
            render();
        });
    });
}

function render() {
    if (view === 'ajustes') renderSettingsView();
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
                    <p>Tus videos, material e indicaciones. Todo organizado por fecha de entrega.</p>
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
    const checklist = normalizeChecklist(t.checklist);
    const progress = checklistProgress(checklist);
    const urgency = deliveryUrgency(t.delivery_date);
    const desc = escapeHtml(t.description || '').replace(/\n/g, '<br>');
    const instructions = escapeHtml(t.instructions || '').replace(/\n/g, '<br>');

    return `
        <article class="ew-card" data-task-id="${t.id}">
            <div class="ew-card-top">
                <div class="ew-cover">
                    ${t.cover_url
                        ? `<img src="${escapeHtml(t.cover_url)}" alt="">`
                        : `<div class="ew-cover-ph"><span>Sin imagen</span></div>`}
                </div>
                <div class="ew-info">
                    <div class="ew-info-head">
                        <div>
                            <span class="ew-client">${escapeHtml(t.client_name || 'Sin cliente')}</span>
                            <h2>${escapeHtml(t.name)}</h2>
                        </div>
                        <div class="ew-delivery urgency-${urgency}">
                            <span>Entrega</span>
                            <strong>${escapeHtml(formatDeliveryShort(t.delivery_date))}</strong>
                        </div>
                    </div>
                    <div class="ew-badges">
                        <span class="emp-chip status-${st}">${statusLabel(st)}</span>
                        <span class="emp-chip priority-${t.priority || 'media'}">Prioridad ${escapeHtml(priorityLabel(t.priority || 'media'))}</span>
                    </div>
                    ${t.description ? `
                        <div class="ew-block">
                            <h3>Descripción</h3>
                            <div class="ew-text">${desc}</div>
                        </div>` : ''}
                    ${t.instructions ? `
                        <div class="ew-block">
                            <h3>Indicaciones</h3>
                            <div class="ew-text">${instructions}</div>
                        </div>` : ''}
                </div>
            </div>

            <div class="ew-section ew-material">
                <div class="ew-material-left">
                    <div class="ew-drive-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M4 18l4-8h8l4 8H4Zm4-8 4-7 4 7H8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
                    </div>
                    <div>
                        <h3>Material del Proyecto</h3>
                        <p>${escapeHtml(folderDisplayName(t))}</p>
                    </div>
                </div>
                ${folder
                    ? `<a class="emp-link-btn emp-link-btn--lg" href="${escapeHtml(folder)}" target="_blank" rel="noopener">Abrir carpeta</a>`
                    : '<span class="emp-chip">Sin carpeta vinculada</span>'}
            </div>

            <div class="ew-section">
                <div class="ew-section-head">
                    <h3>Lista de tareas</h3>
                    <span class="ew-progress-label">${progress}%</span>
                </div>
                <div class="ew-progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
                    <div class="ew-progress-bar" style="width:${progress}%"></div>
                </div>
                <div class="ew-progress-marks">
                    <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>
                <div class="editor-checklist">
                    ${checklist.length
                        ? checklist.map((item) => `
                            <label class="editor-check${item.done ? ' is-done' : ''}">
                                <input type="checkbox" data-check="${t.id}" data-key="${escapeHtml(item.id)}" ${item.done ? 'checked' : ''}>
                                <span>${escapeHtml(item.label)}</span>
                            </label>
                        `).join('')
                        : '<p class="ew-muted">El administrador aún no definió checklist.</p>'}
                </div>
            </div>

            <div class="ew-section">
                <h3>Estado</h3>
                <div class="editor-status-btns">
                    ${TASK_STATUSES.map((s) => `
                        <button type="button" class="editor-status-btn${st === s.id ? ' is-active' : ''}" data-set-status="${t.id}" data-value="${s.id}">${s.label}</button>
                    `).join('')}
                </div>
            </div>

            <div class="ew-section">
                <h3>Comentarios del proyecto</h3>
                <div class="ew-chat" id="ed-chat-${t.id}">
                    <div class="ew-chat-loading">Cargando…</div>
                </div>
                <form class="emp-chat-form ew-chat-form" data-chat-form="${t.id}">
                    <input name="body" required placeholder="Escribe un avance o pregunta…">
                    <button type="submit" class="emp-mini-btn">Enviar</button>
                </form>
            </div>
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
            const next = normalizeChecklist(task?.checklist).map((item) => (
                item.id === key ? { ...item, done: input.checked } : item
            ));
            await updateProjectTask(id, { checklist: next });
            const idx = tasks.findIndex((t) => t.id === id);
            if (idx >= 0) tasks[idx].checklist = next;
            renderWorkView();
        });
    });

    document.querySelectorAll('[data-chat-form]').forEach((form) => {
        const taskId = form.getAttribute('data-chat-form');
        loadChat(taskId);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = e.target.body.value.trim();
            if (!body) return;
            await addTaskComment(taskId, body);
            e.target.reset();
            loadChat(taskId);
        });
    });
}

async function loadChat(taskId) {
    const box = document.getElementById(`ed-chat-${taskId}`);
    if (!box) return;
    try {
        const comments = await listTaskComments(taskId);
        box.innerHTML = comments.length
            ? comments.map((c) => `
                <div class="emp-chat-msg">
                    <strong>${escapeHtml(c.profiles?.full_name || 'Usuario')}</strong>
                    <div>${escapeHtml(c.body)}</div>
                </div>
            `).join('')
            : '<div class="emp-chat-msg">Sin comentarios aún. Escribe el primero.</div>';
    } catch {
        box.innerHTML = '<div class="emp-chat-msg">No se pudieron cargar los comentarios.</div>';
    }
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
                if (view === 'trabajo') renderWorkView();
            })
        );
    }).catch(() => {});
}

init().catch((e) => {
    if (root) root.innerHTML = `<div class="emp-empty">${escapeHtml(e.message)}</div>`;
});
