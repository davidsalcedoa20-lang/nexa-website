/* ==========================================================
   NEXA HUB — Página: Clientes (admin/clientes.html)
   ==========================================================
   Orquesta el módulo: pide los datos al servicio, se los pasa
   al componente de tabla, y conecta el modal de creación/edición.
   No contiene consultas a Supabase (eso vive en clientService.js)
   ni genera HTML de tarjetas/modal a mano (eso vive en los
   componentes).
   ========================================================== */

import { listClients, createClient, updateClient, deleteClient, resetClientPassword, getActiveProjectsCount } from '../services/clientService.js';
import { renderClientTable } from '../components/clientTable.js';
import { openClientModal } from '../components/clientModal.js';
import { openResetPasswordModal } from '../components/resetPasswordModal.js';
import { openPasswordRevealModal } from '../components/passwordRevealModal.js';

const tbody = document.getElementById('clientsTableBody');
const newClientBtn = document.getElementById('newClientBtn');
const emptyState = document.getElementById('clientsEmptyState');
const loadingState = document.getElementById('clientsLoadingState');
const loadErrorState = document.getElementById('clientsErrorState');
const tableWrapper = document.getElementById('clientsTableWrapper');

function setView(view) {
    if (loadingState) loadingState.style.display = view === 'loading' ? 'flex' : 'none';
    if (emptyState) emptyState.style.display = view === 'empty' ? 'flex' : 'none';
    if (loadErrorState) loadErrorState.style.display = view === 'error' ? 'flex' : 'none';
    if (tableWrapper) tableWrapper.style.display = view === 'table' ? 'block' : 'none';
}

async function loadClients() {
    setView('loading');

    let clients;
    try {
        clients = await listClients();
    } catch (error) {
        console.error('[NEXA HUB] Error cargando clientes:', error.message);
        setView('error');
        return;
    }

    if (!clients.length) {
        setView('empty');
        return;
    }

    const withCounts = await Promise.all(clients.map(async function (client) {
        const activeProjects = await getActiveProjectsCount(client.workspaceId);
        return Object.assign({}, client, { activeProjects: activeProjects });
    }));

    renderClientTable(tbody, withCounts, {
        onView: function (client) {
            openClientModal({ mode: 'view', client: client });
        },
        onEdit: function (client) {
            openClientModal({
                mode: 'edit',
                client: client,
                onSubmit: function (payload) {
                    return handleUpdate(client, payload);
                }
            });
        },
        onResetPassword: function (client) {
            handleResetPassword(client);
        },
        onDelete: function (client) {
            handleDelete(client);
        }
    });

    setView('table');
}

async function handleCreate(payload) {
    const result = await createClient(payload);
    await loadClients();

    if (result && result.temporaryPassword) {
        openPasswordRevealModal({
            message: `Cliente "${payload.company}" creado correctamente. Copia esta contraseña temporal y envíasela a ${payload.email} por tu canal habitual (WhatsApp, correo, etc.). El cliente deberá cambiarla al iniciar sesión por primera vez.`,
            password: result.temporaryPassword
        });
    }
}

function handleResetPassword(client) {
    openResetPasswordModal({
        clientLabel: `Cliente: ${client.contact} (${client.email})`,
        onSubmit: async function (password) {
            const result = await resetClientPassword({ profileId: client.profileId, password: password });
            if (result && result.temporaryPassword) {
                openPasswordRevealModal({
                    message: `Contraseña temporal regenerada para ${client.contact}. Cópiala y envíasela por tu canal habitual. Deberá cambiarla en su próximo inicio de sesión.`,
                    password: result.temporaryPassword
                });
            }
        }
    });
}

async function handleUpdate(client, payload) {
    await updateClient({
        workspaceId: client.workspaceId,
        profileId: client.profileId,
        company: payload.company,
        contact: payload.contact,
        phone: payload.phone,
        city: payload.city,
        notes: payload.notes
    });
    await loadClients();
}

async function handleDelete(client) {
    const confirmed = window.confirm(
        '¿Eliminar el espacio de trabajo de "' + client.company + '"?\n\n' +
        'Esta acción no se puede deshacer. La cuenta del cliente no se elimina, solo su workspace.'
    );

    if (!confirmed) return;

    try {
        await deleteClient(client.workspaceId);
        await loadClients();
    } catch (error) {
        window.alert('No se pudo eliminar el cliente: ' + error.message);
    }
}

if (newClientBtn) {
    newClientBtn.addEventListener('click', function () {
        openClientModal({ mode: 'create', onSubmit: handleCreate });
    });
}

loadClients();
