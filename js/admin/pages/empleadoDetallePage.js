/* ==========================================================
   NEXA HUB — Detalle empleado + asignación de videos
   ========================================================== */
import {
    getEmployee, getEmployeeStats, listEmployeeProjects, createEmployeeProject,
    listProjectTasks, createProjectTask, updateProjectTask,
    deleteProjectTask, reorderProjectTasks, subscribeEmployeeChannel
} from '../../services/employeeService.js';
import {
    statusLabel, normalizeTaskStatus, folderDisplayName,
    compressImageFile, formatTaskDate
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
                    <span class="emp-kicker">Empleado · Editor</span>
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
                        <div><h2>Videos a editar</h2><p>Asigna material, portada e instrucciones</p></div>
                        <button type="button" class="admin-btn-primary" id="empAddVideo">+ Nuevo video</button>
                    </div>
                    <div class="emp-video-list" id="empVideoList">${renderVideos()}</div>
                </section>
                <section class="emp-ws-card span-2">
                    <div class="emp-ws-head">
                        <div><h2>Calendario de entregas</h2><p>Se actualiza en vivo cuando el editor mueve una fecha</p></div>
                    </div>
                    <div class="emp-calendar" id="empCalendar">${renderCalendar()}</div>
                </section>
            </div>
        </div>

        <div class="admin-modal-overlay" id="empVideoModal">
            <div class="admin-modal emp-modal emp-modal--workspace">
                <div class="admin-modal-header">
                    <h3 id="empVideoModalTitle">Nuevo video</h3>
                    <button type="button" class="admin-modal-close" id="empVideoModalClose">✕</button>
                </div>
                <form id="empVideoForm" class="emp-assign-layout">
                    <input type="hidden" name="id">
                    <div class="emp-assign-form">
                        <div class="emp-assign-block">
                            <h4>Información principal</h4>
                            <div class="admin-field">
                                <label>Título del video</label>
                                <input name="name" required placeholder="Ej. Reel Fachada" data-live>
                            </div>
                            <div class="admin-field">
                                <label>Descripción / indicaciones</label>
                                <textarea name="description" rows="7" placeholder="Instrucciones detalladas para el editor…" data-live></textarea>
                            </div>
                            <div class="admin-field">
                                <label>Fecha límite de entrega</label>
                                <input name="delivery_date" type="date" data-live>
                            </div>
                        </div>

                        <div class="emp-assign-block">
                            <h4>Material del Proyecto</h4>
                            <div class="admin-field">
                                <label>Enlace de Google Drive</label>
                                <input name="drive_url" type="url" placeholder="https://drive.google.com/..." data-live>
                            </div>
                            <div class="admin-field">
                                <label>Nombre de la carpeta</label>
                                <input name="drive_folder_name" placeholder="Ej. Material Reel Fachada" data-live>
                            </div>
                            <div class="emp-material-actions">
                                <button type="button" class="admin-btn-secondary" id="empClearDrive">Quitar carpeta</button>
                                <a class="emp-link-btn emp-link-btn--sm" id="empPreviewOpenDrive" href="#" target="_blank" rel="noopener" style="pointer-events:none;opacity:.4">Abrir carpeta</a>
                            </div>
                        </div>

                        <div class="emp-assign-block">
                            <h4>Imagen del Proyecto</h4>
                            <div class="emp-cover-uploader">
                                <div class="emp-cover-preview" id="empCoverPreview">
                                    <span>Sin imagen</span>
                                </div>
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

                        <span class="admin-form-error" id="empVideoError"></span>
                        <div class="admin-modal-actions">
                            <button type="button" class="admin-btn-secondary" id="empVideoCancel">Cancelar</button>
                            <button type="submit" class="admin-btn-primary">Guardar</button>
                        </div>
                    </div>

                    <aside class="emp-assign-preview" id="empLivePreview" aria-live="polite"></aside>
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
        const st = normalizeTaskStatus(t.status);
        return `
        <article class="emp-video emp-video--admin emp-video--rich" draggable="true" data-task-id="${t.id}">
            <div class="emp-video-cover">${t.cover_url
                ? `<img src="${escapeHtml(t.cover_url)}" alt="">`
                : '<div class="emp-video-cover-fallback"></div>'}</div>
            <div class="emp-video-body">
                <div class="emp-video-top">
                    <h3>${escapeHtml(t.name)}</h3>
                    <span class="emp-chip status-${st}">${statusLabel(st)}</span>
                </div>
                <div class="emp-video-meta">
                    <span class="emp-chip">Fecha límite: ${escapeHtml(formatTaskDate(t.delivery_date))}</span>
                    <span class="emp-chip">${escapeHtml(folderDisplayName(t))}</span>
                </div>
                <div class="emp-video-actions">
                    ${folder
                        ? `<a class="emp-link-btn emp-link-btn--sm" href="${escapeHtml(folder)}" target="_blank" rel="noopener">Abrir carpeta</a>`
                        : '<span class="emp-chip">Sin carpeta</span>'}
                    <button type="button" data-edit="${t.id}">Editar</button>
                    <button type="button" class="is-danger" data-del="${t.id}">Eliminar</button>
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
                    <div class="emp-day-task" draggable="true" data-task-id="${t.id}" style="--emp-color:${escapeHtml(color)}">
                        ${escapeHtml(t.name)}
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

function updateLivePreview() {
    const form = document.getElementById('empVideoForm');
    const preview = document.getElementById('empLivePreview');
    if (!form || !preview) return;
    const name = form.name.value.trim() || 'Título del video';
    const date = form.delivery_date.value;
    const drive = form.drive_url.value.trim();
    const folderName = form.drive_folder_name.value.trim()
        || (drive ? folderDisplayName({ drive_url: drive }) : 'Sin carpeta');
    const editorName = `${employee.first_name} ${employee.last_name}`;
    const cover = draftCoverCleared ? null : (draftCover || form.dataset.existingCover || '');

    const openBtn = document.getElementById('empPreviewOpenDrive');
    if (openBtn) {
        if (drive) {
            openBtn.href = drive;
            openBtn.style.pointerEvents = '';
            openBtn.style.opacity = '1';
        } else {
            openBtn.href = '#';
            openBtn.style.pointerEvents = 'none';
            openBtn.style.opacity = '.4';
        }
    }

    preview.innerHTML = `
        <div class="emp-live-card">
            <span class="emp-kicker">Resumen</span>
            <div class="emp-live-cover">${cover
                ? `<img src="${escapeHtml(cover)}" alt="">`
                : '<div class="emp-live-cover-empty">Portada</div>'}</div>
            <h3>${escapeHtml(name)}</h3>
            <dl class="emp-live-meta">
                <div><dt>Editor</dt><dd>${escapeHtml(editorName)}</dd></div>
                <div><dt>Fecha límite</dt><dd>${escapeHtml(formatTaskDate(date))}</dd></div>
                <div><dt>Estado</dt><dd><span class="emp-chip status-pendiente">Pendiente</span></dd></div>
                <div><dt>Carpeta Drive</dt><dd>${escapeHtml(folderName)}</dd></div>
            </dl>
        </div>
    `;
}

function setCoverPreview(url) {
    const box = document.getElementById('empCoverPreview');
    if (!box) return;
    if (url) {
        box.innerHTML = `<img src="${escapeHtml(url)}" alt="Portada">`;
    } else {
        box.innerHTML = '<span>Sin imagen</span>';
    }
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

    const form = document.getElementById('empVideoForm');
    form?.querySelectorAll('[data-live]').forEach((el) => {
        el.addEventListener('input', updateLivePreview);
        el.addEventListener('change', updateLivePreview);
    });

    document.getElementById('empClearDrive')?.addEventListener('click', () => {
        if (!form) return;
        form.drive_url.value = '';
        form.drive_folder_name.value = '';
        updateLivePreview();
    });

    const coverInput = document.getElementById('empCoverInput');
    const pickCover = () => coverInput?.click();
    document.getElementById('empCoverChange')?.addEventListener('click', pickCover);
    coverInput?.addEventListener('change', async () => {
        const file = coverInput.files?.[0];
        if (!file) return;
        try {
            draftCover = await compressImageFile(file);
            draftCoverCleared = false;
            setCoverPreview(draftCover);
            updateLivePreview();
        } catch (err) {
            window.alert(err.message);
        }
        coverInput.value = '';
    });
    document.getElementById('empCoverRemove')?.addEventListener('click', () => {
        draftCover = null;
        draftCoverCleared = true;
        setCoverPreview(null);
        updateLivePreview();
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('empVideoError');
        if (errEl) { errEl.textContent = ''; errEl.classList.remove('active'); }
        const id = form.id.value;
        const payload = {
            name: form.name.value.trim(),
            description: form.description.value,
            drive_url: form.drive_url.value.trim() || null,
            drive_folder_name: form.drive_folder_name.value.trim() || null,
            delivery_date: form.delivery_date.value || null
        };
        if (draftCoverCleared) payload.cover_url = null;
        else if (draftCover) payload.cover_url = draftCover;

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
                    checklist: {},
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
    form.drive_folder_name.value = task?.drive_folder_name || '';
    form.delivery_date.value = task?.delivery_date || '';
    draftCover = null;
    draftCoverCleared = false;
    form.dataset.existingCover = task?.cover_url || '';
    setCoverPreview(task?.cover_url || null);
    updateLivePreview();
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

    document.querySelectorAll('.emp-day').forEach((day) => {
        day.addEventListener('dragover', (e) => { e.preventDefault(); day.classList.add('is-over'); });
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
