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
    not_started: 'Pendiente',
    in_progress: 'En desarrollo',
    in_review: 'En revisión',
    paused: 'Pausado',
    completed: 'Finalizado',
    cancelled: 'Cancelado'
};

export const PROJECT_STATUS_BADGE_CLASS = {
    not_started: 'admin-badge--pending',
    in_progress: 'admin-badge--progress',
    in_review: 'admin-badge--paused',
    paused: 'admin-badge--paused',
    completed: 'admin-badge--active',
    cancelled: 'admin-badge--completed'
};

/** Clases de badge específicas de la portada del proyecto. */
export const PROJECT_COVER_STATUS_CLASS = {
    not_started: 'pd-cover-status--pending',
    in_progress: 'pd-cover-status--progress',
    in_review: 'pd-cover-status--review',
    paused: 'pd-cover-status--paused',
    completed: 'pd-cover-status--done',
    cancelled: 'pd-cover-status--cancelled'
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

export const CALENDAR_EVENT_TYPE_LABELS = {
    meeting: 'Reunión',
    call: 'Llamada',
    deadline: 'Fecha límite',
    milestone: 'Hito',
    delivery: 'Entrega',
    other: 'Otro'
};

export const CALENDAR_EVENT_STATUS_LABELS = {
    scheduled: 'Programado',
    completed: 'Completado',
    cancelled: 'Cancelado'
};

export const CALENDAR_EVENT_TYPE_COLORS = {
    meeting: '#2D8CFF',
    call: '#8C52FF',
    deadline: '#FF2D95',
    milestone: '#FFB12D',
    delivery: '#3CD28C',
    other: '#9a9a9a'
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

/**
 * Obtiene el perfil del cliente asociado a un proyecto
 * (workspaces.client_id / profiles anidado).
 */
export function getProjectClientProfile(project) {
    const workspace = project?.workspaces || null;
    if (!workspace) return null;
    const profile = workspace.profiles || null;
    const id = workspace.client_id || profile?.id || null;
    if (!id) return null;
    return {
        id,
        full_name: profile?.full_name || 'Cliente',
        email: profile?.email || null,
        role: 'client'
    };
}

/**
 * Construye las opciones del selector "Responsable":
 * cliente del proyecto + todos los administradores (desde DB).
 */
export function buildResponsibleOptions({ client = null, admins = [] } = {}) {
    const options = [];
    if (client?.id) {
        options.push({
            id: client.id,
            label: client.full_name || 'Cliente',
            kind: 'client'
        });
    }
    (admins || []).forEach((admin) => {
        if (!admin?.id) return;
        if (client?.id && admin.id === client.id) return;
        options.push({
            id: admin.id,
            label: admin.full_name || admin.email || 'Administrador',
            kind: 'admin'
        });
    });
    return options;
}

export function populateResponsibleSelect(select, { client = null, admins = [], emptyLabel = 'Selecciona un responsable', selectedId = '' } = {}) {
    if (!select) return;
    const options = buildResponsibleOptions({ client, admins });
    select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>` +
        options.map((opt) => {
            const suffix = opt.kind === 'client' ? ' (Cliente)' : '';
            return `<option value="${opt.id}">${escapeHtml(opt.label)}${suffix}</option>`;
        }).join('');
    if (selectedId) select.value = selectedId;
}

/**
 * Deriva task_type + assignee_id a partir del responsable elegido.
 * Si el responsable es el cliente del proyecto -> client|approval.
 * Si es un admin -> nexa.
 */
export function resolveTaskAssignment(assigneeId, clientId, { isApproval = false } = {}) {
    if (!assigneeId) {
        return { assignee_id: null, task_type: 'nexa' };
    }
    if (clientId && assigneeId === clientId) {
        return {
            assignee_id: assigneeId,
            task_type: isApproval ? 'approval' : 'client'
        };
    }
    return { assignee_id: assigneeId, task_type: 'nexa' };
}

/**
 * Metadatos visuales del responsable de una tarea (nombre + si es cliente).
 * Escalable: usa assignee_id / profiles, no nombres fijos.
 */
export function getTaskResponsibleMeta(task, project = null) {
    const client = getProjectClientProfile(project);
    const clientId = client?.id || null;
    const assignee = task?.profiles || null;
    const assigneeId = task?.assignee_id || assignee?.id || null;

    const isClientByType = task?.task_type === 'client' || task?.task_type === 'approval';
    const isClientByAssignee = !!(assigneeId && clientId && assigneeId === clientId);
    const isClient = isClientByType || isClientByAssignee || assignee?.role === 'client';
    const isApproval = task?.task_type === 'approval';

    let name = assignee?.full_name || null;
    if (!name && isClient) name = client?.full_name || 'Cliente';
    if (!name) name = 'Sin asignar';

    return {
        name,
        isClient,
        isApproval,
        assigneeId,
        badgeLabel: isApproval ? 'APROBACIÓN' : (isClient ? 'CLIENTE' : 'NEXA'),
        cardClass: isClient ? (isApproval ? 'is-client is-approval' : 'is-client') : 'is-nexa'
    };
}
