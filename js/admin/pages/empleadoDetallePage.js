/* ==========================================================
   NEXA HUB — Detalle empleado + asignación de videos
   ========================================================== */
import {
    getEmployee, getEmployeeStats, listEmployeeProjects, createEmployeeProject,
    listProjectTasks, createProjectTask, updateProjectTask,
    deleteProjectTask, reorderProjectTasks, subscribeEmployeeChannel,
    listTaskComments, addTaskComment
} from '../../services/employeeService.js';
import {
    statusLabel, normalizeTaskStatus, folderDisplayName, priorityLabel,
    compressImageFile, formatTaskDate, normalizeChecklist, newChecklistId
} from '../../services/employeeTaskHelpers.js';
import { escapeHtml } from '../../components/projectUi.js';

const params = new URLSearchParams(location.search);
const employeeId = params.get('id');
const root = document.getElementById('empDetailRoot');

let employee = null;
let projects = [];
let activeProjectId = null;
let tasks = [];
let unsub = [];
let draftCover = null;
let draftCoverCleared = false;
let draftChecklist = [];

function initials(first, last) {
    return `${(first || '?')[0]}${(last || '?')[0]}`.toUpperCase();
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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
            projects = [await createEmployeeProject({
                employee_id: employeeId,
                title: 'Proyecto principal',
                instructions: '',
                drive_url: null
            })];
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
                    <span class="emp-kicker">Director de Edición</span>
                    <h1 style="margin:0;color:#fff;font-size:26px">${escapeHtml(name)}</h1>
                    <p style="margin:4px 0 0;color:#9a9a9a">${escapeHtml(role)} · ${escapeHtml(email)}</p>
                </div>
                <span class="emp-pill ${employee.status === 'active' ? 'is-active' : 'is-inactive'}">${employee.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                <a class="admin-btn-secondary" href="empleados.html">← Volver</a>
            </div>

            <div class="emp-stats">
                <div class="emp-stat"><span>Activos</span><strong>${stats.active ?? stats.pending}</strong></div>
                <div class="emp-stat"><span>Terminados</span><strong>${stats.delivered}</strong></div>
                <div class="emp-stat"><span>Próxima entrega</span><strong style="font-size:15px">${escapeHtml(formatTaskDate(stats.nextDelivery))}</strong></div>
                <div class="emp-stat"><span>Productividad</span><strong>${stats.productivity}%</strong></div>
            </div>

            <div class="emp-workspace-title">Espacio de trabajo</div>
            <div class="emp-projects-row">
                ${projects.map((p) => `
                    <button type="button" class="emp-project-tab${p.id === activeProjectId ? ' is-active' : ''}" data-project="${p.id}">${escapeHtml(p.title)}</button>
                `).join('')}
                <button type="button" class="emp-project-tab" id="empAddProject">+ Proyecto</button>
            </div>

            <div class="emp-workspace emp-workspace--videos">
                <section class="emp-ws-card span-2">
                    <div class="emp-ws-head">
                        <div><h2>Trabajos asignados</h2><p>Creación rápida · director: ${escapeHtml(name)}</p></div>
                        <button type="button" class="admin-btn-primary" id="empAddVideo">+ Nuevo trabajo</button>
                    </div>
                    <div class="emp-video-list" id="empVideoList">${renderVideos()}</div>
                </section>
                <section class="emp-ws-card span-2">
                    <div class="emp-ws-head">
                        <div><h2>Fechas de entrega</h2><p>Se actualiza cuando el director cambia el estado o tú editas la fecha</p></div>
                    </div>
                    <div class="emp-calendar" id="empCalendar">${renderCalendar()}</div>
                </section>
            </div>
        </div>

        <div class="admin-modal-overlay" id="empVideoModal">
            <div class="admin-modal emp-modal emp-modal--fast">
                <div class="admin-modal-header">
                    <h3 id="empVideoModalTitle">Nuevo trabajo</h3>
                    <button type="button" class="admin-modal-close" id="empVideoModalClose">✕</button>
                </div>
                <form id="empVideoForm" class="admin-form emp-fast-form">
                    <input type="hidden" name="id">

                    <div class="emp-assign-block">
                        <h4>Imagen del proyecto</h4>
                        <div class="emp-cover-uploader">
                            <div class="emp-cover-preview" id="empCoverPreview"><span>Sin imagen</span></div>
                            <div class="emp-cover-actions">
                                <label class="admin-btn-secondary emp-file-label">
                                    Subir imagen
                                    <input type="file" id="empCoverInput" accept="image/*" hidden>
                                </label>
                                <button type="button" class="admin-btn-secondary" id="empCoverChange">Cambiar</button>
                                <button type="button" class="admin-btn-secondary is-danger-text" id="empCoverRemove">Eliminar</button>
                            </div>
                        </div>
                    </div>

                    <div class="admin-field">
                        <label>Título</label>
                        <input name="name" required placeholder="Ej. Reel Fachada">
                    </div>
                    <div class="admin-field">
                        <label>Cliente</label>
                        <input name="client_name" placeholder="Nombre del cliente">
                    </div>
                    <div class="admin-field">
                        <label>Descripción</label>
                        <textarea name="description" rows="3" placeholder="Resumen del trabajo"></textarea>
                    </div>
                    <div class="admin-field">
                        <label>Indicaciones</label>
                        <textarea name="instructions" rows="5" placeholder="Indicaciones detalladas para el director de edición"></textarea>
                    </div>
                    <div class="emp-assign-block">
                        <h4>Carpeta de Google Drive</h4>
                        <div class="admin-field" style="margin:0 0 10px">
                            <label>Enlace</label>
                            <input name="drive_url" type="url" placeholder="https://drive.google.com/...">
                        </div>
                        <div class="admin-field" style="margin:0">
                            <label>Nombre visible</label>
                            <input name="drive_folder_name" placeholder="Ej. Material Reel Fachada">
                        </div>
                    </div>
                    <div class="admin-field">
                        <label>Fecha límite</label>
                        <input name="delivery_date" type="date">
                    </div>

                    <div class="emp-assign-block">
                        <div class="ew-section-head" style="margin-bottom:8px">
                            <h4 style="margin:0">Checklist</h4>
                            <button type="button" class="admin-btn-secondary" id="empAddCheckItem">+ Ítem</button>
                        </div>
                        <div id="empChecklistBuilder" class="emp-check-builder"></div>
                    </div>

                    <p class="ew-muted" style="margin:0">Director de Edición asignado: <strong style="color:#fff">${escapeHtml(name)}</strong></p>

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
    if (!tasks.length) return '<div class="emp-empty">Aún no hay trabajos. Crea el primero.</div>';
    return tasks.map((t) => {
        const folder = folderUrl(t);
        const st = normalizeTaskStatus(t.status);
        return `
        <article class="emp-video emp-video--admin emp-video--rich" draggable="true" data-task-id="${t.id}">
            <div class="emp-video-cover">${t.cover_url
                ? `<img src="${escapeHtml(t.cover_url)}" alt="">`
                : '<div class="emp-video-cover-fallback"></div>'}</div>
            <div class="emp-video-body">
                <div class="emp-video-top">
                    <div>
                        <div class="ew-client" style="margin-bottom:4px">${escapeHtml(t.client_name || 'Sin cliente')}</div>
                        <h3>${escapeHtml(t.name)}</h3>
                    </div>
                    <span class="emp-chip status-${st}">${statusLabel(st)}</span>
                </div>
                <div class="emp-video-meta">
                    <span class="emp-chip">Fecha: ${escapeHtml(formatTaskDate(t.delivery_date))}</span>
                    <span class="emp-chip priority-${t.priority || 'media'}">${escapeHtml(priorityLabel(t.priority || 'media'))}</span>
                    <span class="emp-chip">${escapeHtml(folderDisplayName(t))}</span>
                </div>
                <div class="emp-video-actions">
                    ${folder
                        ? `<a class="emp-link-btn emp-link-btn--sm" href="${escapeHtml(folder)}" target="_blank" rel="noopener">Abrir carpeta</a>`
                        : '<span class="emp-chip">Sin carpeta</span>'}
                    <button type="button" data-edit="${t.id}">Editar</button>
                    <button type="button" class="is-danger" data-del="${t.id}">Eliminar</button>
                </div>
                <div class="ew-section" style="padding:14px 0 0;border-top:1px solid rgba(255,255,255,.06);margin-top:14px">
                    <h3>Comentarios</h3>
                    <div class="ew-chat" id="adm-chat-${t.id}"><div class="ew-chat-loading">Cargando…</div></div>
                    <form class="emp-chat-form ew-chat-form" data-adm-chat="${t.id}">
                        <input name="body" required placeholder="Responder al director…">
                        <button type="submit" class="emp-mini-btn">Enviar</button>
                    </form>
                </div>
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
                    <div class="emp-day-task" data-task-id="${t.id}" style="--emp-color:${escapeHtml(color)}">
                        ${escapeHtml(t.name)}
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

function renderChecklistBuilder() {
    const box = document.getElementById('empChecklistBuilder');
    if (!box) return;
    if (!draftChecklist.length) {
        box.innerHTML = '<p class="ew-muted">Agrega ítems que el director irá marcando.</p>';
        return;
    }
    box.innerHTML = draftChecklist.map((item, idx) => `
        <div class="emp-check-row" data-idx="${idx}">
            <input type="text" value="${escapeHtml(item.label)}" data-check-label="${idx}" placeholder="Ej. Buscar tomas">
            <button type="button" class="admin-btn-secondary is-danger-text" data-check-remove="${idx}">✕</button>
        </div>
    `).join('');

    box.querySelectorAll('[data-check-label]').forEach((input) => {
        input.addEventListener('input', () => {
            const i = Number(input.getAttribute('data-check-label'));
            if (draftChecklist[i]) draftChecklist[i].label = input.value;
        });
    });
    box.querySelectorAll('[data-check-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const i = Number(btn.getAttribute('data-check-remove'));
            draftChecklist.splice(i, 1);
            renderChecklistBuilder();
        });
    });
}

function setCoverPreview(url) {
    const box = document.getElementById('empCoverPreview');
    if (!box) return;
    box.innerHTML = url
        ? `<img src="${escapeHtml(url)}" alt="Portada">`
        : '<span>Sin imagen</span>';
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

    document.getElementById('empAddCheckItem')?.addEventListener('click', () => {
        draftChecklist.push({ id: newChecklistId(), label: '', done: false });
        renderChecklistBuilder();
    });

    const coverInput = document.getElementById('empCoverInput');
    document.getElementById('empCoverChange')?.addEventListener('click', () => coverInput?.click());
    coverInput?.addEventListener('change', async () => {
        const file = coverInput.files?.[0];
        if (!file) return;
        try {
            draftCover = await compressImageFile(file);
            draftCoverCleared = false;
            setCoverPreview(draftCover);
        } catch (err) {
            window.alert(err.message);
        }
        coverInput.value = '';
    });
    document.getElementById('empCoverRemove')?.addEventListener('click', () => {
        draftCover = null;
        draftCoverCleared = true;
        setCoverPreview(null);
    });

    document.getElementById('empVideoForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const errEl = document.getElementById('empVideoError');
        if (errEl) { errEl.textContent = ''; errEl.classList.remove('active'); }

        const checklist = draftChecklist
            .map((item) => ({ ...item, label: item.label.trim() }))
            .filter((item) => item.label);

        const payload = {
            name: form.name.value.trim(),
            client_name: form.client_name.value.trim(),
            description: form.description.value,
            instructions: form.instructions.value,
            drive_url: form.drive_url.value.trim() || null,
            drive_folder_name: form.drive_folder_name.value.trim() || null,
            delivery_date: form.delivery_date.value || null,
            priority: 'media',
            checklist
        };
        if (draftCoverCleared) payload.cover_url = null;
        else if (draftCover) payload.cover_url = draftCover;

        if (!payload.name) return;
        try {
            const id = form.id.value;
            if (id) {
                await updateProjectTask(id, payload);
            } else {
                const number = (tasks.reduce((m, t) => Math.max(m, t.number || 0), 0) || 0) + 1;
                await createProjectTask({
                    project_id: activeProjectId,
                    number,
                    sort_order: tasks.length,
                    status: 'pendiente',
                    duration_label: '',
                    editor_notes: '',
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
            if (!window.confirm('¿Eliminar este trabajo?')) return;
            await deleteProjectTask(btn.getAttribute('data-del'));
            await refreshTasks();
            render();
        });
    });

    document.querySelectorAll('[data-adm-chat]').forEach((form) => {
        const taskId = form.getAttribute('data-adm-chat');
        loadAdminChat(taskId);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = e.target.body.value.trim();
            if (!body) return;
            await addTaskComment(taskId, body);
            e.target.reset();
            loadAdminChat(taskId);
        });
    });

    setupDnD();
}

async function loadAdminChat(taskId) {
    const box = document.getElementById(`adm-chat-${taskId}`);
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
            : '<div class="emp-chat-msg">Sin comentarios aún.</div>';
    } catch {
        box.innerHTML = '<div class="emp-chat-msg">No se pudieron cargar los comentarios.</div>';
    }
}

function openVideoModal(task = null) {
    const modal = document.getElementById('empVideoModal');
    const form = document.getElementById('empVideoForm');
    document.getElementById('empVideoModalTitle').textContent = task ? 'Editar trabajo' : 'Nuevo trabajo';
    form.id.value = task?.id || '';
    form.name.value = task?.name || '';
    form.client_name.value = task?.client_name || '';
    form.description.value = task?.description || '';
    form.instructions.value = task?.instructions || '';
    form.drive_url.value = task?.drive_url || '';
    form.drive_folder_name.value = task?.drive_folder_name || '';
    form.delivery_date.value = task?.delivery_date || '';
    draftCover = null;
    draftCoverCleared = false;
    setCoverPreview(task?.cover_url || null);
    draftChecklist = normalizeChecklist(task?.checklist).map((item) => ({ ...item }));
    if (!draftChecklist.length && !task) {
        draftChecklist = [
            { id: newChecklistId(), label: 'Buscar tomas', done: false },
            { id: newChecklistId(), label: 'Sincronizar audio', done: false },
            { id: newChecklistId(), label: 'Corrección de color', done: false },
            { id: newChecklistId(), label: 'Exportar', done: false }
        ];
    }
    renderChecklistBuilder();
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
