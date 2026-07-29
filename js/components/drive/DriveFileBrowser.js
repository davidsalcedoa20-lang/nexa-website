/* ==========================================================
   DriveFileBrowser — modal de navegación de archivos
   ========================================================== */
import { listProjectDriveFiles } from '../../services/driveApiService.js';
import { openDrivePreviewModal } from './DrivePreviewModal.js';
import {
    escapeHtml, formatBytes, formatDriveDate, formatRelativeTime,
    mimeLabel, fileKindIcon, DRIVE_ICON_SVG
} from './driveUi.js';

const FILTERS = [
    { id: 'all', label: 'Todos' },
    { id: 'folders', label: 'Carpetas' },
    { id: 'images', label: 'Imágenes' },
    { id: 'videos', label: 'Videos' },
    { id: 'pdf', label: 'PDF' },
    { id: 'documents', label: 'Documentos' }
];

export function openDriveFileBrowser({ projectId, rootName = 'Documentos', mode = 'admin' } = {}) {
    const existing = document.getElementById('driveFileBrowserOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay active pd-drive-modal-overlay';
    overlay.id = 'driveFileBrowserOverlay';
    overlay.innerHTML = `
        <div class="admin-modal pd-drive-modal pd-drive-browser-modal" role="dialog" aria-modal="true">
            <div class="admin-modal-header">
                <div class="pd-drive-modal-title">
                    ${DRIVE_ICON_SVG}
                    <div>
                        <h3>Archivos del proyecto</h3>
                        <p class="pd-drive-modal-sub" data-browser-path>${escapeHtml(rootName)}</p>
                    </div>
                </div>
                <button type="button" class="admin-modal-close" data-drive-close>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
            </div>
            <div class="pd-drive-browser-toolbar">
                <button type="button" class="admin-btn-secondary" data-browser-back hidden>← Atrás</button>
                <input type="search" class="pd-drive-search" data-browser-search placeholder="Buscar archivos…" autocomplete="off">
                <div class="pd-drive-filters" data-browser-filters>
                    ${FILTERS.map((f) => `<button type="button" class="pd-drive-filter${f.id === 'all' ? ' is-active' : ''}" data-filter="${f.id}">${f.label}</button>`).join('')}
                </div>
            </div>
            <div class="pd-drive-browser-table-wrap">
                <div class="pd-drive-browser-head">
                    <span>Nombre</span>
                    <span>Tipo</span>
                    <span>Peso</span>
                    <span>Modificado</span>
                    <span>Responsable</span>
                    <span></span>
                </div>
                <div class="pd-drive-browser-list" data-browser-list>
                    <div class="pd-drive-skeleton">${Array.from({ length: 6 }, () => '<div class="pd-drive-skel-row"></div>').join('')}</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const state = {
        folderId: null,
        stack: [],
        filter: 'all',
        search: '',
        searchTimer: null
    };

    const listEl = overlay.querySelector('[data-browser-list]');
    const pathEl = overlay.querySelector('[data-browser-path]');
    const backBtn = overlay.querySelector('[data-browser-back]');
    const searchInput = overlay.querySelector('[data-browser-search]');

    const close = () => overlay.remove();
    overlay.querySelectorAll('[data-drive-close]').forEach((btn) => btn.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    backBtn.addEventListener('click', () => {
        if (!state.stack.length) return;
        const prev = state.stack.pop();
        state.folderId = prev;
        load();
    });

    overlay.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
            state.filter = btn.getAttribute('data-filter');
            overlay.querySelectorAll('[data-filter]').forEach((el) => el.classList.toggle('is-active', el === btn));
            load();
        });
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => {
            state.search = searchInput.value.trim();
            load();
        }, 280);
    });

    async function load() {
        listEl.innerHTML = `<div class="pd-drive-skeleton">${Array.from({ length: 6 }, () => '<div class="pd-drive-skel-row"></div>').join('')}</div>`;
        try {
            const data = await listProjectDriveFiles({
                projectId,
                folderId: state.folderId,
                filter: state.filter,
                search: state.search
            });
            const folder = data.folder;
            pathEl.textContent = folder?.isRoot
                ? rootName
                : `${rootName} / ${folder?.name || ''}`;
            backBtn.hidden = !!folder?.isRoot;

            const files = data.files || [];
            if (!files.length) {
                listEl.innerHTML = '<p class="pd-drive-empty">No hay archivos en esta carpeta.</p>';
                return;
            }

            listEl.innerHTML = files.map((file) => {
                const owner = file.owners?.[0]?.name || '—';
                return `
                <div class="pd-drive-browser-row" data-file-id="${escapeHtml(file.id)}">
                    <button type="button" class="pd-drive-browser-name" data-open-file>
                        ${fileKindIcon(file.kind)}
                        <span>${escapeHtml(file.name)}</span>
                    </button>
                    <span>${escapeHtml(mimeLabel(file))}</span>
                    <span>${file.isFolder ? '—' : escapeHtml(formatBytes(file.size))}</span>
                    <span title="${escapeHtml(formatDriveDate(file.modifiedTime))}">${escapeHtml(formatRelativeTime(file.modifiedTime))}</span>
                    <span>${escapeHtml(owner)}</span>
                    <div class="pd-drive-browser-actions">
                        ${file.isFolder
                            ? `<button type="button" class="pd-drive-mini-btn" data-enter>Abrir</button>`
                            : `
                                ${file.webViewLink ? `<a class="pd-drive-mini-btn" href="${escapeHtml(file.webViewLink)}" target="_blank" rel="noopener">Abrir</a>` : ''}
                                ${file.webContentLink ? `<a class="pd-drive-mini-btn" href="${escapeHtml(file.webContentLink)}" target="_blank" rel="noopener">Descargar</a>` : ''}
                                <button type="button" class="pd-drive-mini-btn" data-copy ${file.webViewLink ? '' : 'disabled'}>Enlace</button>
                                <button type="button" class="pd-drive-mini-btn" data-preview>Vista</button>
                              `}
                    </div>
                </div>`;
            }).join('');

            listEl.querySelectorAll('.pd-drive-browser-row').forEach((row, index) => {
                const file = files[index];
                row.querySelector('[data-enter]')?.addEventListener('click', () => enterFolder(file.id));
                row.querySelector('[data-open-file]')?.addEventListener('dblclick', () => {
                    if (file.isFolder) enterFolder(file.id);
                    else openDrivePreviewModal(file);
                });
                row.querySelector('[data-open-file]')?.addEventListener('click', () => {
                    if (file.isFolder) enterFolder(file.id);
                });
                row.querySelector('[data-preview]')?.addEventListener('click', () => openDrivePreviewModal(file));
                row.querySelector('[data-copy]')?.addEventListener('click', async () => {
                    if (!file.webViewLink) return;
                    try {
                        await navigator.clipboard.writeText(file.webViewLink);
                    } catch (_) {
                        alert('No se pudo copiar el enlace.');
                    }
                });
            });
        } catch (error) {
            listEl.innerHTML = `<p class="pd-drive-empty">${escapeHtml(error.message)}</p>`;
        }
    }

    function enterFolder(folderId) {
        if (state.folderId) state.stack.push(state.folderId);
        else state.stack.push(null);
        state.folderId = folderId;
        load();
    }

    // mode reserved for future client-only action restrictions inside browser
    void mode;
    load();
}
