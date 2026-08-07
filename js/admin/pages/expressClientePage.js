/* ==========================================================
   NEXA HUB — Detalle Cliente Express + proyectos
   ========================================================== */
import {
    getExpressClient,
    updateExpressClient,
    listExpressProjects,
    createExpressProject,
    updateExpressProject,
    deleteExpressProject,
    parseDriveFolderFromUrl
} from '../services/expressClientService.js';
import { openExpressClientModal } from '../components/expressClientModal.js';
import { openExpressProjectModal } from '../components/expressProjectModal.js';
import { listEmployees } from '../../services/employeeService.js';
import {
    expressProjectTypeLabel,
    expressProjectStatusLabel
} from '../expressProjectCatalog.js';
import { escapeHtml } from '../../components/projectUi.js';

const root = document.getElementById('expressRoot');
const clientId = new URLSearchParams(window.location.search).get('id');

let client = null;
let projects = [];
let employeesCache = [];

async function init() {
    if (!root) return;
    if (!clientId) {
        window.location.href = 'clientes.html';
        return;
    }
    root.innerHTML = '<p class="fin-loading">Cargando cliente Express…</p>';
    try {
        employeesCache = await listEmployees()
            .then((list) => (list || []).map((e) => ({
                id: e.id,
                full_name: e.full_name || e.profiles?.full_name || 'Empleado',
                role_label: e.employee_roles?.label || e.role_key || ''
            })))
            .catch(() => []);
        await reload();
        render();
    } catch (error) {
        root.innerHTML = `<p class="fin-error">${escapeHtml(error.message)}</p>
            <a class="admin-btn-secondary" href="clientes.html">Volver</a>`;
    }
}

async function reload() {
    client = await getExpressClient(clientId);
    if (!client) throw new Error('Cliente Express no encontrado.');
    projects = await listExpressProjects(clientId);
}

function moneyDate(d) {
    if (!d) return '—';
    try {
        return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    } catch (_) {
        return d;
    }
}

function render() {
    root.innerHTML = `
        <div class="cx-page">
            <div class="cx-top">
                <a class="cx-back" href="clientes.html">← Clientes</a>
                <div class="cx-hero">
                    <div>
                        <span class="cx-kicker">Cliente Express</span>
                        <h1>${escapeHtml(client.full_name)}</h1>
                        <p>${escapeHtml(client.company || 'Sin empresa')}${client.phone ? ` · ${escapeHtml(client.phone)}` : ''}${client.whatsapp ? ` · WA ${escapeHtml(client.whatsapp)}` : ''}</p>
                    </div>
                    <div class="cx-hero-actions">
                        <button type="button" class="admin-btn-secondary" id="cxEditClient">Editar cliente</button>
                        <button type="button" class="admin-btn-primary" id="cxNewProject">+ Nuevo proyecto</button>
                    </div>
                </div>
            </div>

            <section class="cx-card">
                <h2>Observaciones del cliente</h2>
                <p class="cx-notes">${escapeHtml(client.notes || '—')}</p>
            </section>

            <section class="cx-projects">
                <div class="cx-section-head">
                    <h2>Proyectos (${projects.length})</h2>
                </div>
                ${projects.length ? projects.map(renderProjectCard).join('') : `
                    <div class="cx-empty">
                        <p>Todavía no hay proyectos. Crea el primero para este cliente Express.</p>
                        <button type="button" class="admin-btn-primary" id="cxNewProjectEmpty">+ Nuevo proyecto</button>
                    </div>
                `}
            </section>
            <div id="cxModalHost"></div>
        </div>
    `;
    wire();
}

function renderProjectCard(p) {
    const linked = !!(p.drive_connected && (p.drive_folder_url || p.drive_folder_id));
    return `
        <article class="cx-project-card" data-project-id="${p.id}">
            <div class="cx-project-head">
                <div>
                    <span class="cx-type-pill">${escapeHtml(expressProjectTypeLabel(p.project_type))}</span>
                    <h3>${escapeHtml(p.name)}</h3>
                </div>
                <span class="cx-status status-${escapeHtml(p.status)}">${escapeHtml(expressProjectStatusLabel(p.status))}</span>
            </div>
            <div class="cx-project-meta">
                <div><span>Inicio</span><b>${escapeHtml(moneyDate(p.start_date))}</b></div>
                <div><span>Entrega</span><b>${escapeHtml(moneyDate(p.due_date))}</b></div>
                <div><span>Responsable</span><b>${escapeHtml(p.responsible_name || '—')}</b></div>
            </div>

            <div class="cx-drive-block">
                <div class="cx-drive-top">
                    <strong>Carpeta del Proyecto</strong>
                    <div class="cx-drive-actions">
                        ${linked ? `
                            <a class="admin-btn-secondary" href="${escapeHtml(p.drive_folder_url || `https://drive.google.com/drive/folders/${p.drive_folder_id}`)}" target="_blank" rel="noopener">Abrir carpeta</a>
                            <button type="button" class="admin-btn-secondary" data-drive="${p.id}">Cambiar carpeta</button>
                        ` : `
                            <button type="button" class="admin-btn-primary" data-drive="${p.id}">Vincular carpeta</button>
                        `}
                    </div>
                </div>
                <p class="cx-drive-name">${linked ? escapeHtml(p.drive_folder_name || 'Carpeta vinculada') : 'Sin carpeta vinculada'}</p>
            </div>

            <div class="cx-obs-block">
                <strong>Observaciones del proyecto</strong>
                <p>${escapeHtml(p.observations || 'Sin observaciones todavía.')}</p>
            </div>

            <div class="cx-project-actions">
                <button type="button" class="admin-btn-secondary" data-edit-project="${p.id}">Editar</button>
                <button type="button" class="admin-icon-btn" data-del-project="${p.id}" title="Eliminar">✕</button>
            </div>
        </article>
    `;
}

function openProjectEditor(row) {
    openExpressProjectModal({
        mode: row ? 'edit' : 'create',
        project: row || null,
        clientLabel: client?.full_name || '',
        employees: employeesCache,
        onSubmit: async (payload) => {
            if (row) await updateExpressProject(row.id, payload);
            else await createExpressProject(clientId, payload);
            await reload();
            render();
        }
    });
}

function wire() {
    document.getElementById('cxEditClient')?.addEventListener('click', () => {
        openExpressClientModal({
            mode: 'edit',
            client,
            onSubmit: async (payload) => {
                await updateExpressClient(clientId, payload);
                await reload();
                render();
            }
        });
    });

    const openNew = () => openProjectEditor(null);
    document.getElementById('cxNewProject')?.addEventListener('click', openNew);
    document.getElementById('cxNewProjectEmpty')?.addEventListener('click', openNew);

    document.querySelectorAll('[data-edit-project]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const p = projects.find((x) => x.id === btn.getAttribute('data-edit-project'));
            openProjectEditor(p || null);
        });
    });

    document.querySelectorAll('[data-del-project]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!window.confirm('¿Eliminar este proyecto Express?')) return;
            await deleteExpressProject(btn.getAttribute('data-del-project'));
            await reload();
            render();
        });
    });

    document.querySelectorAll('[data-drive]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const p = projects.find((x) => x.id === btn.getAttribute('data-drive'));
            openDriveModal(p);
        });
    });
}

function openDriveModal(project) {
    if (!project) return;
    const host = document.getElementById('cxModalHost');
    if (!host) return;
    host.innerHTML = `
        <div class="admin-modal-overlay active">
            <div class="admin-modal" role="dialog">
                <div class="admin-modal-header">
                    <h3>Carpeta del Proyecto</h3>
                    <button type="button" class="admin-modal-close" data-close>✕</button>
                </div>
                <form id="cxDriveForm" class="admin-form">
                    <div class="admin-field">
                        <label>Nombre de la carpeta</label>
                        <input name="drive_folder_name" value="${escapeHtml(project.drive_folder_name || '')}" placeholder="Ej. Cliente — Proyecto">
                    </div>
                    <div class="admin-field">
                        <label>URL de Google Drive</label>
                        <input name="drive_folder_url" value="${escapeHtml(project.drive_folder_url || '')}" placeholder="https://drive.google.com/drive/folders/…">
                        <span class="admin-field-hint">Pega el enlace de la carpeta. Se usará para Abrir carpeta.</span>
                    </div>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" data-unlink>Quitar vínculo</button>
                        <button type="button" class="admin-btn-secondary" data-close>Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar carpeta</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    const close = () => { host.innerHTML = ''; };
    host.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    host.querySelector('[data-unlink]')?.addEventListener('click', async () => {
        await updateExpressProject(project.id, {
            name: project.name,
            project_type: project.project_type,
            status: project.status,
            start_date: project.start_date,
            due_date: project.due_date,
            responsible_name: project.responsible_name,
            observations: project.observations,
            drive_folder_id: null,
            drive_folder_name: null,
            drive_folder_url: null
        });
        close();
        await reload();
        render();
    });
    host.querySelector('#cxDriveForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const name = String(fd.get('drive_folder_name') || '').trim();
        const urlRaw = String(fd.get('drive_folder_url') || '').trim();
        const parsed = parseDriveFolderFromUrl(urlRaw);
        await updateExpressProject(project.id, {
            name: project.name,
            project_type: project.project_type,
            status: project.status,
            start_date: project.start_date,
            due_date: project.due_date,
            responsible_name: project.responsible_name,
            observations: project.observations,
            drive_folder_id: parsed.id,
            drive_folder_name: name || project.drive_folder_name || 'Carpeta Drive',
            drive_folder_url: parsed.url || urlRaw || null
        });
        close();
        await reload();
        render();
    });
}

init();
