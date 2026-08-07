/* ==========================================================
   Modal: crear / editar proyecto Cliente Express
   ========================================================== */
import {
    EXPRESS_PROJECT_TYPES,
    EXPRESS_PROJECT_STATUS,
    expressProjectTypeLabel
} from '../expressProjectCatalog.js';
import { parseDriveFolderFromUrl } from '../services/expressClientService.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {object} opts
 * @param {'create'|'edit'} [opts.mode]
 * @param {object|null} [opts.project]
 * @param {string} [opts.clientLabel]
 * @param {Array<{id:string, full_name?:string, role_label?:string}>} [opts.employees]
 * @param {(payload: object) => Promise<void>} opts.onSubmit
 */
export function openExpressProjectModal({
    mode = 'create',
    project = null,
    clientLabel = '',
    employees = [],
    onSubmit
} = {}) {
    const existing = document.getElementById('expressProjectModalOverlay');
    if (existing) existing.remove();

    const isEdit = mode === 'edit' || !!project;
    let drive = {
        drive_folder_id: project?.drive_folder_id || null,
        drive_folder_name: project?.drive_folder_name || null,
        drive_folder_url: project?.drive_folder_url || null
    };

    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay active';
    overlay.id = 'expressProjectModalOverlay';
    overlay.innerHTML = `
        <div class="admin-modal cx-project-modal" role="dialog" aria-modal="true">
            <div class="admin-modal-header">
                <h3>${isEdit ? 'Editar proyecto Express' : 'Nuevo proyecto Express'}</h3>
                <button type="button" class="admin-modal-close" data-close aria-label="Cerrar">✕</button>
            </div>
            ${clientLabel ? `<p class="cx-type-intro" style="margin-top:-4px">Cliente: <strong style="color:#fff">${escapeHtml(clientLabel)}</strong> · <span class="cx-kind-badge express">Cliente Express</span></p>` : ''}
            <form id="expressProjectForm" class="admin-form" novalidate>
                <div class="cx-form-grid">
                    <div class="admin-field cx-span-2">
                        <label>Nombre del proyecto *</label>
                        <input name="name" required value="${escapeHtml(project?.name || '')}" placeholder="Ej. Edición Video Corporativo">
                    </div>
                    <div class="admin-field">
                        <label>Tipo de proyecto</label>
                        <select name="project_type" class="admin-select">
                            <option value="">Sin tipo</option>
                            ${EXPRESS_PROJECT_TYPES.map((t) => `
                                <option value="${escapeHtml(t.label)}" ${expressProjectTypeLabel(project?.project_type) === t.label ? 'selected' : ''}>${escapeHtml(t.label)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="admin-field">
                        <label>Estado</label>
                        <select name="status" class="admin-select">
                            ${EXPRESS_PROJECT_STATUS.map((s) => `
                                <option value="${s.key}" ${(project?.status || 'not_started') === s.key ? 'selected' : ''}>${escapeHtml(s.label)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="admin-field">
                        <label>Fecha de inicio</label>
                        <input type="date" name="start_date" value="${escapeHtml(project?.start_date || '')}">
                    </div>
                    <div class="admin-field">
                        <label>Fecha de entrega</label>
                        <input type="date" name="due_date" value="${escapeHtml(project?.due_date || '')}">
                    </div>
                    <div class="admin-field cx-span-2">
                        <label>Responsable</label>
                        <select name="responsible_name" class="admin-select">
                            <option value="">Sin asignar</option>
                            ${employees.map((e) => {
                                const label = e.role_label
                                    ? `${e.full_name || 'Empleado'} — ${e.role_label}`
                                    : (e.full_name || e.label || 'Empleado');
                                const selected = project?.responsible_name === label || project?.responsible_name === e.full_name;
                                return `<option value="${escapeHtml(label)}" ${selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="admin-field cx-span-2">
                        <label>Observaciones del proyecto</label>
                        <textarea name="observations" rows="5" placeholder="Indicaciones, qué debe realizarse, referencias, correcciones, información para el editor…">${escapeHtml(project?.observations || '')}</textarea>
                    </div>
                </div>

                <div class="cx-drive-block" style="margin:14px 0 8px">
                    <div class="cx-drive-top">
                        <strong>Carpeta del proyecto</strong>
                        <div class="cx-drive-actions">
                            <button type="button" class="admin-btn-secondary" id="cxDriveToggle">
                                ${(drive.drive_folder_url || drive.drive_folder_id) ? 'Cambiar carpeta' : 'Vincular carpeta'}
                            </button>
                            ${(drive.drive_folder_url || drive.drive_folder_id) ? `
                                <a class="admin-btn-secondary" id="cxDriveOpen" href="${escapeHtml(drive.drive_folder_url || `https://drive.google.com/drive/folders/${drive.drive_folder_id}`)}" target="_blank" rel="noopener">Abrir carpeta</a>
                            ` : ''}
                        </div>
                    </div>
                    <p class="cx-drive-name" id="cxDriveName">${(drive.drive_folder_url || drive.drive_folder_id) ? escapeHtml(drive.drive_folder_name || 'Carpeta vinculada') : 'Sin carpeta vinculada'}</p>
                    <div id="cxDriveFields" class="cx-drive-fields" hidden>
                        <div class="admin-field">
                            <label>Nombre de la carpeta</label>
                            <input id="cxDriveFolderName" value="${escapeHtml(drive.drive_folder_name || '')}" placeholder="Ej. Cliente — Proyecto">
                        </div>
                        <div class="admin-field">
                            <label>URL de Google Drive</label>
                            <input id="cxDriveFolderUrl" value="${escapeHtml(drive.drive_folder_url || '')}" placeholder="https://drive.google.com/drive/folders/…">
                        </div>
                        <div class="admin-modal-actions" style="margin-top:0">
                            <button type="button" class="admin-btn-secondary" id="cxDriveClear">Quitar vínculo</button>
                            <button type="button" class="admin-btn-primary" id="cxDriveApply">Guardar vínculo</button>
                        </div>
                    </div>
                </div>

                <span class="admin-form-error" id="expressProjectFormError"></span>
                <div class="admin-modal-actions">
                    <button type="button" class="admin-btn-secondary" data-close>Cancelar</button>
                    <button type="submit" class="admin-btn-primary">${isEdit ? 'Guardar cambios' : 'Crear proyecto'}</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    const errorEl = overlay.querySelector('#expressProjectFormError');
    const driveFields = overlay.querySelector('#cxDriveFields');
    const driveNameEl = overlay.querySelector('#cxDriveName');
    const driveToggle = overlay.querySelector('#cxDriveToggle');

    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    driveToggle?.addEventListener('click', () => {
        if (driveFields) driveFields.hidden = !driveFields.hidden;
    });

    overlay.querySelector('#cxDriveClear')?.addEventListener('click', () => {
        drive = { drive_folder_id: null, drive_folder_name: null, drive_folder_url: null };
        const nameInput = overlay.querySelector('#cxDriveFolderName');
        const urlInput = overlay.querySelector('#cxDriveFolderUrl');
        if (nameInput) nameInput.value = '';
        if (urlInput) urlInput.value = '';
        if (driveNameEl) driveNameEl.textContent = 'Sin carpeta vinculada';
        if (driveToggle) driveToggle.textContent = 'Vincular carpeta';
        overlay.querySelector('#cxDriveOpen')?.remove();
        if (driveFields) driveFields.hidden = true;
    });

    overlay.querySelector('#cxDriveApply')?.addEventListener('click', () => {
        const name = String(overlay.querySelector('#cxDriveFolderName')?.value || '').trim();
        const urlRaw = String(overlay.querySelector('#cxDriveFolderUrl')?.value || '').trim();
        const parsed = parseDriveFolderFromUrl(urlRaw);
        drive = {
            drive_folder_id: parsed.id,
            drive_folder_name: name || 'Carpeta Drive',
            drive_folder_url: parsed.url || urlRaw || null
        };
        if (driveNameEl) driveNameEl.textContent = drive.drive_folder_name;
        if (driveToggle) driveToggle.textContent = 'Cambiar carpeta';
        if (driveFields) driveFields.hidden = true;

        let openBtn = overlay.querySelector('#cxDriveOpen');
        if (drive.drive_folder_url || drive.drive_folder_id) {
            const href = drive.drive_folder_url || `https://drive.google.com/drive/folders/${drive.drive_folder_id}`;
            if (!openBtn) {
                openBtn = document.createElement('a');
                openBtn.className = 'admin-btn-secondary';
                openBtn.id = 'cxDriveOpen';
                openBtn.target = '_blank';
                openBtn.rel = 'noopener';
                openBtn.textContent = 'Abrir carpeta';
                driveToggle?.parentElement?.appendChild(openBtn);
            }
            openBtn.href = href;
        }
    });

    overlay.querySelector('#expressProjectForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
            name: fd.get('name'),
            project_type: fd.get('project_type') || 'Otro',
            status: fd.get('status') || 'not_started',
            start_date: fd.get('start_date') || null,
            due_date: fd.get('due_date') || null,
            responsible_name: fd.get('responsible_name') || null,
            observations: fd.get('observations'),
            drive_folder_id: drive.drive_folder_id,
            drive_folder_name: drive.drive_folder_name,
            drive_folder_url: drive.drive_folder_url
        };
        try {
            if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('active'); }
            const submitBtn = e.currentTarget.querySelector('[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando…'; }
            await onSubmit?.(payload);
            close();
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = err.message || 'No se pudo guardar.';
                errorEl.classList.add('active');
            }
            const submitBtn = e.currentTarget.querySelector('[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear proyecto';
            }
        }
    });
}
