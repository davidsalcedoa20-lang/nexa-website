/* ==========================================================
   NEXA HUB — Usuarios y Permisos
   ========================================================== */
import { listProjects } from '../../services/projectService.js';
import {
    listStaffUsers,
    getUserPermissionKeys,
    getUserProjectAccess,
    saveUserAccess,
    isOwner as amIOwner
} from '../../services/permissionService.js';
import { PERMISSION_MODULES, ROLE_LABELS, ALL_PERMISSION_KEYS } from '../../components/permissions/permissionCatalog.js';
import { requirePagePermission } from '../permissionsGuard.js';
import { getInitials, escapeHtml } from '../../components/projectUi.js';

const listEl = document.getElementById('permUsersList');
const editorEl = document.getElementById('permEditor');
const listViewEl = document.getElementById('permListView');
const loadingEl = document.getElementById('permLoading');

let projects = [];
let canManage = false;

async function init() {
    const ok = await requirePagePermission(['users.edit', 'users.create', 'users.delete'], { redirectTo: 'index.html' });
    if (!ok) return;

    canManage = await amIOwner() || true; // users.edit already required for page
    try {
        projects = await listProjects({ includeArchived: false });
    } catch (_) {
        projects = [];
    }

    await renderList();
    loadingEl.style.display = 'none';
    listViewEl.style.display = 'block';
}

async function renderList() {
    const users = await listStaffUsers();
    if (!users.length) {
        listEl.innerHTML = '<p class="perm-empty">No hay administradores registrados.</p>';
        return;
    }

    listEl.innerHTML = users.map((user) => {
        const role = ROLE_LABELS[user.role] || user.role;
        const initials = getInitials(user.full_name || user.email);
        const avatar = user.avatar_url
            ? `<img src="${escapeHtml(user.avatar_url)}" alt="" class="perm-card-avatar-img">`
            : `<span class="perm-card-avatar-fallback">${escapeHtml(initials)}</span>`;
        const isOwnerUser = user.role === 'owner';
        return `
            <article class="perm-card${isOwnerUser ? ' perm-card--owner' : ''}">
                <div class="perm-card-avatar">${avatar}</div>
                <div class="perm-card-body">
                    <strong class="perm-card-name">${escapeHtml(user.full_name || 'Sin nombre')}</strong>
                    <span class="perm-card-email">${escapeHtml(user.email || '—')}</span>
                    <div class="perm-card-meta">
                        <span class="perm-role-badge${isOwnerUser ? ' is-owner' : ''}">${escapeHtml(role)}</span>
                        <span class="perm-count">${user.permission_count} permiso${user.permission_count === 1 ? '' : 's'}</span>
                    </div>
                </div>
                <button type="button" class="admin-btn-secondary" data-edit-user="${user.id}">
                    ${isOwnerUser ? 'Ver' : 'Editar'}
                </button>
            </article>
        `;
    }).join('');

    listEl.querySelectorAll('[data-edit-user]').forEach((btn) => {
        btn.addEventListener('click', () => openEditor(btn.getAttribute('data-edit-user')));
    });
}

async function openEditor(userId) {
    listViewEl.style.display = 'none';
    editorEl.style.display = 'block';
    editorEl.innerHTML = '<div class="admin-loading-inline">Cargando permisos…</div>';

    const users = await listStaffUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
        editorEl.innerHTML = '<p class="perm-empty">Usuario no encontrado.</p>';
        return;
    }

    const isOwnerUser = user.role === 'owner';
    const keys = isOwnerUser ? [...ALL_PERMISSION_KEYS] : await getUserPermissionKeys(userId);
    const access = isOwnerUser
        ? { mode: 'all', projectIds: [] }
        : await getUserProjectAccess(userId);

    const keySet = new Set(keys);
    const selectedProjects = new Set(access.projectIds || []);

    editorEl.innerHTML = `
        <div class="perm-editor-header">
            <button type="button" class="admin-btn-secondary" id="permBackBtn">← Volver</button>
            <div>
                <h2>${escapeHtml(user.full_name || 'Usuario')}</h2>
                <p>${escapeHtml(user.email || '')} · ${escapeHtml(ROLE_LABELS[user.role] || user.role)}</p>
            </div>
        </div>
        ${isOwnerUser ? `
            <div class="perm-owner-banner">
                Este usuario es el <strong>Propietario</strong> del sistema. Tiene acceso absoluto y sus permisos no se pueden modificar.
            </div>
        ` : ''}
        <form id="permEditorForm" class="perm-editor-form">
            ${PERMISSION_MODULES.map((mod) => `
                <section class="perm-module">
                    <h3>${escapeHtml(mod.label)}</h3>
                    <div class="perm-switch-list">
                        ${mod.permissions.map((perm) => `
                            <label class="perm-switch${isOwnerUser ? ' is-locked' : ''}">
                                <input type="checkbox" name="perm" value="${escapeHtml(perm.key)}"
                                    ${keySet.has(perm.key) ? 'checked' : ''}
                                    ${isOwnerUser ? 'disabled' : ''}>
                                <span class="perm-switch-ui"></span>
                                <span class="perm-switch-label">${escapeHtml(perm.label)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `).join('')}

            <section class="perm-module">
                <h3>Acceso a proyectos</h3>
                <div class="perm-access-modes">
                    <label class="perm-radio${isOwnerUser ? ' is-locked' : ''}">
                        <input type="radio" name="projectAccessMode" value="all"
                            ${access.mode !== 'selected' ? 'checked' : ''}
                            ${isOwnerUser ? 'disabled' : ''}>
                        <span>Todos los proyectos</span>
                    </label>
                    <label class="perm-radio${isOwnerUser ? ' is-locked' : ''}">
                        <input type="radio" name="projectAccessMode" value="selected"
                            ${access.mode === 'selected' ? 'checked' : ''}
                            ${isOwnerUser ? 'disabled' : ''}>
                        <span>Solo proyectos seleccionados</span>
                    </label>
                </div>
                <div class="perm-project-checks" id="permProjectChecks" ${access.mode === 'selected' && !isOwnerUser ? '' : 'hidden'}>
                    ${(projects || []).map((p) => `
                        <label class="perm-check">
                            <input type="checkbox" name="projectId" value="${escapeHtml(p.id)}"
                                ${selectedProjects.has(p.id) ? 'checked' : ''}
                                ${isOwnerUser ? 'disabled' : ''}>
                            <span>${escapeHtml(p.name)}</span>
                        </label>
                    `).join('') || '<p class="perm-empty">No hay proyectos todavía.</p>'}
                </div>
            </section>

            ${isOwnerUser ? '' : `
                <div class="perm-editor-actions">
                    <span class="admin-form-error" id="permEditorError"></span>
                    <button type="button" class="admin-btn-secondary" id="permCancelBtn">Cancelar</button>
                    <button type="submit" class="admin-btn-primary">Guardar cambios</button>
                </div>
            `}
        </form>
    `;

    editorEl.querySelector('#permBackBtn')?.addEventListener('click', backToList);
    editorEl.querySelector('#permCancelBtn')?.addEventListener('click', backToList);

    const form = editorEl.querySelector('#permEditorForm');
    const checksWrap = editorEl.querySelector('#permProjectChecks');

    form?.querySelectorAll('input[name="projectAccessMode"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            const selected = form.querySelector('input[name="projectAccessMode"]:checked')?.value;
            if (checksWrap) checksWrap.hidden = selected !== 'selected';

            // Sync view_all / view_assigned switches
            const viewAll = form.querySelector('input[value="projects.view_all"]');
            const viewAssigned = form.querySelector('input[value="projects.view_assigned"]');
            if (selected === 'all') {
                if (viewAll) viewAll.checked = true;
                if (viewAssigned) viewAssigned.checked = false;
            } else {
                if (viewAll) viewAll.checked = false;
                if (viewAssigned) viewAssigned.checked = true;
            }
        });
    });

    form?.querySelector('input[value="projects.view_all"]')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            const assigned = form.querySelector('input[value="projects.view_assigned"]');
            if (assigned) assigned.checked = false;
            const allRadio = form.querySelector('input[name="projectAccessMode"][value="all"]');
            if (allRadio) allRadio.checked = true;
            if (checksWrap) checksWrap.hidden = true;
        }
    });

    form?.querySelector('input[value="projects.view_assigned"]')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            const all = form.querySelector('input[value="projects.view_all"]');
            if (all) all.checked = false;
            const selRadio = form.querySelector('input[name="projectAccessMode"][value="selected"]');
            if (selRadio) selRadio.checked = true;
            if (checksWrap) checksWrap.hidden = false;
        }
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isOwnerUser) return;
        const errorEl = document.getElementById('permEditorError');
        errorEl.textContent = '';
        errorEl.classList.remove('active');

        const permissionKeys = [...form.querySelectorAll('input[name="perm"]:checked')].map((el) => el.value);
        const projectAccessMode = form.querySelector('input[name="projectAccessMode"]:checked')?.value || 'all';
        const projectIds = [...form.querySelectorAll('input[name="projectId"]:checked')].map((el) => el.value);

        try {
            await saveUserAccess({ userId, permissionKeys, projectAccessMode, projectIds });
            await backToList();
        } catch (error) {
            errorEl.textContent = error.message || 'No se pudieron guardar los permisos.';
            errorEl.classList.add('active');
        }
    });
}

async function backToList() {
    editorEl.style.display = 'none';
    listViewEl.style.display = 'block';
    await renderList();
}

init().catch((error) => {
    console.error(error);
    if (loadingEl) {
        loadingEl.innerHTML = `<span>Error: ${escapeHtml(error.message)}</span>`;
    }
});
