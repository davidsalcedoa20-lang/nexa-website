/* ==========================================================
   NEXA HUB — Guard de permisos (páginas admin)
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
 * Owner siempre pasa. `__owner_only__` exige Administrador Principal.
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

    if (required.includes('__owner_only__')) {
        if (redirectTo) {
            window.location.replace(redirectTo + '?denied=1');
            return false;
        }
        renderDenied('Solo el Administrador Principal puede acceder a esta sección.');
        return false;
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
        {
            match: 'usuarios-permisos.html',
            test: () => owner
        },
        {
            match: 'empleados.html',
            test: () => owner || keys.includes('employees.manage')
        },
        {
            match: 'proyectos.html',
            test: () => owner || keys.some((k) => k.startsWith('projects.'))
        }
    ];

    document.querySelectorAll('.admin-nav-item').forEach((link) => {
        const href = link.getAttribute('href') || '';
        const rule = navRules.find((r) => href.includes(r.match));
        if (!rule) {
            link.hidden = false;
            return;
        }
        link.hidden = !rule.test();
    });

    // Grupo Empleados en sidebar
    document.querySelectorAll('.emp-nav-group').forEach((group) => {
        group.hidden = !(owner || keys.includes('employees.manage'));
    });

    document.querySelectorAll('[data-requires-permission]').forEach((el) => {
        const needed = (el.getAttribute('data-requires-permission') || '').split(',').map((s) => s.trim()).filter(Boolean);
        if (!needed.length || owner) {
            el.hidden = false;
            return;
        }
        if (needed.includes('__owner_only__')) {
            el.hidden = true;
            return;
        }
        el.hidden = !needed.some((k) => keys.includes(k));
    });
}

export { hasPermission, hasAnyPermission, isOwner };
