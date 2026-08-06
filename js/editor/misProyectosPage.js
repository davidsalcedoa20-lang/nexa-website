/* Portal Editor — Mis proyectos */
import {
    getMyEmployee, listEmployeeProjects, listProjectTasks, updateProjectTask,
    listTaskComments, addTaskComment, subscribeEmployeeChannel
} from '../services/employeeService.js';
import { escapeHtml } from '../components/projectUi.js';

const root = document.getElementById('editorRoot');
let employee = null;
let projects = [];
let unsubs = [];

function statusLabel(s) {
    return ({ pendiente: 'Pendiente', en_edicion: 'En edición', entregado: 'Entregado' })[s] || s;
}

function nextDays(n = 14) {
    const out = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < n; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        out.push(d);
    }
    return out;
}
function ymd(d) { return d.toISOString().slice(0, 10); }

async function init() {
    employee = await getMyEmployee();
    if (!employee) {
        root.innerHTML = '<div class="emp-empty">No se encontró tu perfil de empleado.</div>';
        return;
    }
    projects = await listEmployeeProjects(employee.id);
    await renderAll();
}

async function renderAll() {
    const blocks = [];
    for (const project of projects) {
        const tasks = await listProjectTasks(project.id);
        blocks.push(renderProject(project, tasks));
    }

    root.innerHTML = `
        <div class="emp-page">
            <div class="emp-hero">
                <div>
                    <span class="emp-kicker">Portal editor</span>
                    <h1>Mis proyectos</h1>
                    <p>Hola ${escapeHtml(employee.first_name)}. Organiza tus entregas en el calendario.</p>
                </div>
            </div>
            ${blocks.join('') || '<div class="emp-empty">Aún no tienes proyectos asignados.</div>'}
        </div>
    `;

    bindEditorUi();
    bindRealtime();
}

function renderProject(project, tasks) {
    return `
        <section class="emp-ws-card span-2" style="margin-bottom:16px" data-project-id="${project.id}">
            <div class="emp-ws-head">
                <div>
                    <h2>${escapeHtml(project.title)}</h2>
                    <p>Solo puedes mover fechas, cambiar estado y comentar.</p>
                </div>
                ${project.drive_url ? `<a class="emp-link-btn" href="${escapeHtml(project.drive_url)}" target="_blank" rel="noopener">Abrir Drive</a>` : '<span class="emp-chip">Sin Drive</span>'}
            </div>

            <div class="emp-workspace">
                <div class="emp-ws-card">
                    <div class="emp-ws-head"><div><h2>Material</h2></div></div>
                    <div class="emp-drive">
                        <div class="emp-drive-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 18l4-8h8l4 8H4Z" stroke="currentColor" stroke-width="1.6"/></svg></div>
                        <div style="color:#cfcfcf;font-size:13px">${project.drive_url ? escapeHtml(project.drive_url) : 'El administrador aún no pegó un enlace.'}</div>
                    </div>
                </div>
                <div class="emp-ws-card">
                    <div class="emp-ws-head"><div><h2>Instrucciones</h2></div></div>
                    <div class="emp-editor" style="pointer-events:none;opacity:.95">${project.instructions || '<span style="color:#666">Sin instrucciones.</span>'}</div>
                </div>
                <div class="emp-ws-card">
                    <div class="emp-ws-head"><div><h2>Videos asignados</h2></div></div>
                    <div class="emp-video-list" data-task-list="${project.id}">
                        ${tasks.map((t) => `
                            <article class="emp-video" draggable="true" data-task-id="${t.id}">
                                <div class="emp-video-num">Video ${String(t.number).padStart(2, '0')}</div>
                                <h3>${escapeHtml(t.name)}</h3>
                                <p>${escapeHtml(t.description || '')}</p>
                                <div class="emp-video-meta">
                                    <span class="emp-chip">${escapeHtml(t.duration_label || '—')}</span>
                                    <span class="emp-chip status-${t.status}">${statusLabel(t.status)}</span>
                                    ${t.delivery_date ? `<span class="emp-chip">${escapeHtml(t.delivery_date)}</span>` : ''}
                                </div>
                                <div class="emp-video-actions">
                                    <select data-status="${t.id}">
                                        <option value="pendiente" ${t.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                        <option value="en_edicion" ${t.status === 'en_edicion' ? 'selected' : ''}>En edición</option>
                                        <option value="entregado" ${t.status === 'entregado' ? 'selected' : ''}>Entregado</option>
                                    </select>
                                    <button type="button" data-chat="${t.id}">Comentarios</button>
                                </div>
                                <div class="emp-chat" id="ed-chat-${t.id}" hidden></div>
                            </article>
                        `).join('') || '<div class="emp-empty">Sin videos.</div>'}
                    </div>
                </div>
                <div class="emp-ws-card">
                    <div class="emp-ws-head"><div><h2>Calendario</h2><p>Arrastra un video a un día</p></div></div>
                    <div class="emp-calendar" data-cal="${project.id}">
                        ${nextDays(14).map((d) => {
                            const key = ymd(d);
                            const dayTasks = tasks.filter((t) => t.delivery_date === key);
                            return `<div class="emp-day" data-date="${key}">
                                <div class="emp-day-label">${d.toLocaleDateString('es-CO', { weekday: 'short' })}<strong>${d.getDate()}</strong></div>
                                ${dayTasks.map((t) => `<div class="emp-day-task" style="--emp-color:${escapeHtml(employee.color_hex || '#8C52FF')}">${escapeHtml(t.name)}</div>`).join('')}
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        </section>
    `;
}

function bindEditorUi() {
    let dragId = null;

    document.querySelectorAll('.emp-video[draggable]').forEach((el) => {
        el.addEventListener('dragstart', (e) => {
            dragId = el.getAttribute('data-task-id');
            e.dataTransfer.setData('text/task-id', dragId);
        });
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
            await renderAll();
        });
    });

    document.querySelectorAll('[data-status]').forEach((sel) => {
        sel.addEventListener('change', async () => {
            await updateProjectTask(sel.getAttribute('data-status'), { status: sel.value });
            await renderAll();
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
        <form class="emp-chat-form"><input name="body" required placeholder="Responder…"><button class="emp-mini-btn">Enviar</button></form>
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

function bindRealtime() {
    unsubs.forEach((fn) => fn());
    unsubs = projects.map((p) =>
        subscribeEmployeeChannel(`editor-tasks-${p.id}`, 'employee_tasks', `project_id=eq.${p.id}`, () => renderAll())
    );
}

init().catch((e) => {
    root.innerHTML = `<div class="emp-empty">${escapeHtml(e.message)}</div>`;
});
