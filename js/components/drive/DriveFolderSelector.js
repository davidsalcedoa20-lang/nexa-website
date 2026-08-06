/* ==========================================================
   DriveFolderSelector — modal para elegir carpeta raíz
   ========================================================== */
import { listDriveFolders, linkProjectDriveFolder } from '../../services/driveApiService.js';
import { escapeHtml, DRIVE_ICON_SVG, fileKindIcon, formatRelativeTime } from './driveUi.js';

export function openDriveFolderSelector({ projectId, onLinked } = {}) {
    const existing = document.getElementById('driveFolderSelectorOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay active pd-drive-modal-overlay';
    overlay.id = 'driveFolderSelectorOverlay';
    overlay.innerHTML = `
        <div class="admin-modal pd-drive-modal" role="dialog" aria-modal="true" aria-labelledby="driveFolderSelectorTitle">
            <div class="admin-modal-header">
                <div class="pd-drive-modal-title">
                    ${DRIVE_ICON_SVG}
                    <div>
                        <h3 id="driveFolderSelectorTitle">Seleccionar carpeta</h3>
                        <p class="pd-drive-modal-sub">Elige la carpeta principal de este proyecto en Google Drive.</p>
                    </div>
                </div>
                <button type="button" class="admin-modal-close" data-drive-close>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
            </div>
            <div class="pd-drive-selector-toolbar">
                <button type="button" class="admin-btn-secondary" data-drive-up hidden>← Subir</button>
                <strong class="pd-drive-selector-path" data-drive-path>Mi unidad</strong>
            </div>
            <div class="pd-drive-selector-list" data-drive-list>
                <div class="pd-drive-skeleton">${skeletonRows(5)}</div>
            </div>
            <div class="admin-modal-actions">
                <button type="button" class="admin-btn-secondary" data-drive-close>Cancelar</button>
                <button type="button" class="admin-btn-primary" data-drive-confirm disabled>Vincular carpeta</button>
            </div>
            <span class="admin-form-error" data-drive-error></span>
        </div>
    `;
    document.body.appendChild(overlay);

    const state = {
        stack: [{ id: 'root', name: 'Mi unidad' }],
        selectedId: null
    };

    const listEl = overlay.querySelector('[data-drive-list]');
    const pathEl = overlay.querySelector('[data-drive-path]');
    const upBtn = overlay.querySelector('[data-drive-up]');
    const confirmBtn = overlay.querySelector('[data-drive-confirm]');
    const errorEl = overlay.querySelector('[data-drive-error]');

    function close() { overlay.remove(); }

    overlay.querySelectorAll('[data-drive-close]').forEach((btn) => btn.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    upBtn.addEventListener('click', () => {
        if (state.stack.length <= 1) return;
        state.stack.pop();
        state.selectedId = null;
        confirmBtn.disabled = true;
        load();
    });

    confirmBtn.addEventListener('click', async () => {
        if (!state.selectedId || !projectId) return;
        confirmBtn.disabled = true;
        errorEl.textContent = '';
        errorEl.classList.remove('active');
        try {
            const result = await linkProjectDriveFolder(projectId, state.selectedId);
            close();
            onLinked?.(result.project);
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.classList.add('active');
            confirmBtn.disabled = false;
        }
    });

    async function load() {
        const current = state.stack[state.stack.length - 1];
        pathEl.textContent = state.stack.map((s) => s.name).join(' / ');
        upBtn.hidden = state.stack.length <= 1;
        listEl.innerHTML = `<div class="pd-drive-skeleton">${skeletonRows(5)}</div>`;
        try {
            const data = await listDriveFolders(current.id, { projectId });
            const folders = data.folders || [];
            if (!folders.length) {
                listEl.innerHTML = '<p class="pd-drive-empty">No hay subcarpetas aquí.</p>';
                return;
            }
            listEl.innerHTML = folders.map((folder) => `
                <button type="button" class="pd-drive-selector-item${state.selectedId === folder.id ? ' is-selected' : ''}" data-folder-id="${escapeHtml(folder.id)}" data-folder-name="${escapeHtml(folder.name)}">
                    ${fileKindIcon('folder')}
                    <span class="pd-drive-selector-item-body">
                        <strong>${escapeHtml(folder.name)}</strong>
                        <small>${formatRelativeTime(folder.modifiedTime)}</small>
                    </span>
                    <span class="pd-drive-selector-enter" data-enter-folder="${escapeHtml(folder.id)}" data-enter-name="${escapeHtml(folder.name)}" title="Abrir">→</span>
                </button>
            `).join('');

            listEl.querySelectorAll('[data-folder-id]').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    if (e.target.closest('[data-enter-folder]')) return;
                    state.selectedId = btn.getAttribute('data-folder-id');
                    confirmBtn.disabled = false;
                    listEl.querySelectorAll('.pd-drive-selector-item').forEach((el) => el.classList.remove('is-selected'));
                    btn.classList.add('is-selected');
                });
                btn.addEventListener('dblclick', () => {
                    enterFolder(btn.getAttribute('data-folder-id'), btn.getAttribute('data-folder-name'));
                });
            });
            listEl.querySelectorAll('[data-enter-folder]').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    enterFolder(btn.getAttribute('data-enter-folder'), btn.getAttribute('data-enter-name'));
                });
            });
        } catch (error) {
            listEl.innerHTML = `<p class="pd-drive-empty">${escapeHtml(error.message)}</p>`;
        }
    }

    function enterFolder(id, name) {
        state.stack.push({ id, name });
        state.selectedId = null;
        confirmBtn.disabled = true;
        load();
    }

    load();
}

function skeletonRows(n) {
    return Array.from({ length: n }, () => '<div class="pd-drive-skel-row"></div>').join('');
}
