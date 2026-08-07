/* ==========================================================
   NEXA HUB — Página: Clientes (admin/clientes.html)
   ==========================================================
   Orquesta Portal + Express. El flujo Portal no cambia.
   ========================================================== */

import { listClients, createClient, updateClient, deleteClient, resetClientPassword, getActiveProjectsCount } from '../services/clientService.js';
import {
    listExpressClients,
    createExpressClient,
    updateExpressClient,
    deleteExpressClient,
    countExpressProjects
} from '../services/expressClientService.js';
import { renderClientTable } from '../components/clientTable.js';
import { openClientModal } from '../components/clientModal.js';
import { openClientTypeChooser } from '../components/clientTypeChooser.js';
import { openExpressClientModal } from '../components/expressClientModal.js';
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

    let portalClients = [];
    let expressClients = [];
    try {
        [portalClients, expressClients] = await Promise.all([
            listClients(),
            listExpressClients().catch((err) => {
                // Si la migración aún no está aplicada, no romper Portal
                console.warn('[Clientes] Express no disponible:', err.message);
                return [];
            })
        ]);
    } catch (error) {
        console.error('[NEXA HUB] Error cargando clientes:', error.message);
        setView('error');
        return;
    }

    const portalMapped = portalClients.map((c) => Object.assign({}, c, { kind: 'portal' }));
    const all = portalMapped.concat(expressClients);

    if (!all.length) {
        setView('empty');
        return;
    }

    const withCounts = await Promise.all(all.map(async function (client) {
        if (client.kind === 'express') {
            const activeProjects = await countExpressProjects(client.id);
            return Object.assign({}, client, { activeProjects });
        }
        const activeProjects = await getActiveProjectsCount(client.workspaceId);
        return Object.assign({}, client, { activeProjects });
    }));

    withCounts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    renderClientTable(tbody, withCounts, {
        onView: function (client) {
            if (client.kind === 'express') {
                window.location.href = 'express-cliente.html?id=' + encodeURIComponent(client.id);
                return;
            }
            openClientModal({ mode: 'view', client: client });
        },
        onEdit: function (client) {
            if (client.kind === 'express') {
                openExpressClientModal({
                    mode: 'edit',
                    client,
                    onSubmit: async (payload) => {
                        await updateExpressClient(client.id, payload);
                        await loadClients();
                    }
                });
                return;
            }
            openClientModal({
                mode: 'edit',
                client: client,
                onSubmit: function (payload) {
                    return handleUpdate(client, payload);
                }
            });
        },
        onResetPassword: function (client) {
            if (client.kind === 'express') return;
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
        email: payload.email,
        phone: payload.phone,
        city: payload.city,
        notes: payload.notes
    });
    await loadClients();
}

async function handleDelete(client) {
    if (client.kind === 'express') {
        const confirmed = window.confirm(
            '¿Eliminar el Cliente Express "' + client.contact + '"?\n\n' +
            'También se ocultarán sus proyectos Express. Esta acción no se puede deshacer fácilmente.'
        );
        if (!confirmed) return;
        try {
            await deleteExpressClient(client.id);
            await loadClients();
        } catch (error) {
            window.alert('No se pudo eliminar el cliente: ' + error.message);
        }
        return;
    }

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
        openClientTypeChooser({
            onPortal: function () {
                openClientModal({ mode: 'create', onSubmit: handleCreate });
            },
            onExpress: function () {
                openExpressClientModal({
                    mode: 'create',
                    onSubmit: async (payload) => {
                        const created = await createExpressClient(payload);
                        await loadClients();
                        if (created?.id && window.confirm('Cliente Express creado. ¿Quieres agregar un proyecto ahora?')) {
                            window.location.href = 'express-cliente.html?id=' + encodeURIComponent(created.id);
                        }
                    }
                });
            }
        });
    });
}

loadClients();
