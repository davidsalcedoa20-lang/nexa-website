/* ==========================================================
   NEXA HUB — Componente: modal "Regenerar contraseña temporal"
   ==========================================================
   No habla con Supabase: al enviar, delega en "onSubmit" que le
   pasa js/admin/pages/clientsPage.js (que sí llama al servicio /
   Edge Function correspondiente).
   ========================================================== */
import { generateTemporaryPassword } from '../../utils/passwordGenerator.js';

const overlay = document.getElementById('resetPasswordModalOverlay');
const form = document.getElementById('resetPasswordForm');
const labelEl = document.getElementById('resetPasswordClientLabel');
const valueInput = document.getElementById('resetPasswordValue');
const generateBtn = document.getElementById('resetPasswordGenerateBtn');
const errorEl = document.getElementById('resetPasswordFormError');
const submitBtn = document.getElementById('resetPasswordSubmit');
const cancelBtn = document.getElementById('resetPasswordCancel');
const closeBtn = document.getElementById('resetPasswordModalClose');

const MIN_PASSWORD_LENGTH = 8;

let submitHandler = null;

function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.add('active');
}

function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.remove('active');
}

function setSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? 'Guardando...' : 'Establecer contraseña';
}

/**
 * @param {{clientLabel:string, onSubmit:Function}} options
 */
export function openResetPasswordModal(options) {
    if (!overlay || !form) return;
    submitHandler = options.onSubmit || null;
    clearError();
    form.reset();
    if (labelEl) labelEl.textContent = options.clientLabel || '';
    overlay.classList.add('active');
}

export function closeResetPasswordModal() {
    if (!overlay || !form) return;
    overlay.classList.remove('active');
    form.reset();
    clearError();
    submitHandler = null;
}

if (generateBtn) {
    generateBtn.addEventListener('click', function () {
        if (valueInput) valueInput.value = generateTemporaryPassword();
    });
}

if (closeBtn) closeBtn.addEventListener('click', closeResetPasswordModal);
if (cancelBtn) cancelBtn.addEventListener('click', closeResetPasswordModal);

if (overlay) {
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeResetPasswordModal();
    });
}

if (form) {
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!submitHandler) return;

        clearError();

        // .trim(): la Edge Function "reset-client-password" también recorta
        // espacios antes de guardar (mismo motivo que en clientModal.js).
        const password = valueInput ? valueInput.value.trim() : '';
        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            showError(`La contraseña temporal debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
            return;
        }

        setSubmitting(true);
        try {
            await submitHandler(password);
            closeResetPasswordModal();
        } catch (error) {
            showError(error.message || 'Ocurrió un error al establecer la contraseña.');
        } finally {
            setSubmitting(false);
        }
    });
}
