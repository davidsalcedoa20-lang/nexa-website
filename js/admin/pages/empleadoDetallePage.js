/* ==========================================================
   NEXA HUB — Detalle empleado + Espacio de trabajo
   ========================================================== */
import {
    getEmployee, getEmployeeStats, listEmployeeProjects, createEmployeeProject,
    updateEmployeeProject, listProjectTasks, createProjectTask, updateProjectTask,
    deleteProjectTask, reorderProjectTasks, listTaskComments, addTaskComment,
    subscribeEmployeeChannel
} from '../../services/employeeService.js';
import { escapeHtml } from '../../components/projectUi.js';

const params = new URLSearchParams(location.search);
const employeeId = params.get('id');
const root = document.getElementById('empDetailRoot');

let employee = null;
let projects = [];
let activeProjectId = null;
let tasks = [];
let unsub = [];

function initials(first, last) {
    return `${(first || '?')[0]}${(last || '?')[0]}`.toUpperCase();
}

function statusLabel(s) {
    return ({ pendiente: 'Pendiente', en_edicion: 'En edición', entregado: 'Entregado' })[s] || s;
}

function priorityLabel(p) {
    return ({ alta: 'Alta', media: 'Media', baja: 'Baja' })[p] || p;
}

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nextDays(count = 14) {
    const days = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < count; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push(d);
    }
    return days;
}

function ymd(d) {
    return d.toISOString().slice(0, 10);
}

async function init() {
    if (!employeeId || !root) {
        if (root) root.innerHTML = '<p class="emp-empty">Empleado no encontrado.</p>';
        return;
    }

    root.innerHTML = '<div class="admin-state" style="display:flex"><div class="admin-spinner"></div><span>Cargando…</span></div>';

    try {
        employee = await getEmployee(employeeId);
        if (!employee) throw new Error('Empleado no encontrado');
        projects = await listEmployeeProjects(employeeId);
        if (!projects.length) {
            const created = await createEmployeeProject({
                employee_id: employeeId,
                title: 'Proyecto principal',
                instructions: '',
                drive_url: null
            });
            projects = [created];
        }
        activeProjectId = projects[0].id;
        await refreshTasks();
        render();
        bindRealtime();
    } catch (err) {
        console.error(err);
        root.innerHTML = `<p class="emp-empty">Error: ${escapeHtml(err.message)}</p>`;
    }
}

async function refreshTasks() {
    tasks = await listProjectTasks(activeProjectId);
}

function activeProject() {
    return projects.find((p) => p.id === activeProjectId);
}

async function render() {
    const stats = await getEmployeeStats(employeeId);
    const name = `${employee.first_name} ${employee.last_name}`;
    const role = employee.employee_roles?.label || employee.role_key;
    const email = employee.profiles?.email || '';
    const color = employee.color_hex || '#2D8CFF';
    const avatar = employee.photo_url
        ? `<img src="${escapeHtml(employee.photo_url)}" alt="">`
        : escapeHtml(initials(employee.first_name, employee.last_name));
    const project = activeProject();

    root.innerHTML = `
        <div class="emp-page">
            <div class="emp-profile-bar" style="--emp-color:${escapeHtml(color)}">
                <div class="emp-avatar">${avatar}</div>
                <div style="flex:1;min-width:180px">
                    <span class="emp-kicker">Empleado · Editor</span>
                    <h1 style="margin:0;color:#fff;font-size:26px">${escapeHtml(name)}</h1>
                    <p style="margin:4px 0 0;color:#9a9a9a">${escapeHtml(role)} · ${escapeHtml(email)}</p>
                </div>
                <span class="emp-pill ${employee.status === 'active' ? 'is-active' : 'is-inactive'}">${employee.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                <a class="admin-btn-secondary" href="empleados.html">← Volver</a>
            </div>

            <div class="emp-stats">
                <div class="emp-stat"><span>Productividad</span><strong>${stats.productivity}%</strong></div>
                <div class="emp-stat"><span>Videos pendientes</span><strong>${stats.pending}</strong></div>
                <div class="emp-stat"><span>Videos entregados</span><strong>${stats.delivered}</strong></div>
                <div class="emp-stat"><span>Última entrega</span><strong style="font-size:16px">${escapeHtml(formatDate(stats.lastDelivery))}</strong></div>
            </div>

            <div class="emp-workspace-title">Espacio de trabajo</div>
            <div class="emp-projects-row" id="empProjectTabs">
                ${projects.map((p) => `
                    <button type="button" class="emp-project-tab${p.id === activeProjectId ? ' is-active' : ''}" data-project="${p.id}">${escapeHtml(p.title)}</button>
                `).join('')}
                <button type="button" class="emp-project-tab" id="empAddProject">+ Proyecto</button>
            </div>

            <div class="emp-workspace">
                <section class="emp-ws-card" id="cardMaterial">
                    <div class="emp-ws-head">
                        <div><h2>Material</h2><p>Enlace de Google Drive del proyecto</p></div>
                    </div>
                    <div class="emp-drive">
                        <div class="emp-drive-icon">
                            <svg viewBox="0 0 24 24" fill="none"><path d="M4 18l4-8h8l4 8H4Zm4-8 4-7 4 7H8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
                        </div>
                        <input id="empDriveUrl" type="url" placeholder="https://drive.google.com/..." value="${escapeHtml(project?.drive_url || '')}">
                        <button type="button" class="emp-link-btn" id="empSaveDrive">Guardar</button>
                        <a id="empOpenDrive" class="emp-link-btn" href="${escapeHtml(project?.drive_url || '#')}" target="_blank" rel="noopener" ${project?.drive_url ? '' : 'style="opacity:.4;pointer-events:none"'}>Abrir carpeta</a>
                    </div>
                    <input id="empProjectTitle" value="${escapeHtml(project?.title || '')}" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#fff;padding:10px 12px;font:inherit" placeholder="Nombre del proyecto">
                </section>

                <section class="emp-ws-card" id="cardInstructions">
                    <div class="emp-ws-head">
                        <div><h2>Instrucciones</h2><p>Briefing para el editor</p></div>
                        <button type="button" class="admin-btn-secondary" id="empSaveInstructions">Guardar</button>
                    </div>
                    <div class="emp-toolbar">
                        <button type="button" data-cmd="bold"><b>B</b></button>
                        <button type="button" data-cmd="insertUnorderedList">• Lista</button>
                        <button type="button" data-cmd="insertOrderedList">1. Lista</button>
                    </div>
                    <div class="emp-editor" id="empInstructions" contenteditable="true" data-placeholder="Escribe las instrucciones del proyecto…">${project?.instructions || ''}</div>
                </section>

                <section class="emp-ws-card" id="cardVideos">
                    <div class="emp-ws-head">
                        <div><h2>Videos a editar</h2><p>Arrastra para reordenar o al calendario</p></div>
                        <button type="button" class="admin-btn-primary" id="empAddVideo">+ Nuevo video</button>
                    </div>
                    <div class="emp-video-list" id="empVideoList">${renderVideos()}</div>
                </section>

                <section class="emp-ws-card" id="cardCalendar">
                    <div class="emp-ws-head">
                        <div><h2>Calendario del editor</h2><p>Próximos días · suelta un video para fijar entrega</p></div>
                    </div>
                    <div class="emp-calendar" id="empCalendar">${renderCalendar()}</div>
                </section>
            </div>
        </div>

        <div class="admin-modal-overlay" id="empVideoModal">
            <div class="admin-modal emp-modal" style="width:min(560px,94vw)">
                <div class="admin-modal-header">
                    <h3 id="empVideoModalTitle">Nuevo video</h3>
                    <button type="button" class="admin-modal-close" id="empVideoModalClose">✕</button>
                </div>
                <form id="empVideoForm" class="admin-form" style="padding:18px 20px 22px;display:grid;gap:12px">
                    <input type="hidden" name="id">
                    <div class="admin-field"><label>Nombre</label><input name="name" required></div>
                    <div class="admin-field"><label>Descripción</label><textarea name="description" rows="3"></textarea></div>
                    <div class="admin-field"><label>Prioridad</label>
                        <select name="priority"><option value="alta">Alta</option><option value="media" selected>Media</option><option value="baja">Baja</option></select>
                    </div>
                    <div class="admin-field"><label>Duración</label><input name="duration_label" placeholder="Ej. 45 segundos"></div>
                    <div class="admin-field"><label>Estado</label>
                        <select name="status"><option value="pendiente">Pendiente</option><option value="en_edicion">En edición</option><option value="entregado">Entregado</option></select>
                    </div>
                    <span class="admin-form-error" id="empVideoError"></span>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" id="empVideoCancel">Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    bindUi();
}

function renderVideos() {
    if (!tasks.length) return '<div class="emp-empty">Aún no hay videos. Crea el primero.</div>';
    return tasks.map((t) => `
        <article class="emp-video" draggable="true" data-task-id="${t.id}">
            <div class="emp-video-top">
                <div>
                    <div class="emp-video-num">Video ${String(t.number).padStart(2, '0')}</div>
                    <h3>${escapeHtml(t.name)}</h3>
                    <p>${escapeHtml(t.description || '')}</p>
                </div>
            </div>
            <div class="emp-video-meta">
                <span class="emp-chip priority-${t.priority}">${priorityLabel(t.priority)}</span>
                <span class="emp-chip">${escapeHtml(t.duration_label || '—')}</span>
                <span class="emp-chip status-${t.status}">${statusLabel(t.status)}</span>
                ${t.delivery_date ? `<span class="emp-chip">📅 ${escapeHtml(t.delivery_date)}</span>` : ''}
            </div>
            <div class="emp-video-actions">
                <button type="button" data-edit="${t.id}">Editar</button>
                <button type="button" class="is-danger" data-del="${t.id}">Eliminar</button>
                <button type="button" data-chat="${t.id}">Comentarios</button>
            </div>
            <div class="emp-chat" id="chat-${t.id}" hidden></div>
        </article>
    `).join('');
}

function renderCalendar() {
    const color = employee?.color_hex || '#8C52FF';
    return nextDays(14).map((d) => {
        const key = ymd(d);
        const dayTasks = tasks.filter((t) => t.delivery_date === key);
        const label = d.toLocaleDateString('es-CO', { weekday: 'short' });
        return `
            <div class="emp-day" data-date="${key}">
                <div class="emp-day-label">${escapeHtml(label)}<strong>${d.getDate()}</strong></div>
                ${dayTasks.map((t) => `
                    <div class="emp-day-task" draggable="true" data-task-id="${t.id}" style="--emp-color:${escapeHtml(color)}">
                        ${escapeHtml(t.name)}
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

function bindUi() {
    document.getElementById('empAddProject')?.addEventListener('click', async () => {
        const title = window.prompt('Nombre del proyecto');
        if (!title) return;
        const p = await createEmployeeProject({ employee_id: employeeId, title: title.trim() });
        projects.unshift(p);
        activeProjectId = p.id;
        await refreshTasks();
        render();
    });

    document.querySelectorAll('[data-project]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            activeProjectId = btn.getAttribute('data-project');
            await refreshTasks();
            render();
        });
    });

    document.getElementById('empSaveDrive')?.addEventListener('click', async () => {
        const drive_url = document.getElementById('empDriveUrl').value.trim() || null;
        const title = document.getElementById('empProjectTitle').value.trim() || 'Proyecto';
        await updateEmployeeProject(activeProjectId, { drive_url, title });
        const idx = projects.findIndex((p) => p.id === activeProjectId);
        if (idx >= 0) projects[idx] = { ...projects[idx], drive_url, title };
        render();
    });

    document.querySelectorAll('.emp-toolbar [data-cmd]').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.execCommand(btn.getAttribute('data-cmd'), false, null);
            document.getElementById('empInstructions')?.focus();
        });
    });

    document.getElementById('empSaveInstructions')?.addEventListener('click', async () => {
        const instructions = document.getElementById('empInstructions').innerHTML;
        await updateEmployeeProject(activeProjectId, { instructions });
        const idx = projects.findIndex((p) => p.id === activeProjectId);
        if (idx >= 0) projects[idx].instructions = instructions;
        window.alert('Instrucciones guardadas');
    });

    document.getElementById('empAddVideo')?.addEventListener('click', () => openVideoModal());
    document.getElementById('empVideoModalClose')?.addEventListener('click', closeVideoModal);
    document.getElementById('empVideoCancel')?.addEventListener('click', closeVideoModal);

    document.getElementById('empVideoForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.id.value;
        const payload = {
            name: form.name.value.trim(),
            description: form.description.value.trim(),
            priority: form.priority.value,
            duration_label: form.duration_label.value.trim(),
            status: form.status.value
        };
        if (!payload.name) return;
        if (id) {
            await updateProjectTask(id, payload);
        } else {
            const number = (tasks.reduce((m, t) => Math.max(m, t.number || 0), 0) || 0) + 1;
            await createProjectTask({
                project_id: activeProjectId,
                number,
                sort_order: tasks.length,
                ...payload
            });
        }
        closeVideoModal();
        await refreshTasks();
        render();
    });

    document.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const t = tasks.find((x) => x.id === btn.getAttribute('data-edit'));
            if (t) openVideoModal(t);
        });
    });

    document.querySelectorAll('[data-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!window.confirm('¿Eliminar este video?')) return;
            await deleteProjectTask(btn.getAttribute('data-del'));
            await refreshTasks();
            render();
        });
    });

    document.querySelectorAll('[data-chat]').forEach((btn) => {
        btn.addEventListener('click', () => toggleChat(btn.getAttribute('data-chat')));
    });

    setupDnD();
}

function openVideoModal(task = null) {
    const modal = document.getElementById('empVideoModal');
    const form = document.getElementById('empVideoForm');
    document.getElementById('empVideoModalTitle').textContent = task ? 'Editar video' : 'Nuevo video';
    form.id.value = task?.id || '';
    form.name.value = task?.name || '';
    form.description.value = task?.description || '';
    form.priority.value = task?.priority || 'media';
    form.duration_label.value = task?.duration_label || '';
    form.status.value = task?.status || 'pendiente';
    modal.classList.add('active');
}

function closeVideoModal() {
    document.getElementById('empVideoModal')?.classList.remove('active');
}

async function toggleChat(taskId) {
    const box = document.getElementById(`chat-${taskId}`);
    if (!box) return;
    const showing = !box.hidden;
    box.hidden = showing;
    if (showing) return;

    const comments = await listTaskComments(taskId);
    box.innerHTML = `
        ${comments.map((c) => `
            <div class="emp-chat-msg">
                <strong>${escapeHtml(c.profiles?.full_name || 'Usuario')}</strong>
                <div>${escapeHtml(c.body)}</div>
            </div>
        `).join('') || '<div class="emp-chat-msg">Sin comentarios aún.</div>'}
        <form class="emp-chat-form" data-chat-form="${taskId}">
            <input name="body" placeholder="Escribe un comentario…" required>
            <button type="submit" class="emp-mini-btn">Enviar</button>
        </form>
    `;
    box.querySelector('form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = e.target.body.value.trim();
        if (!body) return;
        await addTaskComment(taskId, body);
        toggleChat(taskId);
        toggleChat(taskId);
    });
}

function setupDnD() {
    const list = document.getElementById('empVideoList');
    let dragId = null;

    list?.querySelectorAll('.emp-video').forEach((el) => {
        el.addEventListener('dragstart', (e) => {
            dragId = el.getAttribute('data-task-id');
            el.classList.add('is-dragging');
            e.dataTransfer.setData('text/task-id', dragId);
            e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragend', () => el.classList.remove('is-dragging'));
    });

    list?.addEventListener('dragover', (e) => e.preventDefault());
    list?.addEventListener('drop', async (e) => {
        e.preventDefault();
        const target = e.target.closest('.emp-video');
        if (!dragId || !target) return;
        const targetId = target.getAttribute('data-task-id');
        if (dragId === targetId) return;
        const ids = tasks.map((t) => t.id);
        const from = ids.indexOf(dragId);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        await reorderProjectTasks(ids);
        await refreshTasks();
        render();
    });

    document.querySelectorAll('.emp-day').forEach((day) => {
        day.addEventListener('dragover', (e) => {
            e.preventDefault();
            day.classList.add('is-over');
        });
        day.addEventListener('dragleave', () => day.classList.remove('is-over'));
        day.addEventListener('drop', async (e) => {
            e.preventDefault();
            day.classList.remove('is-over');
            const id = e.dataTransfer.getData('text/task-id') || dragId;
            if (!id) return;
            await updateProjectTask(id, { delivery_date: day.getAttribute('data-date') });
            await refreshTasks();
            render();
        });
    });

    document.querySelectorAll('.emp-day-task').forEach((el) => {
        el.addEventListener('dragstart', (e) => {
            dragId = el.getAttribute('data-task-id');
            e.dataTransfer.setData('text/task-id', dragId);
        });
    });
}

function bindRealtime() {
    unsub.forEach((fn) => fn());
    unsub = [
        subscribeEmployeeChannel(`emp-tasks-${activeProjectId}`, 'employee_tasks', `project_id=eq.${activeProjectId}`, async () => {
            await refreshTasks();
            render();
        }),
        subscribeEmployeeChannel(`emp-projects-${employeeId}`, 'employee_projects', `employee_id=eq.${employeeId}`, async () => {
            projects = await listEmployeeProjects(employeeId);
            render();
        })
    ];
}

init();
