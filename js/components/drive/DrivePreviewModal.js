/* ==========================================================
   DrivePreviewModal — vista previa / acciones de un archivo
   ========================================================== */
import { escapeHtml, formatBytes, formatDriveDate, mimeLabel, fileKindIcon, DRIVE_ICON_SVG } from './driveUi.js';

export function openDrivePreviewModal(file) {
    const existing = document.getElementById('drivePreviewModalOverlay');
    if (existing) existing.remove();

    const canPreview = !!(file.webViewLink && (
        file.kind === 'image' ||
        file.kind === 'pdf' ||
        file.kind === 'document' ||
        file.mimeType?.includes('google-apps')
    ));

    const owner = file.owners?.[0]?.name || '—';
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay active pd-drive-modal-overlay';
    overlay.id = 'drivePreviewModalOverlay';
    overlay.innerHTML = `
        <div class="admin-modal pd-drive-modal pd-drive-preview-modal" role="dialog" aria-modal="true">
            <div class="admin-modal-header">
                <div class="pd-drive-modal-title">
                    ${DRIVE_ICON_SVG}
                    <div>
                        <h3>${escapeHtml(file.name)}</h3>
                        <p class="pd-drive-modal-sub">${escapeHtml(mimeLabel(file))} · ${escapeHtml(formatBytes(file.size))}</p>
                    </div>
                </div>
                <button type="button" class="admin-modal-close" data-drive-close>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
            </div>
            <div class="pd-drive-preview-body">
                <div class="pd-drive-preview-hero">
                    ${file.thumbnailLink
                        ? `<img src="${escapeHtml(file.thumbnailLink)}" alt="" class="pd-drive-preview-thumb" referrerpolicy="no-referrer">`
                        : fileKindIcon(file.kind)}
                </div>
                <dl class="pd-drive-preview-meta">
                    <div><dt>Tipo</dt><dd>${escapeHtml(mimeLabel(file))}</dd></div>
                    <div><dt>Peso</dt><dd>${escapeHtml(formatBytes(file.size))}</dd></div>
                    <div><dt>Última modificación</dt><dd>${escapeHtml(formatDriveDate(file.modifiedTime))}</dd></div>
                    <div><dt>Responsable</dt><dd>${escapeHtml(owner)}</dd></div>
                </dl>
                ${canPreview
                    ? `<p class="pd-drive-preview-note">Google permite abrir una vista previa en una pestaña segura.</p>`
                    : `<p class="pd-drive-preview-note">Este tipo de archivo no ofrece vista previa embebida. Ábrelo en Drive.</p>`}
            </div>
            <div class="admin-modal-actions pd-drive-preview-actions">
                ${file.webViewLink ? `<a class="admin-btn-primary" href="${escapeHtml(file.webViewLink)}" target="_blank" rel="noopener">Abrir</a>` : ''}
                ${file.webContentLink ? `<a class="admin-btn-secondary" href="${escapeHtml(file.webContentLink)}" target="_blank" rel="noopener">Descargar</a>` : ''}
                <button type="button" class="admin-btn-secondary" data-copy-link ${file.webViewLink ? '' : 'disabled'}>Copiar enlace</button>
                <button type="button" class="admin-btn-secondary" data-drive-close>Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelectorAll('[data-drive-close]').forEach((btn) => btn.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('[data-copy-link]')?.addEventListener('click', async () => {
        if (!file.webViewLink) return;
        try {
            await navigator.clipboard.writeText(file.webViewLink);
            const btn = overlay.querySelector('[data-copy-link]');
            btn.textContent = 'Enlace copiado';
            setTimeout(() => { btn.textContent = 'Copiar enlace'; }, 1600);
        } catch (_) {
            alert('No se pudo copiar el enlace.');
        }
    });
}
