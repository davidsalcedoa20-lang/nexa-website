/* ==========================================================
   NEXA HUB — Utilidades UI Google Drive
   ========================================================== */

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function formatBytes(bytes) {
    if (bytes == null || Number.isNaN(Number(bytes))) return '—';
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatRelativeTime(iso) {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    const diffMs = Date.now() - date.getTime();
    const sec = Math.round(diffMs / 1000);
    if (sec < 60) return 'hace unos segundos';
    const min = Math.round(sec / 60);
    if (min < 60) return `hace ${min} min`;
    const hours = Math.round(min / 60);
    if (hours < 24) return `hace ${hours} hora${hours === 1 ? '' : 's'}`;
    const days = Math.round(hours / 24);
    if (days < 30) return `hace ${days} día${days === 1 ? '' : 's'}`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDriveDate(iso) {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export const DRIVE_ICON_SVG = `
<svg class="pd-drive-gicon" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#4285F4" d="M12.01 2.5 3.5 17.25h4.6L16.6 2.5z"/>
  <path fill="#34A853" d="m8.1 17.25 2.3 4 8.5-14.75h-4.6z"/>
  <path fill="#FBBC05" d="M3.5 17.25 5.8 21.25h12.4l-2.3-4z"/>
</svg>`;

export function fileKindIcon(kind) {
    if (kind === 'folder') {
        return `<span class="pd-drive-file-ico pd-drive-file-ico--folder" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4.2l1.6 2H18.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </span>`;
    }
    if (kind === 'image') {
        return `<span class="pd-drive-file-ico pd-drive-file-ico--image" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2.5" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><path d="m7.5 16 3.2-3.2a1 1 0 0 1 1.4 0L15 15.5l1.2-1.2a1 1 0 0 1 1.4 0L19 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </span>`;
    }
    if (kind === 'video') {
        return `<span class="pd-drive-file-ico pd-drive-file-ico--video" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="6" width="13" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="m16.5 10.5 4-2.5v8l-4-2.5v-3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </span>`;
    }
    if (kind === 'pdf') {
        return `<span class="pd-drive-file-ico pd-drive-file-ico--pdf" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" stroke="currentColor" stroke-width="1.6"/><path d="M14 3.5V8h4.5M8.5 13h3M8.5 16.5h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </span>`;
    }
    return `<span class="pd-drive-file-ico pd-drive-file-ico--doc" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" stroke="currentColor" stroke-width="1.6"/><path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
    </span>`;
}

export function mimeLabel(file) {
    if (file.isFolder || file.kind === 'folder') return 'Carpeta';
    if (file.kind === 'image') return 'Imagen';
    if (file.kind === 'video') return 'Video';
    if (file.kind === 'pdf') return 'PDF';
    if (file.kind === 'document') return 'Documento';
    return file.mimeType?.split('/').pop() || 'Archivo';
}
