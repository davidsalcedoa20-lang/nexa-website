/* ==========================================================
   NEXA HUB — Usuarios y Permisos (crear / editar admins)
   ========================================================== */
import { listProjects } from '../../services/projectService.js';
import {
    listStaffUsers,
    getUserPermissionKeys,
    getUserProjectAccess,
    hasPermission,
    isOwner as amIOwner
} from '../../services/permissionService.js';
import { PERMISSION_MODULES, ROLE_LABELS, ALL_PERMISSION_KEYS } from '../../components/permissions/permissionCatalog.js';
import { requirePagePermission } from '../permissionsGuard.js';
import { getInitials, escapeHtml } from '../../components/projectUi.js';
import { generateTemporaryPassword } from '../../utils/passwordGenerator.js';
import {
    createAdmin,
    updateAdmin,
    resetAdminPassword,
    setAdminActive,
    deleteAdmin,
    uploadAdminAvatar
} from '../services/adminUserService.js';
import { openPasswordRevealModal } from '../components/passwordRevealModal.js';

const listEl = document.getElementById('permUsersList');
const editorEl = document.getElementById('permEditor');
const listViewEl = document.getElementById('permListView');
const loadingEl = document.getElementById('permLoading');
const newAdminBtn = document.getElementById('newAdminBtn');

let projects = [];
let canCreate = false;
let canEdit = false;
let canDelete = false;
let pendingAvatarFile = null;

async function init() {
    // Acceso a la sección: crear, editar o eliminar admins (owner siempre pasa).
    const ok = await requirePagePermission(['users.create', 'users.edit', 'users.delete'], { redirectTo: 'index.html' });
    if (!ok) return;

    canCreate = (await amIOwner()) || (await hasPermission('users.create'));
    canEdit = (await amIOwner()) || (await hasPermission('users.edit'));
    canDelete = (await amIOwner()) || (await hasPermission('users.delete'));

    if (newAdminBtn) {
        newAdminBtn.hidden = !canCreate;
        newAdminBtn.addEventListener('click', () => openAdminModal('create'));
    }

    try {
        projects = await listProjects({ includeArchived: false });
    } catch (_) {
        projects = [];
    }

    await renderList();
    loadingEl.style.display = 'none';
    listViewEl.style.display = 'block';
}

function renderPermissionSwitches(selectedKeys = [], { disabled = false, name = 'perm' } = {}) {
    const set = new Set(selectedKeys);
    return PERMISSION_MODULES.map((mod) => `
        <section class="perm-module">
            <h3>${escapeHtml(mod.label)}</h3>
            <div class="perm-switch-list">
                ${mod.permissions.map((perm) => `
                    <label class="perm-switch${disabled ? ' is-locked' : ''}">
                        <input type="checkbox" name="${name}" value="${escapeHtml(perm.key)}"
                            ${set.has(perm.key) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                        <span class="perm-switch-ui"></span>
                        <span class="perm-switch-label">${escapeHtml(perm.label)}</span>
                    </label>
                `).join('')}
            </div>
        </section>
    `).join('');
}

function renderProjectAccess(mode = 'all', selectedIds = [], { disabled = false } = {}) {
    const selected = new Set(selectedIds);
    return `
        <section class="perm-module">
            <h3>Acceso a proyectos</h3>
            <div class="perm-access-modes">
                <label class="perm-radio${disabled ? ' is-locked' : ''}">
                    <input type="radio" name="projectAccessMode" value="all"
                        ${mode !== 'selected' ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                    <span>Todos los proyectos</span>
                </label>
                <label class="perm-radio${disabled ? ' is-locked' : ''}">
                    <input type="radio" name="projectAccessMode" value="selected"
                        ${mode === 'selected' ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                    <span>Solo proyectos seleccionados</span>
                </label>
            </div>
            <div class="perm-project-checks" data-project-checks ${mode === 'selected' && !disabled ? '' : 'hidden'}>
                ${(projects || []).map((p) => `
                    <label class="perm-check">
                        <input type="checkbox" name="projectId" value="${escapeHtml(p.id)}"
                            ${selected.has(p.id) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                        <span>${escapeHtml(p.name)}</span>
                    </label>
                `).join('') || '<p class="perm-empty">No hay proyectos todavía.</p>'}
            </div>
        </section>
    `;
}

function wireAccessModeSync(root) {
    const checksWrap = root.querySelector('[data-project-checks]');
    root.querySelectorAll('input[name="projectAccessMode"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            const selected = root.querySelector('input[name="projectAccessMode"]:checked')?.value;
            if (checksWrap) checksWrap.hidden = selected !== 'selected';
            const viewAll = root.querySelector('input[value="projects.view_all"]');
            const viewAssigned = root.querySelector('input[value="projects.view_assigned"]');
            if (selected === 'all') {
                if (viewAll) viewAll.checked = true;
                if (viewAssigned) viewAssigned.checked = false;
            } else {
                if (viewAll) viewAll.checked = false;
                if (viewAssigned) viewAssigned.checked = true;
            }
        });
    });
    root.querySelector('input[value="projects.view_all"]')?.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        const assigned = root.querySelector('input[value="projects.view_assigned"]');
        if (assigned) assigned.checked = false;
        const allRadio = root.querySelector('input[name="projectAccessMode"][value="all"]');
        if (allRadio) allRadio.checked = true;
        if (checksWrap) checksWrap.hidden = true;
    });
    root.querySelector('input[value="projects.view_assigned"]')?.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        const all = root.querySelector('input[value="projects.view_all"]');
        if (all) all.checked = false;
        const selRadio = root.querySelector('input[name="projectAccessMode"][value="selected"]');
        if (selRadio) selRadio.checked = true;
        if (checksWrap) checksWrap.hidden = false;
    });
}

function collectAccessPayload(root) {
    const permissionKeys = [...root.querySelectorAll('input[name="perm"]:checked')].map((el) => el.value);
    const projectAccessMode = root.querySelector('input[name="projectAccessMode"]:checked')?.value || 'all';
    const projectIds = [...root.querySelectorAll('input[name="projectId"]:checked')].map((el) => el.value);
    return { permissionKeys, projectAccessMode, projectIds };
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
        const inactive = user.is_active === false;
        return `
            <article class="perm-card${isOwnerUser ? ' perm-card--owner' : ''}${inactive ? ' is-inactive' : ''}">
                <div class="perm-card-avatar">${avatar}</div>
                <div class="perm-card-body">
                    <strong class="perm-card-name">${escapeHtml(user.full_name || 'Sin nombre')}</strong>
                    <span class="perm-card-email">${escapeHtml(user.email || '—')}</span>
                    <div class="perm-card-meta">
                        <span class="perm-role-badge${isOwnerUser ? ' is-owner' : ''}">${escapeHtml(role)}</span>
                        ${inactive ? '<span class="perm-role-badge is-inactive">Inactivo</span>' : ''}
                        <span class="perm-count">${user.permission_count} permiso${user.permission_count === 1 ? '' : 's'}</span>
                    </div>
                </div>
                <button type="button" class="admin-btn-secondary" data-edit-user="${user.id}">
                    ${isOwnerUser ? 'Ver' : (canEdit ? 'Editar' : 'Ver')}
                </button>
            </article>
        `;
    }).join('');

    listEl.querySelectorAll('[data-edit-user]').forEach((btn) => {
        btn.addEventListener('click', () => openEditor(btn.getAttribute('data-edit-user')));
    });
}

function openAdminModal(mode, user = null) {
    pendingAvatarFile = null;
    const overlay = document.getElementById('adminUserModalOverlay');
    const titleEl = document.getElementById('adminUserModalTitle');
    const bodyEl = document.getElementById('adminUserModalBody');
    if (!overlay || !bodyEl) return;

    const isCreate = mode === 'create';
    titleEl.textContent = isCreate ? 'Nuevo administrador' : 'Editar administrador';

    const keys = isCreate ? [] : (user?.permissionKeys || []);
    const accessMode = isCreate ? 'all' : (user?.accessMode || 'all');
    const projectIds = isCreate ? [] : (user?.projectIds || []);
    const isOwnerUser = user?.role === 'owner';

    bodyEl.innerHTML = `
        <form id="adminUserForm" class="admin-form perm-admin-form" novalidate>
            <section class="perm-module">
                <h3>Información</h3>
                <div class="perm-avatar-row">
                    <div class="perm-avatar-preview" id="adminAvatarPreview">
                        ${user?.avatar_url
                            ? `<img src="${escapeHtml(user.avatar_url)}" alt="">`
                            : `<span>${escapeHtml(getInitials(user?.full_name || 'NA'))}</span>`}
                    </div>
                    <div>
                        <input type="file" id="adminAvatarInput" accept="image/jpeg,image/png,image/webp,image/gif" hidden ${isOwnerUser ? 'disabled' : ''}>
                        <button type="button" class="admin-btn-secondary" id="adminAvatarPickBtn" ${isOwnerUser ? 'disabled' : ''}>Subir foto</button>
                        <span class="admin-field-hint">Opcional · JPG/PNG/WEBP/GIF · máx. 2 MB</span>
                    </div>
                </div>
                <div class="admin-field">
                    <label for="adminFullName">Nombre completo</label>
                    <input type="text" id="adminFullName" required value="${escapeHtml(user?.full_name || '')}" ${isOwnerUser ? 'disabled' : ''}>
                </div>
                <div class="admin-field">
                    <label for="adminEmail">Correo electrónico</label>
                    <input type="email" id="adminEmail" required value="${escapeHtml(user?.email || '')}" ${isOwnerUser ? 'disabled' : ''}>
                </div>
                ${isCreate ? `
                    <div class="admin-field">
                        <label for="adminPassword">Contraseña temporal</label>
                        <div class="perm-password-row">
                            <input type="text" id="adminPassword" required value="${escapeHtml(generateTemporaryPassword())}">
                            <button type="button" class="admin-btn-secondary" id="adminPasswordRegen">Generar</button>
                        </div>
                        <span class="admin-field-hint">El administrador deberá cambiarla en el primer acceso si el flujo lo requiere.</span>
                    </div>
                ` : ''}
                <div class="admin-field">
                    <label for="adminJobTitle">Cargo</label>
                    <input type="text" id="adminJobTitle" placeholder="Ej. Desarrollo Web" value="${escapeHtml(user?.job_title || '')}" ${isOwnerUser ? 'disabled' : ''}>
                </div>
            </section>

            <section class="perm-module">
                <h3>Rol</h3>
                <div class="perm-role-readonly">
                    <span class="perm-role-badge">Administrador</span>
                    <span class="admin-field-hint">Fijo · no editable</span>
                </div>
            </section>

            ${renderPermissionSwitches(keys, { disabled: isOwnerUser })}
            ${renderProjectAccess(accessMode, projectIds, { disabled: isOwnerUser })}

            <span class="admin-form-error" id="adminUserFormError"></span>
            <div class="admin-modal-actions">
                <button type="button" class="admin-btn-secondary" data-close-admin-modal>Cancelar</button>
                ${isOwnerUser ? '' : `<button type="submit" class="admin-btn-primary">${isCreate ? 'Crear administrador' : 'Guardar cambios'}</button>`}
            </div>
        </form>
    `;

    overlay.classList.add('active');
    wireAccessModeSync(bodyEl);

    bodyEl.querySelector('#adminAvatarPickBtn')?.addEventListener('click', () => {
        bodyEl.querySelector('#adminAvatarInput')?.click();
    });
    bodyEl.querySelector('#adminAvatarInput')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0] || null;
        pendingAvatarFile = file;
        const preview = bodyEl.querySelector('#adminAvatarPreview');
        if (file && preview) {
            const url = URL.createObjectURL(file);
            preview.innerHTML = `<img src="${url}" alt="">`;
        }
    });
    bodyEl.querySelector('#adminPasswordRegen')?.addEventListener('click', () => {
        const input = bodyEl.querySelector('#adminPassword');
        if (input) input.value = generateTemporaryPassword();
    });
    bodyEl.querySelectorAll('[data-close-admin-modal]').forEach((btn) => {
        btn.addEventListener('click', closeAdminModal);
    });

    bodyEl.querySelector('#adminUserForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isOwnerUser) return;
        const errorEl = bodyEl.querySelector('#adminUserFormError');
        errorEl.textContent = '';
        errorEl.classList.remove('active');

        const full_name = bodyEl.querySelector('#adminFullName')?.value.trim() || '';
        const email = bodyEl.querySelector('#adminEmail')?.value.trim().toLowerCase() || '';
        const job_title = bodyEl.querySelector('#adminJobTitle')?.value.trim() || '';
        const password = bodyEl.querySelector('#adminPassword')?.value.trim() || '';
        const access = collectAccessPayload(bodyEl);

        if (!full_name || !email) {
            errorEl.textContent = 'Nombre y correo son obligatorios.';
            errorEl.classList.add('active');
            return;
        }

        const submitBtn = bodyEl.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            if (isCreate) {
                if (!canCreate) throw new Error('No tienes permiso para crear administradores.');
                if (!password || password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

                let avatar_url = null;
                // Primero crear usuario; luego avatar si hay archivo.
                const result = await createAdmin({
                    full_name,
                    email,
                    password,
                    job_title: job_title || null,
                    avatar_url: null,
                    permission_keys: access.permissionKeys,
                    project_access_mode: access.projectAccessMode,
                    project_ids: access.projectIds
                });

                if (pendingAvatarFile && result.userId) {
                    try {
                        avatar_url = await uploadAdminAvatar(result.userId, pendingAvatarFile);
                        await updateAdmin({ user_id: result.userId, avatar_url });
                    } catch (avatarError) {
                        console.warn('Avatar no subido:', avatarError.message);
                    }
                }

                closeAdminModal();
                openPasswordRevealModal({
                    message: `Administrador creado (${email}). Comparte esta contraseña temporal de forma segura.`,
                    password: result.temporaryPassword || password
                });
                await renderList();
            } else {
                if (!canEdit) throw new Error('No tienes permiso para editar administradores.');
                let avatar_url = user.avatar_url || null;
                if (pendingAvatarFile) {
                    avatar_url = await uploadAdminAvatar(user.id, pendingAvatarFile);
                }
                await updateAdmin({
                    user_id: user.id,
                    full_name,
                    email,
                    job_title: job_title || null,
                    avatar_url,
                    permission_keys: access.permissionKeys,
                    project_access_mode: access.projectAccessMode,
                    project_ids: access.projectIds,
                    is_active: user.is_active !== false
                });
                closeAdminModal();
                await renderList();
                if (editorEl.style.display !== 'none') await openEditor(user.id);
            }
        } catch (error) {
            errorEl.textContent = error.message || 'No se pudo guardar.';
            errorEl.classList.add('active');
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

function closeAdminModal() {
    pendingAvatarFile = null;
    document.getElementById('adminUserModalOverlay')?.classList.remove('active');
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

    editorEl.innerHTML = `
        <div class="perm-editor-header">
            <button type="button" class="admin-btn-secondary" id="permBackBtn">← Volver</button>
            <div class="perm-editor-heading">
                <div class="perm-card-avatar">
                    ${user.avatar_url
                        ? `<img src="${escapeHtml(user.avatar_url)}" alt="" class="perm-card-avatar-img">`
                        : `<span class="perm-card-avatar-fallback">${escapeHtml(getInitials(user.full_name || user.email))}</span>`}
                </div>
                <div>
                    <h2>
                        ${escapeHtml(user.full_name || 'Usuario')}
                        ${isOwnerUser
                            ? '<span class="perm-role-badge is-owner">👑 Propietario</span>'
                            : '<span class="perm-role-badge">Administrador</span>'}
                    </h2>
                    <p>${escapeHtml(user.email || '')}
                        ${user.is_active === false ? ' · <strong>Inactivo</strong>' : ''}</p>
                </div>
            </div>
        </div>
        ${isOwnerUser ? `
            <div class="perm-owner-banner">
                Este usuario es el <strong>Propietario</strong>. Tiene acceso absoluto. No se puede eliminar, desactivar ni cambiar su rol.
            </div>
        ` : ''}
        <div class="perm-editor-toolbar">
            ${!isOwnerUser && canEdit ? `<button type="button" class="admin-btn-secondary" id="permOpenEditModal">Editar información y permisos</button>` : ''}
            ${!isOwnerUser && canEdit ? `<button type="button" class="admin-btn-secondary" id="permResetPassword">Restablecer contraseña</button>` : ''}
            ${!isOwnerUser && canEdit ? `<button type="button" class="admin-btn-secondary" id="permToggleActive">${user.is_active === false ? 'Reactivar cuenta' : 'Desactivar cuenta'}</button>` : ''}
            ${!isOwnerUser && canDelete ? `<button type="button" class="admin-btn-secondary perm-danger-btn" id="permDeleteUser">Eliminar cuenta</button>` : ''}
        </div>
        <div class="perm-readonly-block">
            ${renderPermissionSwitches(keys, { disabled: true })}
            ${renderProjectAccess(access.mode, access.projectIds, { disabled: true })}
        </div>
    `;

    editorEl.querySelector('#permBackBtn')?.addEventListener('click', backToList);

    editorEl.querySelector('#permOpenEditModal')?.addEventListener('click', () => {
        openAdminModal('edit', {
            ...user,
            permissionKeys: keys,
            accessMode: access.mode,
            projectIds: access.projectIds
        });
    });

    editorEl.querySelector('#permResetPassword')?.addEventListener('click', async () => {
        const password = generateTemporaryPassword();
        if (!window.confirm('¿Generar una nueva contraseña temporal para este administrador?')) return;
        try {
            const result = await resetAdminPassword(userId, password);
            openPasswordRevealModal({
                message: `Contraseña restablecida para ${user.email}.`,
                password: result.temporaryPassword || password
            });
        } catch (error) {
            alert(error.message);
        }
    });

    editorEl.querySelector('#permToggleActive')?.addEventListener('click', async () => {
        const next = user.is_active === false;
        const label = next ? 'reactivar' : 'desactivar';
        if (!window.confirm(`¿Seguro que quieres ${label} esta cuenta?`)) return;
        try {
            await setAdminActive(userId, next);
            await openEditor(userId);
            await renderList();
        } catch (error) {
            alert(error.message);
        }
    });

    editorEl.querySelector('#permDeleteUser')?.addEventListener('click', async () => {
        if (!window.confirm(`¿Eliminar permanentemente a ${user.full_name || user.email}? Esta acción no se puede deshacer.`)) return;
        try {
            await deleteAdmin(userId);
            await backToList();
        } catch (error) {
            alert(error.message);
        }
    });
}

async function backToList() {
    editorEl.style.display = 'none';
    listViewEl.style.display = 'block';
    await renderList();
}

document.getElementById('adminUserModalOverlay')?.addEventListener('click', (e) => {
    if (e.target?.id === 'adminUserModalOverlay') closeAdminModal();
});
document.getElementById('adminUserModalClose')?.addEventListener('click', closeAdminModal);

init().catch((error) => {
    console.error(error);
    if (loadingEl) loadingEl.innerHTML = `<span>Error: ${escapeHtml(error.message)}</span>`;
});
