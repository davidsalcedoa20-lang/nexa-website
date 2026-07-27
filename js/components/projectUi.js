/* ==========================================================
   NEXA HUB — Helpers UI compartidos del motor de Proyectos
   ========================================================== */

export const PROGRESS_STATUS_LABELS = {
    pending: 'Pendiente',
    in_progress: 'En proceso',
    waiting_approval: 'Esperando aprobación',
    completed: 'Listo',
    blocked: 'Bloqueado',
    finished: 'Finalizado',
    approved: 'Aprobado',
    cancelled: 'Cancelado'
};

export const PROGRESS_STATUS_BADGE_CLASS = {
    pending: 'admin-badge--pending',
    in_progress: 'admin-badge--progress',
    waiting_approval: 'admin-badge--paused',
    completed: 'admin-badge--active',
    blocked: 'admin-badge--completed',
    finished: 'admin-badge--active',
    approved: 'admin-badge--active',
    cancelled: 'admin-badge--pending'
};

/** Mismas claves que PROGRESS_STATUS_LABELS, pero con las clases
 *  "pd-badge--*" usadas en la vista "Plantilla Oficial" del proyecto. */
export const PD_STATUS_BADGE_CLASS = {
    pending: 'pd-badge--pending',
    in_progress: 'pd-badge--in_progress',
    waiting_approval: 'pd-badge--waiting_approval',
    completed: 'pd-badge--completed',
    blocked: 'pd-badge--blocked',
    finished: 'pd-badge--finished',
    approved: 'pd-badge--approved',
    cancelled: 'pd-badge--cancelled'
};

export function pdBadgeHtml(status) {
    const label = PROGRESS_STATUS_LABELS[status] || status;
    const cls = PD_STATUS_BADGE_CLASS[status] || 'pd-badge--pending';
    return `<span class="pd-badge ${cls}">${label}</span>`;
}

export const PROJECT_STATUS_LABELS = {
    not_started: 'Sin iniciar',
    in_progress: 'En curso',
    paused: 'Pausado',
    completed: 'Completado',
    cancelled: 'Cancelado'
};

export const PROJECT_STATUS_BADGE_CLASS = {
    not_started: 'admin-badge--pending',
    in_progress: 'admin-badge--progress',
    paused: 'admin-badge--paused',
    completed: 'admin-badge--active',
    cancelled: 'admin-badge--completed'
};

export const TASK_TYPE_LABELS = {
    client: 'Cliente',
    nexa: 'NEXA',
    approval: 'Aprobación'
};

export const TASK_PRIORITY_LABELS = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente'
};

export const APPROVAL_DECISION_LABELS = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    changes_requested: 'Cambios solicitados'
};

export const DELIVERABLE_STATUS_LABELS = {
    draft: 'Borrador',
    delivered: 'Enviado',
    approved: 'Aprobado',
    rejected: 'Rechazado'
};

export const TIMELINE_EVENT_ICONS = {
    project_created: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    task_completed: '<path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    phase_finished: '<path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    approval_approved: '<path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    approval_changes_requested: '<path d="M12 9v4m0 4h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>',
    deliverable_delivered: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    deliverable_approved: '<path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'
};

export function statusBadgeHtml(status, labels, classes) {
    const label = labels[status] || status;
    const cls = classes[status] || 'admin-badge--pending';
    return `<span class="admin-badge ${cls}">${label}</span>`;
}

export function formatDate(isoDate) {
    if (!isoDate) return '—';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(isoDate) {
    if (!isoDate) return '—';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatFileSize(bytes) {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function getInitials(fullName) {
    if (!fullName) return '--';
    return fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join('') || '--';
}

export function daysRemaining(endDate) {
    if (!endDate) return null;
    const end = new Date(endDate);
    const today = new Date();
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.round((end - today) / 86400000);
}

export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
