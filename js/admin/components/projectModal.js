/* ==========================================================
   NEXA HUB — Componente: modal "Nuevo Proyecto" (Portal)
   ==========================================================
   Controla el modal ya presente en admin/proyectos.html. No
   habla con Supabase directamente: delega en "onSubmit" que le
   pasa js/admin/pages/proyectosPage.js.
   ========================================================== */

const overlay = document.getElementById('projectModalOverlay');
const form = document.getElementById('projectForm');
const errorEl = document.getElementById('projectFormError');
const submitBtn = document.getElementById('projectModalSubmit');
const cancelBtn = document.getElementById('projectModalCancel');
const closeBtn = document.getElementById('projectModalClose');

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
    submitBtn.textContent = isSubmitting ? 'Creando...' : 'Crear Proyecto';
}

function setClientSelectLocked(locked, workspaceId = null) {
    const clientSelect = document.getElementById('projectClient');
    if (!clientSelect) return;
    if (workspaceId) clientSelect.value = workspaceId;
    clientSelect.disabled = !!locked;
    const field = clientSelect.closest('.admin-field');
    let hint = field?.querySelector('.cx-portal-client-lock');
    if (locked) {
        if (field && !hint) {
            hint = document.createElement('span');
            hint.className = 'admin-field-hint cx-portal-client-lock';
            hint.textContent = 'Cliente ya seleccionado (Portal).';
            field.appendChild(hint);
        }
    } else if (hint) {
        hint.remove();
    }
}

function escapeOptionText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function populateProjectModalOptions({ clients = [], types = [], admins = [] } = {}) {
    const clientSelect = document.getElementById('projectClient');
    const typeSelect = document.getElementById('projectType');
    const responsibleSelect = document.getElementById('projectResponsible');

    if (clientSelect && Array.isArray(clients)) {
        clientSelect.innerHTML = '<option value="">Selecciona un cliente...</option>' +
            clients.map((c) => {
                const label = c.profiles?.full_name || c.name || 'Cliente';
                return `<option value="${escapeOptionText(c.id)}">${escapeOptionText(label)}</option>`;
            }).join('');
    }

    if (typeSelect && Array.isArray(types)) {
        typeSelect.innerHTML = '<option value="">Selecciona un tipo...</option>' +
            types.map((t) => `<option value="${escapeOptionText(t.id)}">${escapeOptionText(t.name)}</option>`).join('');
    }

    if (responsibleSelect && Array.isArray(admins)) {
        responsibleSelect.innerHTML = '<option value="">Sin asignar</option>' +
            admins.map((a) => {
                const label = a.full_name || a.email || 'Admin';
                return `<option value="${escapeOptionText(a.id)}">${escapeOptionText(label)}</option>`;
            }).join('');
    }
}

/** ¿El select de tipos ya tiene opciones reales (más allá del placeholder)? */
export function hasProjectTypeOptions() {
    const typeSelect = document.getElementById('projectType');
    if (!typeSelect) return false;
    return Array.from(typeSelect.options).some((o) => o.value);
}

/**
 * @param {object} opts
 * @param {(payload: object) => Promise<void>} opts.onSubmit
 * @param {string|null} [opts.workspaceId] — si viene, el cliente queda preseleccionado y bloqueado
 */
export function openProjectModal({ onSubmit, workspaceId = null } = {}) {
    if (!overlay || !form) return;
    submitHandler = onSubmit || null;
    clearError();
    form.reset();
    document.getElementById('projectColor').value = '#2D8CFF';
    document.getElementById('projectColor2').value = '#FF8A3D';
    setClientSelectLocked(!!workspaceId, workspaceId || null);
    overlay.classList.add('active');
}

export function closeProjectModal() {
    if (!overlay || !form) return;
    overlay.classList.remove('active');
    form.reset();
    clearError();
    submitHandler = null;
    setClientSelectLocked(false, null);
}

if (closeBtn) closeBtn.addEventListener('click', closeProjectModal);
if (cancelBtn) cancelBtn.addEventListener('click', closeProjectModal);

if (overlay) {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeProjectModal();
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
        closeProjectModal();
    }
});

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!submitHandler) return;

        clearError();

        const clientSelect = document.getElementById('projectClient');
        const payload = {
            workspace_id: clientSelect?.value,
            name: document.getElementById('projectName').value.trim(),
            project_type_id: document.getElementById('projectType').value || null,
            responsible_id: document.getElementById('projectResponsible').value || null,
            modality: document.getElementById('projectModality').value.trim() || null,
            start_date: document.getElementById('projectStart').value || null,
            end_date: document.getElementById('projectEnd').value || null,
            color_hex: document.getElementById('projectColor').value || null,
            secondary_color_hex: document.getElementById('projectColor2').value || null,
            description: document.getElementById('projectDescription').value.trim()
        };

        if (!payload.workspace_id || !payload.name) {
            showError('Selecciona un cliente y escribe el nombre del proyecto.');
            return;
        }

        setSubmitting(true);
        try {
            await submitHandler(payload);
            closeProjectModal();
        } catch (error) {
            showError(error.message || 'Ocurrió un error al crear el proyecto.');
        } finally {
            setSubmitting(false);
        }
    });
}
