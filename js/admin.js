/* ==========================================================
   NEXA HUB — Panel Administrativo (interfaz)
   ==========================================================
   Este archivo SOLO controla interacciones de interfaz del
   Panel Administrativo (/admin):
     1. Sidebar en vista móvil.
     2. Menú desplegable del usuario (avatar).
     3. Datos simulados de la tabla "Clientes recientes" y de
        "Actividad reciente".

   La autenticación, la sesión y el guard de rol (admin) viven
   en js/portal.js (módulo compartido) y ya se ejecutan antes
   de que este archivo corra. Aquí NO se toca Supabase todavía.

   Cuando se conecte Supabase de verdad, solo hay que reemplazar
   las funciones getMockClients() / getMockActivity() por
   consultas reales — el resto del render ya queda preparado.
   ========================================================== */

/* ================= 1. SIDEBAR MÓVIL ================= */
const adminSidebar = document.getElementById('adminSidebar');
const adminMenuToggle = document.getElementById('adminMenuToggle');
const adminOverlay = document.getElementById('adminOverlay');

if (adminSidebar && adminMenuToggle && adminOverlay) {
    const closeAdminSidebar = function () {
        adminSidebar.classList.remove('active');
        adminOverlay.classList.remove('active');
    };

    adminMenuToggle.addEventListener('click', function () {
        adminSidebar.classList.toggle('active');
        adminOverlay.classList.toggle('active');
    });

    adminOverlay.addEventListener('click', closeAdminSidebar);
}

/* ================= 2. MENÚ DE USUARIO ================= */
const adminUserToggle = document.getElementById('adminUserToggle');
const adminUserMenu = document.getElementById('adminUserMenu');

if (adminUserToggle && adminUserMenu) {
    adminUserToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        adminUserToggle.classList.toggle('is-open');
    });

    document.addEventListener('click', function (e) {
        if (!adminUserToggle.contains(e.target)) {
            adminUserToggle.classList.remove('is-open');
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            adminUserToggle.classList.remove('is-open');
        }
    });
}

/* ================= 3. DATOS SIMULADOS ================= */
/* TODO (fase Supabase): reemplazar por
   supabase.from('workspaces').select('...').order('created_at', ...) */
function getMockClients() {
    return [
        {
            company: 'Distribuidora Andina',
            contact: 'Laura Gómez',
            project: 'Sitio Web Corporativo',
            status: 'in_progress',
            startDate: '12 May 2026'
        },
        {
            company: 'Café Sierra Nevada',
            contact: 'Julián Restrepo',
            project: 'Producción Audiovisual',
            status: 'completed',
            startDate: '02 Mar 2026'
        },
        {
            company: 'Grupo Vértice Inmobiliaria',
            contact: 'Camila Torres',
            project: 'Tomas Aéreas + Video Promocional',
            status: 'paused',
            startDate: '18 Abr 2026'
        },
        {
            company: 'Constructora Meridiano',
            contact: 'David Herrera',
            project: 'App de Seguimiento de Obra',
            status: 'in_progress',
            startDate: '30 Jun 2026'
        },
        {
            company: 'Nova Salud IPS',
            contact: 'Marcela Ríos',
            project: 'Rediseño de Plataforma Web',
            status: 'pending',
            startDate: '10 Jul 2026'
        }
    ];
}

/* TODO (fase Supabase): reemplazar por
   supabase.from('tasks' / 'projects').select('...').order('created_at', ...) */
function getMockActivity() {
    return [
        { text: 'Se creó el proyecto "App de Seguimiento de Obra" para Constructora Meridiano.', time: 'Hace 2 horas' },
        { text: 'Café Sierra Nevada completó la etapa "Producción y Edición".', time: 'Hace 5 horas' },
        { text: 'Se agregó una nueva tarea en "Sitio Web Corporativo" — Distribuidora Andina.', time: 'Ayer' },
        { text: 'Nova Salud IPS fue registrada como nuevo cliente.', time: 'Hace 2 días' },
        { text: 'Grupo Vértice Inmobiliaria pausó temporalmente su proyecto.', time: 'Hace 3 días' }
    ];
}

const STATUS_LABELS = {
    in_progress: { label: 'En progreso', className: 'admin-badge--progress' },
    completed: { label: 'Completado', className: 'admin-badge--completed' },
    paused: { label: 'Pausado', className: 'admin-badge--paused' },
    pending: { label: 'Pendiente', className: 'admin-badge--pending' }
};

const ICON_EYE = '<svg viewBox="0 0 24 24" fill="none"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>';
const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

function renderClientsTable() {
    const tbody = document.getElementById('adminClientsTableBody');
    if (!tbody) return;

    const clients = getMockClients();

    tbody.innerHTML = clients.map(function (client) {
        const status = STATUS_LABELS[client.status] || STATUS_LABELS.pending;

        return (
            '<tr>' +
                '<td><div class="admin-table-company"><strong>' + client.company + '</strong></div></td>' +
                '<td>' + client.contact + '</td>' +
                '<td>' + client.project + '</td>' +
                '<td><span class="admin-badge ' + status.className + '">' + status.label + '</span></td>' +
                '<td>' + client.startDate + '</td>' +
                '<td>' +
                    '<div class="admin-table-actions">' +
                        '<button type="button" class="admin-action-btn" title="Disponible próximamente">' + ICON_EYE + '</button>' +
                        '<button type="button" class="admin-action-btn" title="Disponible próximamente">' + ICON_EDIT + '</button>' +
                    '</div>' +
                '</td>' +
            '</tr>'
        );
    }).join('');
}

function renderActivityList() {
    const list = document.getElementById('adminActivityList');
    if (!list) return;

    const activity = getMockActivity();

    list.innerHTML = activity.map(function (item) {
        return (
            '<li class="admin-activity-item">' +
                '<span class="admin-activity-dot">' +
                    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 8v5l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/></svg>' +
                '</span>' +
                '<span>' +
                    '<span class="admin-activity-text">' + item.text + '</span>' +
                    '<span class="admin-activity-time">' + item.time + '</span>' +
                '</span>' +
            '</li>'
        );
    }).join('');
}

renderClientsTable();
renderActivityList();
