/* ==========================================================
   NEXA HUB — Componente: tabla de Clientes
   ==========================================================
   Componente de interfaz puro: solo recibe datos ya cargados y
   renderiza filas. No importa clientService ni Supabase — eso
   es responsabilidad de js/admin/pages/clientsPage.js.
   ========================================================== */

const STATUS_LABELS = {
    active: { label: 'Activo', className: 'admin-badge--active' },
    inactive: { label: 'Inactivo', className: 'admin-badge--pending' }
};

const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m2 0-.8 12.1a2 2 0 0 1-2 1.9H8.8a2 2 0 0 1-2-1.9L6 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function formatDate(isoString) {
    if (!isoString) return '—';

    try {
        return new Date(isoString).toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return '—';
    }
}

/**
 * Renderiza la tabla de clientes dentro de un <tbody>.
 *
 * @param {HTMLElement} tbody
 * @param {Array<object>} clients
 * @param {{onView:Function, onEdit:Function, onDelete:Function}} handlers
 */
export function renderClientTable(tbody, clients, handlers) {
    if (!tbody) return;

    if (!clients.length) {
        tbody.innerHTML = '';
        return;
    }

    tbody.innerHTML = clients.map(function (client, index) {
        const status = STATUS_LABELS[client.status] || STATUS_LABELS.active;

        return (
            '<tr data-row-index="' + index + '">' +
                '<td><div class="admin-table-company"><strong>' + client.company + '</strong>' +
                    (client.city ? '<span>' + client.city + '</span>' : '') +
                '</div></td>' +
                '<td>' + client.contact + '</td>' +
                '<td>' + client.email + '</td>' +
                '<td><span class="admin-badge ' + status.className + '">' + status.label + '</span></td>' +
                '<td>' + client.activeProjects + '</td>' +
                '<td>' + formatDate(client.createdAt) + '</td>' +
                '<td>' +
                    '<div class="admin-table-actions">' +
                        '<button type="button" class="admin-action-btn" data-action="view" data-row-index="' + index + '" title="Ver cliente">' + ICON_EYE + '</button>' +
                        '<button type="button" class="admin-action-btn" data-action="edit" data-row-index="' + index + '" title="Editar cliente">' + ICON_EDIT + '</button>' +
                        '<button type="button" class="admin-action-btn admin-action-btn--danger" data-action="delete" data-row-index="' + index + '" title="Eliminar cliente">' + ICON_TRASH + '</button>' +
                    '</div>' +
                '</td>' +
            '</tr>'
        );
    }).join('');

    tbody.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const rowIndex = Number(btn.getAttribute('data-row-index'));
            const client = clients[rowIndex];
            const action = btn.getAttribute('data-action');

            if (action === 'view' && handlers.onView) handlers.onView(client);
            if (action === 'edit' && handlers.onEdit) handlers.onEdit(client);
            if (action === 'delete' && handlers.onDelete) handlers.onDelete(client);
        });
    });
}
