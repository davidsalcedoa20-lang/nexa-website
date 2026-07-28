/* ==========================================================
   NEXA HUB — Helpers UI compartidos de Configuración
   ========================================================== */
import { escapeHtml, getInitials } from './projectUi.js';

export function showSettingsMessage(el, message, type) {
    if (!el) return;
    el.textContent = message || '';
    el.classList.remove('is-success', 'is-error', 'active');
    if (!message) return;
    el.classList.add('active', type === 'success' ? 'is-success' : 'is-error');
}

export function clearSettingsMessage(el) {
    showSettingsMessage(el, '', null);
}

export function setButtonLoading(btn, isLoading, idleLabel) {
    if (!btn) return;
    btn.disabled = !!isLoading;
    if (isLoading) {
        btn.dataset.idleLabel = btn.dataset.idleLabel || btn.textContent;
        btn.textContent = 'Guardando...';
    } else {
        btn.textContent = idleLabel || btn.dataset.idleLabel || btn.textContent;
    }
}

/**
 * Pinta la foto de perfil (o iniciales) en el contenedor.
 * @param {HTMLElement} imgEl
 * @param {HTMLElement} fallbackEl
 * @param {{avatar_url?:string, full_name?:string}} profile
 */
export function renderAvatarPreview(imgEl, fallbackEl, profile) {
    const url = profile?.avatar_url || '';
    const initials = getInitials(profile?.full_name || '');

    if (fallbackEl) fallbackEl.textContent = initials;

    if (url && imgEl) {
        imgEl.src = url;
        imgEl.alt = profile.full_name || 'Foto de perfil';
        imgEl.style.display = 'block';
        if (fallbackEl) fallbackEl.style.display = 'none';
    } else {
        if (imgEl) {
            imgEl.removeAttribute('src');
            imgEl.style.display = 'none';
        }
        if (fallbackEl) fallbackEl.style.display = 'flex';
    }
}

/** Actualiza el nombre mostrado en el topbar sin recargar. */
export function refreshShellUserLabels(profile) {
    if (!profile) return;
    const fullName = profile.full_name || '';
    const firstName = fullName.trim().split(/\s+/).filter(Boolean)[0] || fullName;
    const initials = getInitials(fullName);

    document.querySelectorAll('[data-user-name]').forEach((el) => {
        el.textContent = fullName;
    });
    document.querySelectorAll('[data-user-firstname]').forEach((el) => {
        el.textContent = firstName;
    });
    document.querySelectorAll('[data-user-initials]').forEach((el) => {
        el.textContent = initials;
    });
}

export function escapeAttr(value) {
    return escapeHtml(value);
}
