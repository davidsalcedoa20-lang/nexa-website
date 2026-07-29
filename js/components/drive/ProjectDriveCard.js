/* ==========================================================
   ProjectDriveCard — tarjeta "Documentos del proyecto"
   ========================================================== */
import {
    getDriveConnectionStatus,
    unlinkProjectDriveFolder,
    refreshProjectDriveStats,
    disconnectGoogleAccount
} from '../../services/driveApiService.js';
import { renderDriveConnectionButton } from './DriveConnectionButton.js';
import { openDriveFolderSelector } from './DriveFolderSelector.js';
import { openDriveFileBrowser } from './DriveFileBrowser.js';
import {
    escapeHtml, formatRelativeTime, DRIVE_ICON_SVG, fileKindIcon
} from './driveUi.js';

/**
 * @param {HTMLElement} container
 * @param {{
 *   project: object,
 *   mode?: 'admin' | 'client',
 *   onProjectChange?: (project: object) => void
 * }} options
 */
export async function mountProjectDriveCard(container, {
    project,
    mode = 'admin',
    onProjectChange
} = {}) {
    if (!container || !project) return;

    const isAdmin = mode === 'admin';
    let current = project;
    let accountStatus = { connected: false, configured: true, googleEmail: null };

    if (isAdmin) {
        try {
            accountStatus = await getDriveConnectionStatus();
        } catch (_) {
            accountStatus = { connected: false, configured: false, googleEmail: null };
        }
    }

    render();

    function render() {
        const connected = !!(current.drive_connected && current.drive_folder_id);
        container.innerHTML = '';
        container.className = 'pd-drive-card';

        const header = document.createElement('div');
        header.className = 'pd-drive-card-header';
        header.innerHTML = `
            <div class="pd-drive-card-title">
                ${DRIVE_ICON_SVG}
                <div>
                    <h3>Documentos del proyecto</h3>
                    <p class="pd-drive-card-subtitle">${connected ? 'Google Drive' : 'Integración con Google Drive'}</p>
                </div>
            </div>
            <span class="pd-drive-status-badge ${connected ? 'is-connected' : 'is-disconnected'}">
                <span class="pd-drive-status-dot"></span>
                ${connected ? 'Conectado' : 'Sin conectar'}
            </span>
        `;
        container.appendChild(header);

        if (!connected) {
            const empty = document.createElement('div');
            empty.className = 'pd-drive-empty-state';
            empty.innerHTML = `<p>Esta carpeta aún no está vinculada.</p>`;
            if (isAdmin) {
                const actions = document.createElement('div');
                actions.className = 'pd-drive-card-actions';
                if (!accountStatus.configured) {
                    actions.innerHTML = `<p class="pd-drive-hint">Configura GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI en los secrets de Supabase para activar OAuth.</p>`;
                } else if (!accountStatus.connected) {
                    actions.appendChild(renderDriveConnectionButton({
                        label: 'Conectar Google Drive',
                        projectId: current.id,
                        returnUrl: window.location.href.split('#')[0]
                    }));
                } else {
                    const pickBtn = document.createElement('button');
                    pickBtn.type = 'button';
                    pickBtn.className = 'admin-btn-primary';
                    pickBtn.textContent = 'Seleccionar carpeta';
                    pickBtn.addEventListener('click', () => {
                        openDriveFolderSelector({
                            projectId: current.id,
                            onLinked: (updated) => {
                                current = { ...current, ...updated };
                                onProjectChange?.(current);
                                render();
                            }
                        });
                    });
                    actions.appendChild(pickBtn);
                    if (accountStatus.googleEmail) {
                        const note = document.createElement('p');
                        note.className = 'pd-drive-hint';
                        note.textContent = `Cuenta: ${accountStatus.googleEmail}`;
                        actions.appendChild(note);
                    }
                }
                empty.appendChild(actions);
            } else {
                empty.innerHTML += `<p class="pd-drive-hint">Cuando NEXA vincule la carpeta, podrás ver los archivos aquí.</p>`;
            }
            container.appendChild(empty);
            return;
        }

        const meta = document.createElement('div');
        meta.className = 'pd-drive-card-meta';
        const files = current.drive_files_count ?? '—';
        const folders = current.drive_folders_count ?? '—';
        const synced = formatRelativeTime(current.drive_last_synced_at || current.drive_connected_at);
        meta.innerHTML = `
            <div class="pd-drive-meta-main">
                <strong class="pd-drive-folder-name">${escapeHtml(current.drive_folder_name || 'Carpeta vinculada')}</strong>
                <p class="pd-drive-folder-path">Carpeta vinculada: ${escapeHtml(current.drive_folder_name || '—')}
                    · ${escapeHtml(String(files))} archivo${files === 1 ? '' : 's'}
                    · ${escapeHtml(String(folders))} carpeta${folders === 1 ? '' : 's'}
                    · Última actualización: ${escapeHtml(synced)}</p>
            </div>
        `;
        container.appendChild(meta);

        // Preview chips (carpetas) — se cargan en lazy si admin/client puede listar
        const chips = document.createElement('div');
        chips.className = 'pd-drive-folder-chips';
        chips.innerHTML = `<div class="pd-drive-skeleton pd-drive-skeleton--chips">${Array.from({ length: 4 }, () => '<div class="pd-drive-skel-chip"></div>').join('')}</div>`;
        container.appendChild(chips);
        loadFolderChips(chips);

        const actions = document.createElement('div');
        actions.className = 'pd-drive-card-actions';

        if (current.drive_folder_url) {
            const openLink = document.createElement('a');
            openLink.className = 'admin-btn-secondary';
            openLink.href = current.drive_folder_url;
            openLink.target = '_blank';
            openLink.rel = 'noopener';
            openLink.innerHTML = `<span>Abrir en Google Drive</span>`;
            actions.appendChild(openLink);
        }

        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'admin-btn-primary';
        viewBtn.textContent = 'Ver archivos';
        viewBtn.addEventListener('click', () => {
            openDriveFileBrowser({
                projectId: current.id,
                rootName: current.drive_folder_name || 'Documentos',
                mode
            });
        });
        actions.appendChild(viewBtn);

        if (isAdmin) {
            const changeBtn = document.createElement('button');
            changeBtn.type = 'button';
            changeBtn.className = 'admin-btn-secondary';
            changeBtn.textContent = 'Cambiar carpeta';
            changeBtn.addEventListener('click', async () => {
                if (!accountStatus.connected) {
                    const connectBtn = renderDriveConnectionButton({
                        projectId: current.id,
                        returnUrl: window.location.href.split('#')[0]
                    });
                    connectBtn.click();
                    return;
                }
                openDriveFolderSelector({
                    projectId: current.id,
                    onLinked: (updated) => {
                        current = { ...current, ...updated };
                        onProjectChange?.(current);
                        render();
                    }
                });
            });
            actions.appendChild(changeBtn);

            const moreWrap = document.createElement('div');
            moreWrap.className = 'pd-drive-more-wrap';
            moreWrap.innerHTML = `
                <button type="button" class="admin-icon-btn" data-drive-more title="Más opciones">
                    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="6" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="18" r="1.6" fill="currentColor"/></svg>
                </button>
                <div class="pd-drive-more-menu" hidden>
                    <button type="button" data-drive-refresh>Actualizar conteo</button>
                    <button type="button" data-drive-unlink class="danger">Desconectar carpeta</button>
                    <button type="button" data-drive-disconnect-account class="danger">Desconectar cuenta Google</button>
                </div>
            `;
            actions.appendChild(moreWrap);

            const menu = moreWrap.querySelector('.pd-drive-more-menu');
            moreWrap.querySelector('[data-drive-more]').addEventListener('click', (e) => {
                e.stopPropagation();
                menu.hidden = !menu.hidden;
            });
            document.addEventListener('click', () => { menu.hidden = true; }, { once: true });

            moreWrap.querySelector('[data-drive-refresh]').addEventListener('click', async () => {
                try {
                    const result = await refreshProjectDriveStats(current.id);
                    current = { ...current, ...result.project };
                    onProjectChange?.(current);
                    render();
                } catch (error) {
                    alert(error.message);
                }
            });
            moreWrap.querySelector('[data-drive-unlink]').addEventListener('click', async () => {
                if (!window.confirm('¿Desconectar la carpeta de este proyecto? Los archivos no se eliminan de Google Drive.')) return;
                try {
                    const result = await unlinkProjectDriveFolder(current.id);
                    current = { ...current, ...result.project };
                    onProjectChange?.(current);
                    render();
                } catch (error) {
                    alert(error.message);
                }
            });
            moreWrap.querySelector('[data-drive-disconnect-account]').addEventListener('click', async () => {
                if (!window.confirm('¿Desconectar tu cuenta de Google? Los proyectos ya vinculados seguirán con su carpeta hasta que la desvincules.')) return;
                try {
                    await disconnectGoogleAccount();
                    accountStatus = { ...accountStatus, connected: false, googleEmail: null };
                    alert('Cuenta Google desconectada.');
                } catch (error) {
                    alert(error.message);
                }
            });
        }

        container.appendChild(actions);
    }

    async function loadFolderChips(chipsEl) {
        try {
            const { listProjectDriveFiles } = await import('../../services/driveApiService.js');
            const data = await listProjectDriveFiles({
                projectId: current.id,
                folderId: current.drive_folder_id,
                filter: 'folders',
                pageSize: 8
            });
            const folders = (data.files || []).filter((f) => f.isFolder).slice(0, 8);
            if (!folders.length) {
                chipsEl.innerHTML = `<p class="pd-drive-hint">No hay subcarpetas en la raíz vinculada.</p>`;
                return;
            }
            chipsEl.innerHTML = folders.map((folder) => `
                <button type="button" class="pd-drive-chip" data-chip-folder="${escapeHtml(folder.id)}">
                    ${fileKindIcon('folder')}
                    <span>
                        <strong>${escapeHtml(folder.name)}</strong>
                        <small>Carpeta</small>
                    </span>
                </button>
            `).join('');
            chipsEl.querySelectorAll('[data-chip-folder]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    openDriveFileBrowser({
                        projectId: current.id,
                        rootName: current.drive_folder_name || 'Documentos',
                        mode
                    });
                });
            });
        } catch (_) {
            chipsEl.innerHTML = '';
        }
    }

    // Auto-refresh stats in background (best effort)
    if (current.drive_connected && current.drive_folder_id) {
        refreshProjectDriveStats(current.id)
            .then((result) => {
                current = { ...current, ...result.project };
                onProjectChange?.(current);
                const metaPath = container.querySelector('.pd-drive-folder-path');
                if (metaPath) {
                    const files = current.drive_files_count ?? '—';
                    const folders = current.drive_folders_count ?? '—';
                    const synced = formatRelativeTime(current.drive_last_synced_at || current.drive_connected_at);
                    metaPath.textContent = `Carpeta vinculada: ${current.drive_folder_name || '—'} · ${files} archivo${files === 1 ? '' : 's'} · ${folders} carpeta${folders === 1 ? '' : 's'} · Última actualización: ${synced}`;
                }
            })
            .catch(() => {});
    }
}
