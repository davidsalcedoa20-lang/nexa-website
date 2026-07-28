/* ==========================================================
   NEXA HUB — Página: Configuración (cliente)
   dashboard/configuracion.html
   ========================================================== */
import {
    getMySettings,
    updateMyProfile,
    updateMyCompany,
    uploadMyAvatar,
    changeMyPassword,
    signOut
} from '../../services/settingsService.js';
import {
    showSettingsMessage,
    clearSettingsMessage,
    setButtonLoading,
    renderAvatarPreview,
    refreshShellUserLabels
} from '../../components/settingsUi.js';

function el(id) { return document.getElementById(id); }

let currentProfile = null;
let currentWorkspace = null;

async function init() {
    try {
        const { profile, workspace } = await getMySettings();
        currentProfile = profile;
        currentWorkspace = workspace;
        fillProfileForm(profile, workspace);
        renderAvatarPreview(el('settingsAvatarImg'), el('settingsAvatarFallback'), profile);
        if (el('settingsLoading')) el('settingsLoading').style.display = 'none';
        if (el('settingsContent')) el('settingsContent').style.display = 'flex';
    } catch (error) {
        console.error('[configuracionPage] Error cargando configuración:', error.message);
        if (el('settingsLoading')) {
            el('settingsLoading').textContent = `No se pudo cargar tu configuración: ${error.message}`;
        }
    }
}

function fillProfileForm(profile, workspace) {
    el('settingsFullName').value = profile.full_name || '';
    el('settingsCompany').value = workspace?.name || '';
    el('settingsEmail').value = profile.email || '';
    el('settingsPhone').value = profile.phone || '';
}

el('settingsProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = el('settingsProfileMessage');
    clearSettingsMessage(msg);

    const fullName = el('settingsFullName').value.trim();
    const company = el('settingsCompany').value.trim();
    if (!fullName) {
        showSettingsMessage(msg, 'El nombre es obligatorio.', 'error');
        return;
    }
    if (!company) {
        showSettingsMessage(msg, 'El nombre de la empresa es obligatorio.', 'error');
        return;
    }

    const btn = el('settingsProfileSubmit');
    setButtonLoading(btn, true);
    try {
        const [profile] = await Promise.all([
            updateMyProfile({
                full_name: fullName,
                phone: el('settingsPhone').value.trim() || null
            }),
            updateMyCompany(company)
        ]);
        currentProfile = profile;
        currentWorkspace = { ...(currentWorkspace || {}), name: company };
        refreshShellUserLabels(currentProfile);
        showSettingsMessage(msg, 'Perfil actualizado correctamente.', 'success');
    } catch (error) {
        showSettingsMessage(msg, error.message || 'No se pudo guardar el perfil.', 'error');
    } finally {
        setButtonLoading(btn, false, 'Guardar cambios');
    }
});

el('settingsAvatarInput')?.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    const msg = el('settingsProfileMessage');
    clearSettingsMessage(msg);
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    if (el('settingsAvatarImg')) {
        el('settingsAvatarImg').src = localUrl;
        el('settingsAvatarImg').style.display = 'block';
    }
    if (el('settingsAvatarFallback')) el('settingsAvatarFallback').style.display = 'none';

    try {
        const result = await uploadMyAvatar(file);
        currentProfile = result.profile;
        renderAvatarPreview(el('settingsAvatarImg'), el('settingsAvatarFallback'), currentProfile);
        showSettingsMessage(msg, 'Foto de perfil actualizada.', 'success');
    } catch (error) {
        renderAvatarPreview(el('settingsAvatarImg'), el('settingsAvatarFallback'), currentProfile);
        showSettingsMessage(msg, error.message || 'No se pudo subir la foto.', 'error');
    } finally {
        URL.revokeObjectURL(localUrl);
    }
});

el('settingsAvatarBtn')?.addEventListener('click', () => el('settingsAvatarInput')?.click());

el('settingsPasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = el('settingsPasswordMessage');
    clearSettingsMessage(msg);
    const btn = el('settingsPasswordSubmit');
    setButtonLoading(btn, true);
    try {
        await changeMyPassword({
            currentPassword: el('settingsCurrentPassword').value,
            newPassword: el('settingsNewPassword').value,
            confirmPassword: el('settingsConfirmPassword').value
        });
        el('settingsPasswordForm').reset();
        showSettingsMessage(msg, 'Contraseña actualizada correctamente.', 'success');
    } catch (error) {
        showSettingsMessage(msg, error.message || 'No se pudo cambiar la contraseña.', 'error');
    } finally {
        setButtonLoading(btn, false, 'Actualizar contraseña');
    }
});

el('settingsLogoutBtn')?.addEventListener('click', async () => {
    try {
        await signOut();
        window.location.href = '../portal/index.html';
    } catch (error) {
        alert(`No se pudo cerrar la sesión: ${error.message}`);
    }
});

init();
