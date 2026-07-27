/* ==========================================================
   NEXA HUB — Componente: modal "Nuevo Proyecto"
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

export function populateProjectModalOptions({ clients = [], types = [], admins = [] }) {
    const clientSelect = document.getElementById('projectClient');
    const typeSelect = document.getElementById('projectType');
    const responsibleSelect = document.getElementById('projectResponsible');

    if (clientSelect) {
        clientSelect.innerHTML = '<option value="">Selecciona un cliente...</option>' +
            clients.map((c) => `<option value="${c.id}">${c.profiles?.full_name || c.name}</option>`).join('');
    }

    if (typeSelect) {
        typeSelect.innerHTML = '<option value="">Selecciona un tipo...</option>' +
            types.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
    }

    if (responsibleSelect) {
        responsibleSelect.innerHTML = '<option value="">Sin asignar</option>' +
            admins.map((a) => `<option value="${a.id}">${a.full_name || a.email}</option>`).join('');
    }
}

export function openProjectModal({ onSubmit }) {
    if (!overlay || !form) return;
    submitHandler = onSubmit || null;
    clearError();
    form.reset();
    document.getElementById('projectColor').value = '#2D8CFF';
    document.getElementById('projectColor2').value = '#FF8A3D';
    overlay.classList.add('active');
}

export function closeProjectModal() {
    if (!overlay || !form) return;
    overlay.classList.remove('active');
    form.reset();
    clearError();
    submitHandler = null;
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

        const payload = {
            workspace_id: document.getElementById('projectClient').value,
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
