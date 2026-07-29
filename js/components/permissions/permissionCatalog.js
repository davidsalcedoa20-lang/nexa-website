/* ==========================================================
   NEXA HUB — Catálogo de permisos (frontend)
   ==========================================================
   Debe mantenerse alineado con public.permissions (migración).
   Agregar un permiso nuevo:
     1) INSERT en la tabla permissions (migración)
     2) Añadir la clave aquí en PERMISSION_MODULES
   ========================================================== */

export const PERMISSION_MODULES = [
    {
        id: 'projects',
        label: 'Proyectos',
        permissions: [
            { key: 'projects.view_all', label: 'Ver todos los proyectos' },
            { key: 'projects.view_assigned', label: 'Ver únicamente proyectos asignados' },
            { key: 'projects.create', label: 'Crear proyectos' },
            { key: 'projects.edit', label: 'Editar proyectos' },
            { key: 'projects.delete', label: 'Eliminar proyectos' }
        ]
    },
    {
        id: 'clients',
        label: 'Clientes',
        permissions: [
            { key: 'clients.create', label: 'Crear clientes' },
            { key: 'clients.edit', label: 'Editar clientes' },
            { key: 'clients.delete', label: 'Eliminar clientes' }
        ]
    },
    {
        id: 'tasks',
        label: 'Tareas',
        permissions: [
            { key: 'tasks.create', label: 'Crear tareas' },
            { key: 'tasks.edit', label: 'Editar tareas' },
            { key: 'tasks.delete', label: 'Eliminar tareas' }
        ]
    },
    {
        id: 'calendar',
        label: 'Calendario',
        permissions: [
            { key: 'calendar.view', label: 'Ver calendario' },
            { key: 'calendar.create', label: 'Crear eventos' },
            { key: 'calendar.edit', label: 'Editar eventos' },
            { key: 'calendar.delete', label: 'Eliminar eventos' }
        ]
    },
    {
        id: 'documents',
        label: 'Documentos',
        permissions: [
            { key: 'documents.view', label: 'Ver documentos' },
            { key: 'documents.upload', label: 'Subir archivos' },
            { key: 'documents.delete', label: 'Eliminar archivos' },
            { key: 'documents.manage_drive', label: 'Administrar Google Drive' }
        ]
    },
    {
        id: 'google',
        label: 'Google',
        permissions: [
            { key: 'google.connect_drive', label: 'Conectar Google Drive' },
            { key: 'google.connect_calendar', label: 'Conectar Google Calendar' }
        ]
    },
    {
        id: 'users',
        label: 'Usuarios',
        permissions: [
            { key: 'users.create', label: 'Crear administradores' },
            { key: 'users.edit', label: 'Editar administradores' },
            { key: 'users.delete', label: 'Eliminar administradores' }
        ]
    },
    {
        id: 'settings',
        label: 'Configuración',
        permissions: [
            { key: 'settings.access', label: 'Acceder a configuración' },
            { key: 'settings.integrations', label: 'Administrar integraciones' },
            { key: 'settings.system', label: 'Administrar sistema' }
        ]
    },
    {
        id: 'reports',
        label: 'Reportes',
        permissions: [
            { key: 'reports.view', label: 'Ver reportes' }
        ]
    }
];

export const ALL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.key));

export const ROLE_LABELS = {
    owner: '👑 Propietario',
    admin: 'Administrador',
    client: 'Cliente'
};

/** Mapeo nav/página → permiso mínimo para ver la sección. */
export const PAGE_PERMISSION_MAP = {
    'clientes.html': ['clients.create', 'clients.edit', 'clients.delete'],
    'proyectos.html': ['projects.view_all', 'projects.view_assigned', 'projects.create', 'projects.edit'],
    'proyecto-detalle.html': ['projects.view_all', 'projects.view_assigned', 'projects.edit'],
    'tareas.html': ['tasks.create', 'tasks.edit', 'tasks.delete', 'projects.view_all', 'projects.view_assigned'],
    'calendario.html': ['calendar.view', 'calendar.create', 'calendar.edit'],
    'configuracion.html': ['settings.access', 'settings.integrations', 'settings.system'],
    'usuarios-permisos.html': ['users.create', 'users.edit', 'users.delete']
};
