/* ==========================================================
   NEXA HUB — Detalle empleado + Espacio de trabajo (videos)
   ========================================================== */
import {
    getEmployee, getEmployeeStats, listEmployeeProjects, createEmployeeProject,
    listProjectTasks, createProjectTask, updateProjectTask,
    deleteProjectTask, reorderProjectTasks, subscribeEmployeeChannel
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

function formatDate(iso) {
    if (!iso) return '—';
    const d = iso.length <= 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function folderUrl(task) {
    return task?.drive_url || activeProject()?.drive_url || null;
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
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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

            <div class="emp-workspace emp-workspace--videos">
                <section class="emp-ws-card span-2" id="cardVideos">
                    <div class="emp-ws-head">
                        <div><h2>Videos a editar</h2><p>Asigna material, instrucciones y fecha límite</p></div>
                        <button type="button" class="admin-btn-primary" id="empAddVideo">+ Nuevo video</button>
                    </div>
                    <div class="emp-video-list" id="empVideoList">${renderVideos()}</div>
                </section>

                <section class="emp-ws-card span-2" id="cardCalendar">
                    <div class="emp-ws-head">
                        <div><h2>Calendario de entregas</h2><p>Se actualiza en vivo cuando el editor mueve una fecha</p></div>
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
                <form id="empVideoForm" class="admin-form" style="padding:18px 20px 22px;display:grid;gap:14px;grid-template-columns:1fr">
                    <input type="hidden" name="id">
                    <div class="admin-field">
                        <label>Título del video</label>
                        <input name="name" required placeholder="Ej. Reel Fachada">
                    </div>
                    <div class="admin-field">
                        <label>Descripción / instrucciones</label>
                        <textarea name="description" rows="8" placeholder="Indicaciones para el editor. Puedes usar saltos de línea y listas."></textarea>
                    </div>
                    <div class="admin-field">
                        <label>Carpeta del material (Google Drive)</label>
                        <input name="drive_url" type="url" placeholder="https://drive.google.com/...">
                    </div>
                    <div class="admin-field">
                        <label>Fecha límite</label>
                        <input name="delivery_date" type="date">
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
    return tasks.map((t) => {
        const folder = folderUrl(t);
        return `
        <article class="emp-video emp-video--admin" draggable="true" data-task-id="${t.id}">
            <div class="emp-video-top">
                <div>
                    <h3>${escapeHtml(t.name)}</h3>
                </div>
                <span class="emp-chip status-${t.status}">${statusLabel(t.status)}</span>
            </div>
            <div class="emp-video-meta">
                <span class="emp-chip">Fecha límite: ${escapeHtml(formatDate(t.delivery_date))}</span>
            </div>
            <div class="emp-video-actions">
                ${folder
                    ? `<a class="emp-link-btn emp-link-btn--sm" href="${escapeHtml(folder)}" target="_blank" rel="noopener">Abrir carpeta</a>`
                    : '<span class="emp-chip">Sin carpeta</span>'}
                <button type="button" data-edit="${t.id}">Editar</button>
                <button type="button" class="is-danger" data-del="${t.id}">Eliminar</button>
            </div>
        </article>`;
    }).join('');
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

    document.getElementById('empAddVideo')?.addEventListener('click', () => openVideoModal());
    document.getElementById('empVideoModalClose')?.addEventListener('click', closeVideoModal);
    document.getElementById('empVideoCancel')?.addEventListener('click', closeVideoModal);

    document.getElementById('empVideoForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const errEl = document.getElementById('empVideoError');
        if (errEl) { errEl.textContent = ''; errEl.classList.remove('active'); }
        const id = form.id.value;
        const payload = {
            name: form.name.value.trim(),
            description: form.description.value,
            drive_url: form.drive_url.value.trim() || null,
            delivery_date: form.delivery_date.value || null
        };
        if (!payload.name) return;
        try {
            if (id) {
                await updateProjectTask(id, payload);
            } else {
                const number = (tasks.reduce((m, t) => Math.max(m, t.number || 0), 0) || 0) + 1;
                await createProjectTask({
                    project_id: activeProjectId,
                    number,
                    sort_order: tasks.length,
                    status: 'pendiente',
                    priority: 'media',
                    duration_label: '',
                    ...payload
                });
            }
            closeVideoModal();
            await refreshTasks();
            render();
        } catch (err) {
            if (errEl) {
                errEl.textContent = err.message || 'No se pudo guardar.';
                errEl.classList.add('active');
            }
        }
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

    setupDnD();
}

function openVideoModal(task = null) {
    const modal = document.getElementById('empVideoModal');
    const form = document.getElementById('empVideoForm');
    document.getElementById('empVideoModalTitle').textContent = task ? 'Editar video' : 'Nuevo video';
    form.id.value = task?.id || '';
    form.name.value = task?.name || '';
    form.description.value = task?.description || '';
    form.drive_url.value = task?.drive_url || '';
    form.delivery_date.value = task?.delivery_date || '';
    modal.classList.add('active');
}

function closeVideoModal() {
    document.getElementById('empVideoModal')?.classList.remove('active');
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
