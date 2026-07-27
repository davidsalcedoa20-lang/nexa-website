/* ==========================================================
   NEXA HUB — Componente: modal de Cliente
   ==========================================================
   Controla abrir/cerrar el modal "Nuevo Cliente" / "Editar
   Cliente" / "Detalle del Cliente" que ya existe en el HTML de
   admin/clientes.html (este archivo no genera el markup, solo
   lo controla). No importa clientService ni Supabase: al
   guardar, delega en la función "onSubmit" que le pasa
   js/admin/pages/clientsPage.js.
   ========================================================== */

const overlay = document.getElementById('clientModalOverlay');
const form = document.getElementById('clientForm');
const titleEl = document.getElementById('clientModalTitle');
const submitBtn = document.getElementById('clientModalSubmit');
const cancelBtn = document.getElementById('clientModalCancel');
const closeBtn = document.getElementById('clientModalClose');
const errorEl = document.getElementById('clientFormError');

const fieldIds = {
    company: 'clientCompany',
    contact: 'clientContact',
    email: 'clientEmail',
    phone: 'clientPhone',
    city: 'clientCity',
    notes: 'clientNotes'
};

let currentMode = 'create';
let currentClient = null;
let submitHandler = null;

function getField(key) {
    return document.getElementById(fieldIds[key]);
}

function showModalError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.add('active');
}

function clearModalError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.remove('active');
}

function setSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    submitBtn.textContent = isSubmitting ? 'Guardando...' : (currentMode === 'edit' ? 'Guardar cambios' : 'Guardar Cliente');
}

/**
 * Abre el modal en modo "create", "edit" o "view".
 *
 * @param {{mode:'create'|'edit'|'view', client?:object, onSubmit?:Function}} options
 */
export function openClientModal(options) {
    if (!overlay || !form) return;

    currentMode = options.mode;
    currentClient = options.client || null;
    submitHandler = options.onSubmit || null;

    clearModalError();
    form.reset();

    if (currentClient) {
        getField('company').value = currentClient.company || '';
        getField('contact').value = currentClient.contact || '';
        getField('email').value = currentClient.email && currentClient.email !== '—' ? currentClient.email : '';
        getField('phone').value = currentClient.phone || '';
        getField('city').value = currentClient.city || '';
        getField('notes').value = currentClient.notes || '';
    }

    const isView = currentMode === 'view';
    const isEdit = currentMode === 'edit';

    Object.keys(fieldIds).forEach(function (key) {
        getField(key).disabled = isView;
    });

    // El correo solo se puede definir al crear (cambiarlo requiere la Admin API).
    getField('email').disabled = isView || isEdit;

    if (submitBtn) {
        submitBtn.style.display = isView ? 'none' : 'inline-flex';
        submitBtn.textContent = isEdit ? 'Guardar cambios' : 'Guardar Cliente';
    }

    if (titleEl) {
        titleEl.textContent = currentMode === 'create'
            ? 'Nuevo Cliente'
            : (isEdit ? 'Editar Cliente' : 'Detalle del Cliente');
    }

    overlay.classList.add('active');
}

export function closeClientModal() {
    if (!overlay || !form) return;
    overlay.classList.remove('active');
    form.reset();
    clearModalError();
    submitHandler = null;
    currentClient = null;
}

if (closeBtn) closeBtn.addEventListener('click', closeClientModal);
if (cancelBtn) cancelBtn.addEventListener('click', closeClientModal);

if (overlay) {
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeClientModal();
    });
}

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
        closeClientModal();
    }
});

if (form) {
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (currentMode === 'view' || !submitHandler) {
            return;
        }

        clearModalError();

        const payload = {
            company: getField('company').value.trim(),
            contact: getField('contact').value.trim(),
            email: getField('email').value.trim(),
            phone: getField('phone').value.trim(),
            city: getField('city').value.trim(),
            notes: getField('notes').value.trim()
        };

        if (!payload.company || !payload.contact || (currentMode === 'create' && !payload.email)) {
            showModalError('Empresa, contacto y correo son obligatorios.');
            return;
        }

        setSubmitting(true);

        try {
            await submitHandler(payload, currentClient);
            closeClientModal();
        } catch (error) {
            showModalError(error.message || 'Ocurrió un error al guardar. Intenta de nuevo.');
        } finally {
            setSubmitting(false);
        }
    });
}
