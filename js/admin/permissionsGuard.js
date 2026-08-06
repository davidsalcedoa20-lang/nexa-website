/* ==========================================================
   NEXA HUB — Guard de permisos (páginas admin)
   ==========================================================
   Uso:
     import { requirePagePermission, applyPermissionUI } from '...';
     await requirePagePermission(['projects.view_all', 'projects.view_assigned']);
     await applyPermissionUI();
   ========================================================== */
import {
    hasAnyPermission, hasPermission, isOwner, getCurrentStaffProfile, loadMyPermissionKeys
} from '../services/permissionService.js';
import { PAGE_PERMISSION_MAP, ROLE_LABELS } from '../components/permissions/permissionCatalog.js';

function pageName() {
    const parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || 'index.html';
}

/**
 * Bloquea la página si el usuario no tiene ninguno de los permisos.
 * Owner siempre pasa. Si deniedRedirect, redirige; si no, muestra pantalla denegada.
 */
export async function requirePagePermission(keys = null, { redirectTo = 'index.html' } = {}) {
    const profile = await getCurrentStaffProfile();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
        renderDenied('No tienes acceso al panel administrativo.');
        return false;
    }

    if (profile.role === 'owner') {
        await applyPermissionUI();
        return true;
    }

    const required = keys || PAGE_PERMISSION_MAP[pageName()] || null;
    if (!required || !required.length) {
        await applyPermissionUI();
        return true;
    }

    const ok = await hasAnyPermission(required);
    if (!ok) {
        if (redirectTo) {
            window.location.replace(redirectTo + '?denied=1');
            return false;
        }
        renderDenied('No tienes permisos para acceder a esta sección.');
        return false;
    }

    await applyPermissionUI();
    return true;
}

function renderDenied(message) {
    const main = document.querySelector('.admin-main') || document.querySelector('main') || document.body;
    main.innerHTML = `
        <div class="perm-denied">
            <h1>Acceso denegado</h1>
            <p>${message}</p>
            <a class="admin-btn-primary" href="index.html">Volver al dashboard</a>
        </div>
    `;
}

/** Actualiza etiqueta de rol y oculta nav items según permisos. */
export async function applyPermissionUI() {
    const profile = await getCurrentStaffProfile();
    const owner = profile?.role === 'owner';
    const keys = await loadMyPermissionKeys();

    document.querySelectorAll('[data-user-role-label]').forEach((el) => {
        el.textContent = ROLE_LABELS[profile?.role] || 'Administrador';
    });

    const navRules = [
        { match: 'clientes.html', any: ['clients.create', 'clients.edit', 'clients.delete'] },
        { match: 'proyectos.html', any: ['projects.view_all', 'projects.view_assigned', 'projects.create'] },
        { match: 'tareas.html', any: ['tasks.create', 'tasks.edit', 'tasks.delete', 'projects.view_all', 'projects.view_assigned'] },
        { match: 'calendario.html', any: ['calendar.view', 'calendar.create'] },
        { match: 'configuracion.html', any: ['settings.access', 'settings.integrations', 'settings.system'] },
        { match: 'usuarios-permisos.html', any: ['users.create', 'users.edit', 'users.delete'] },
        { match: 'empleados.html', any: ['employees.view', 'employees.create', 'employees.edit'] }
    ];

    document.querySelectorAll('.admin-nav-item').forEach((link) => {
        const href = link.getAttribute('href') || '';
        const rule = navRules.find((r) => href.includes(r.match));
        if (!rule) return;
        if (owner) {
            link.hidden = false;
            return;
        }
        const allowed = rule.any.some((k) => keys.includes(k));
        link.hidden = !allowed;
    });

    // Grupo Empleados completo
    document.querySelectorAll('.emp-nav-group').forEach((group) => {
        if (owner) {
            group.hidden = false;
            return;
        }
        const allowed = ['employees.view', 'employees.create', 'employees.edit', 'employees.projects']
            .some((k) => keys.includes(k));
        group.hidden = !allowed;
    });

    document.querySelectorAll('[data-requires-permission]').forEach((el) => {
        const needed = (el.getAttribute('data-requires-permission') || '').split(',').map((s) => s.trim()).filter(Boolean);
        if (!needed.length || owner) {
            el.hidden = false;
            return;
        }
        el.hidden = !needed.some((k) => keys.includes(k));
    });
}

export { hasPermission, hasAnyPermission, isOwner };
