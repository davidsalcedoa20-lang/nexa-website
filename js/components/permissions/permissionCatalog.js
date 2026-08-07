/* ==========================================================
   NEXA HUB — Catálogo de permisos simplificado
   ==========================================================
   Cuatro bloques:
     Proyectos · Contabilidad (compartir en Finanzas) ·
     Administradores (solo owner) · Empleados
   ========================================================== */

export const PROJECT_ACCESS_OPTIONS = [
    {
        id: 'all',
        key: 'projects.view_all',
        label: 'Puede ver todos los proyectos',
        hint: 'Acceso completo a la lista de proyectos.'
    },
    {
        id: 'selected',
        key: 'projects.view_assigned',
        label: 'Puede ver únicamente los proyectos asignados por el Administrador Principal',
        hint: 'El Administrador Principal elige qué proyectos ve. Siempre verá los que él cree.'
    },
    {
        id: 'own',
        key: 'projects.view_own',
        label: 'Puede ver automáticamente todos los proyectos creados por él mismo',
        hint: 'Solo sus propios proyectos (más los que cree a partir de ahora).'
    }
];

export const PERMISSION_MODULES = [
    {
        id: 'projects',
        label: 'Proyectos',
        permissions: PROJECT_ACCESS_OPTIONS.map((o) => ({ key: o.key, label: o.label }))
    },
    {
        id: 'employees',
        label: 'Empleados',
        permissions: [
            { key: 'employees.manage', label: 'Puede administrar empleados' }
        ]
    }
];

export const ALL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.key));

export const ROLE_LABELS = {
    owner: 'CEO',
    admin: 'Administrador',
    client: 'Cliente',
    employee: 'Empleado'
};

/** Mapeo nav/página → permiso mínimo. Vacío = cualquier admin. */
export const PAGE_PERMISSION_MAP = {
    'usuarios-permisos.html': ['__owner_only__'],
    'proyectos.html': ['projects.view_all', 'projects.view_assigned', 'projects.view_own'],
    'proyecto-detalle.html': ['projects.view_all', 'projects.view_assigned', 'projects.view_own']
};

/** Normaliza modo de acceso a proyectos desde keys + mode guardado. */
export function resolveProjectAccessMode(keys = [], storedMode = 'all') {
    if (keys.includes('projects.view_all') || storedMode === 'all') return 'all';
    if (keys.includes('projects.view_assigned') || storedMode === 'selected') return 'selected';
    if (keys.includes('projects.view_own') || storedMode === 'own') return 'own';
    return storedMode === 'selected' ? 'selected' : (storedMode === 'own' ? 'own' : 'all');
}

export function projectKeyForMode(mode) {
    if (mode === 'selected') return 'projects.view_assigned';
    if (mode === 'own') return 'projects.view_own';
    return 'projects.view_all';
}
