/* ==========================================================
   NEXA HUB — Usuarios y Permisos (modelo simplificado)
   Solo el CEO gestiona esta sección.
   ========================================================== */
import { listProjects } from '../../services/projectService.js';
import {
    listStaffUsers,
    getUserPermissionKeys,
    getUserProjectAccess,
    isOwner as amIOwner,
    buildSimplePermissionKeys
} from '../../services/permissionService.js';
import {
    ROLE_LABELS,
    PROJECT_ACCESS_OPTIONS,
    resolveProjectAccessMode
} from '../../components/permissions/permissionCatalog.js';
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
let pendingAvatarFile = null;

async function init() {
    const ok = await requirePagePermission(['__owner_only__'], { redirectTo: 'index.html' });
    if (!ok) return;

    // Owner siempre; si aún no hay owner, un admin puede gestionar (fallback del guard).
    const owner = await amIOwner();
    if (!owner) {
        // Permitir continuar solo si el guard ya dejó pasar (sin owner en sistema).
        console.info('[usuarios-permisos] Entrando como admin (fallback sin owner asignado).');
    }

    if (newAdminBtn) {
        newAdminBtn.hidden = false;
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

function renderSimplePermissionCards({
    projectMode = 'all',
    projectIds = [],
    employeesManage = false,
    disabled = false,
    namePrefix = 'perm'
} = {}) {
    const radios = PROJECT_ACCESS_OPTIONS.map((opt) => `
        <label class="perm-simple-option${disabled ? ' is-locked' : ''}">
            <input type="radio" name="${namePrefix}ProjectMode" value="${opt.id}"
                ${projectMode === opt.id ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
            <span class="perm-simple-radio"></span>
            <span class="perm-simple-option-text">
                <strong>${escapeHtml(opt.label)}</strong>
                <small>${escapeHtml(opt.hint)}</small>
            </span>
        </label>
    `).join('');

    return `
        <div class="perm-blocks">
            <article class="perm-block-card">
                <header class="perm-block-head">
                    <span class="perm-block-icon" aria-hidden="true">📁</span>
                    <div>
                        <h3>Proyectos</h3>
                        <p>Define qué proyectos puede ver este administrador.</p>
                    </div>
                </header>
                <div class="perm-simple-options" data-project-mode-root>
                    ${radios}
                </div>
                <div class="perm-project-assign" data-project-checks ${projectMode === 'selected' && !disabled ? '' : 'hidden'}>
                    <h4>Asignar proyectos</h4>
                    <div class="perm-project-checks">
                        ${(projects || []).map((p) => `
                            <label class="perm-check">
                                <input type="checkbox" name="${namePrefix}ProjectId" value="${escapeHtml(p.id)}"
                                    ${projectIds.includes(p.id) ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                                <span>${escapeHtml(p.name)}</span>
                            </label>
                        `).join('') || '<p class="perm-empty">No hay proyectos todavía.</p>'}
                    </div>
                </div>
            </article>

            <article class="perm-block-card">
                <header class="perm-block-head">
                    <span class="perm-block-icon" aria-hidden="true">💰</span>
                    <div>
                        <h3>Contabilidad</h3>
                        <p>Cada administrador tiene su propia contabilidad.</p>
                    </div>
                </header>
                <ul class="perm-block-notes">
                    <li>Solo él y el CEO la ven por defecto.</li>
                    <li>Puede compartirla con otros desde <strong>Finanzas → Compartir con</strong>.</li>
                    <li>El CEO siempre ve todas las contabilidades.</li>
                </ul>
            </article>

            <article class="perm-block-card">
                <header class="perm-block-head">
                    <span class="perm-block-icon" aria-hidden="true">🛡️</span>
                    <div>
                        <h3>Administradores</h3>
                        <p>Gestión de cuentas del equipo NEXA.</p>
                    </div>
                </header>
                <ul class="perm-block-notes">
                    <li>Solo el CEO puede crear, editar o eliminar administradores.</li>
                    <li>Ningún otro administrador puede modificar permisos ni roles.</li>
                    <li>El CEO nunca pierde sus privilegios.</li>
                </ul>
            </article>

            <article class="perm-block-card">
                <header class="perm-block-head">
                    <span class="perm-block-icon" aria-hidden="true">👥</span>
                    <div>
                        <h3>Empleados</h3>
                        <p>Módulo de editores y trabajos asignados.</p>
                    </div>
                </header>
                <label class="perm-switch${disabled ? ' is-locked' : ''}">
                    <input type="checkbox" name="${namePrefix}Employees" value="1"
                        ${employeesManage ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
                    <span class="perm-switch-ui"></span>
                    <span class="perm-switch-label">
                        <strong>Puede administrar empleados</strong>
                        <small style="display:block;color:rgba(255,255,255,.45);font-weight:400;margin-top:4px">
                            Crear, editar, asignar trabajos y eliminar. Si está desactivado, no verá el módulo.
                        </small>
                    </span>
                </label>
            </article>
        </div>
    `;
}

function wireProjectMode(root) {
    const checksWrap = root.querySelector('[data-project-checks]');
    root.querySelectorAll('input[name$="ProjectMode"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            const selected = root.querySelector('input[name$="ProjectMode"]:checked')?.value;
            if (checksWrap) checksWrap.hidden = selected !== 'selected';
        });
    });
}

function collectSimplePayload(root) {
    const projectMode = root.querySelector('input[name$="ProjectMode"]:checked')?.value || 'all';
    const projectIds = [...root.querySelectorAll('input[name$="ProjectId"]:checked')].map((el) => el.value);
    const employeesManage = !!root.querySelector('input[name$="Employees"]')?.checked;
    return {
        projectMode,
        projectIds,
        employeesManage,
        permissionKeys: buildSimplePermissionKeys({ projectMode, employeesManage })
    };
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
        const modeLabel = PROJECT_ACCESS_OPTIONS.find((o) => o.id === user.project_mode)?.label
            || 'Proyectos';
        return `
            <article class="perm-card${isOwnerUser ? ' perm-card--owner' : ''}${inactive ? ' is-inactive' : ''}">
                <div class="perm-card-avatar">${avatar}</div>
                <div class="perm-card-body">
                    <strong class="perm-card-name">${escapeHtml(user.full_name || 'Sin nombre')}</strong>
                    <span class="perm-card-email">${escapeHtml(user.email || '—')}</span>
                    <div class="perm-card-meta">
                        <span class="perm-role-badge${isOwnerUser ? ' is-owner' : ''}">${escapeHtml(role)}</span>
                        ${inactive ? '<span class="perm-role-badge is-inactive">Inactivo</span>' : ''}
                        ${!isOwnerUser ? `<span class="perm-count">${escapeHtml(modeLabel.split('.')[0])}</span>` : ''}
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

function openAdminModal(mode, user = null) {
    pendingAvatarFile = null;
    const overlay = document.getElementById('adminUserModalOverlay');
    const titleEl = document.getElementById('adminUserModalTitle');
    const bodyEl = document.getElementById('adminUserModalBody');
    if (!overlay || !bodyEl) return;

    const isCreate = mode === 'create';
    titleEl.textContent = isCreate ? 'Nuevo administrador' : 'Editar administrador';

    const projectMode = isCreate ? 'own' : (user?.accessMode || 'all');
    const projectIds = isCreate ? [] : (user?.projectIds || []);
    const employeesManage = isCreate ? false : !!user?.employeesManage;
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
                    </div>
                ` : ''}
                <div class="admin-field">
                    <label for="adminJobTitle">Cargo</label>
                    <input type="text" id="adminJobTitle" placeholder="Ej. Desarrollo Web" value="${escapeHtml(user?.job_title || '')}" ${isOwnerUser ? 'disabled' : ''}>
                </div>
            </section>

            ${isOwnerUser
                ? '<div class="perm-owner-banner">Los CEO tienen acceso completo y no se pueden modificar desde aquí.</div>'
                : renderSimplePermissionCards({ projectMode, projectIds, employeesManage, disabled: false })}

            <span class="admin-form-error" id="adminUserFormError"></span>
            <div class="admin-modal-actions">
                <button type="button" class="admin-btn-secondary" data-close-admin-modal>Cancelar</button>
                ${isOwnerUser ? '' : `<button type="submit" class="admin-btn-primary">${isCreate ? 'Crear administrador' : 'Guardar cambios'}</button>`}
            </div>
        </form>
    `;

    overlay.classList.add('active');
    wireProjectMode(bodyEl);

    bodyEl.querySelector('#adminAvatarPickBtn')?.addEventListener('click', () => {
        bodyEl.querySelector('#adminAvatarInput')?.click();
    });
    bodyEl.querySelector('#adminAvatarInput')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0] || null;
        pendingAvatarFile = file;
        const preview = bodyEl.querySelector('#adminAvatarPreview');
        if (file && preview) {
            preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
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
        const access = collectSimplePayload(bodyEl);

        if (!full_name || !email) {
            errorEl.textContent = 'Nombre y correo son obligatorios.';
            errorEl.classList.add('active');
            return;
        }

        const submitBtn = bodyEl.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            if (isCreate) {
                if (!password || password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
                const result = await createAdmin({
                    full_name,
                    email,
                    password,
                    job_title: job_title || null,
                    avatar_url: null,
                    permission_keys: access.permissionKeys,
                    project_access_mode: access.projectMode === 'selected' ? 'selected' : access.projectMode,
                    project_ids: access.projectIds
                });

                if (pendingAvatarFile && result.userId) {
                    try {
                        const avatar_url = await uploadAdminAvatar(result.userId, pendingAvatarFile);
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
                    project_access_mode: access.projectMode === 'selected' ? 'selected' : access.projectMode,
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
    editorEl.innerHTML = '<div class="admin-loading-inline">Cargando…</div>';

    const users = await listStaffUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) {
        editorEl.innerHTML = '<p class="perm-empty">Usuario no encontrado.</p>';
        return;
    }

    const isOwnerUser = user.role === 'owner';
    const keys = isOwnerUser ? [] : await getUserPermissionKeys(userId);
    const access = isOwnerUser
        ? { mode: 'all', projectIds: [] }
        : await getUserProjectAccess(userId);
    const employeesManage = keys.includes('employees.manage');
    const projectMode = resolveProjectAccessMode(keys, access.mode);

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
                        <span class="perm-role-badge${isOwnerUser ? ' is-owner' : ''}">${escapeHtml(ROLE_LABELS[user.role] || user.role)}</span>
                    </h2>
                    <p>${escapeHtml(user.email || '')}
                        ${user.is_active === false ? ' · <strong>Inactivo</strong>' : ''}</p>
                </div>
            </div>
        </div>
        ${isOwnerUser ? `
            <div class="perm-owner-banner">
                Este usuario es <strong>CEO</strong>. Tiene acceso absoluto.
                No se puede eliminar, desactivar ni modificar sus permisos.
            </div>
        ` : ''}
        <div class="perm-editor-toolbar">
            ${!isOwnerUser ? `<button type="button" class="admin-btn-secondary" id="permOpenEditModal">Editar información y permisos</button>` : ''}
            ${!isOwnerUser ? `<button type="button" class="admin-btn-secondary" id="permResetPassword">Restablecer contraseña</button>` : ''}
            ${!isOwnerUser ? `<button type="button" class="admin-btn-secondary" id="permToggleActive">${user.is_active === false ? 'Reactivar cuenta' : 'Desactivar cuenta'}</button>` : ''}
            ${!isOwnerUser ? `<button type="button" class="admin-btn-secondary perm-danger-btn" id="permDeleteUser">Eliminar cuenta</button>` : ''}
        </div>
        <div class="perm-readonly-block">
            ${renderSimplePermissionCards({
                projectMode: isOwnerUser ? 'all' : projectMode,
                projectIds: access.projectIds,
                employeesManage: isOwnerUser ? true : employeesManage,
                disabled: true
            })}
        </div>
    `;

    editorEl.querySelector('#permBackBtn')?.addEventListener('click', backToList);

    editorEl.querySelector('#permOpenEditModal')?.addEventListener('click', () => {
        openAdminModal('edit', {
            ...user,
            employeesManage,
            accessMode: projectMode,
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
        if (!window.confirm(`¿Seguro que quieres ${next ? 'reactivar' : 'desactivar'} esta cuenta?`)) return;
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
