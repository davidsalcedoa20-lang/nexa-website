/* ==========================================================
   Modal: crear / editar Cliente Express
   ========================================================== */

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function openExpressClientModal({ mode = 'create', client = null, onSubmit } = {}) {
    const existing = document.getElementById('expressClientModalOverlay');
    if (existing) existing.remove();

    const isEdit = mode === 'edit';
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay active';
    overlay.id = 'expressClientModalOverlay';
    overlay.innerHTML = `
        <div class="admin-modal" role="dialog" aria-modal="true">
            <div class="admin-modal-header">
                <h3>${isEdit ? 'Editar Cliente Express' : 'Nuevo Cliente Express'}</h3>
                <button type="button" class="admin-modal-close" data-close aria-label="Cerrar">✕</button>
            </div>
            <form id="expressClientForm" class="admin-form" novalidate>
                <div class="admin-field">
                    <label>Nombre del cliente *</label>
                    <input name="full_name" required value="${escapeHtml(client?.full_name || '')}" placeholder="Ej. Juan Pérez">
                </div>
                <div class="admin-field">
                    <label>Teléfono *</label>
                    <input name="phone" required value="${escapeHtml(client?.phone || '')}" placeholder="Ej. +57 300 000 0000">
                </div>
                <div class="admin-field">
                    <label>Observaciones *</label>
                    <textarea name="notes" rows="3" required placeholder="Indicaciones, contexto, notas internas…">${escapeHtml(client?.notes || '')}</textarea>
                </div>
                <div class="admin-field">
                    <label>Empresa (opcional)</label>
                    <input name="company" value="${escapeHtml(client?.company || '')}" placeholder="Ej. Estudio Norte">
                </div>
                <div class="admin-field">
                    <label>Ciudad (opcional)</label>
                    <input name="city" value="${escapeHtml(client?.city || '')}" placeholder="Ej. Medellín">
                </div>
                <div class="admin-field">
                    <label>WhatsApp (opcional)</label>
                    <input name="whatsapp" value="${escapeHtml(client?.whatsapp || '')}" placeholder="Ej. +57 300 000 0000">
                </div>
                <p class="admin-field-hint" style="margin-top:-4px">Este cliente no tendrá usuario ni acceso al portal.</p>
                <span class="admin-form-error" id="expressClientFormError"></span>
                <div class="admin-modal-actions">
                    <button type="button" class="admin-btn-secondary" data-close>Cancelar</button>
                    <button type="submit" class="admin-btn-primary">${isEdit ? 'Guardar cambios' : 'Crear Cliente Express'}</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    const errorEl = overlay.querySelector('#expressClientFormError');
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#expressClientForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
            full_name: fd.get('full_name'),
            phone: fd.get('phone'),
            notes: fd.get('notes'),
            company: fd.get('company'),
            city: fd.get('city'),
            whatsapp: fd.get('whatsapp')
        };
        try {
            if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('active'); }
            const submitBtn = e.currentTarget.querySelector('[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando…'; }
            await onSubmit?.(payload);
            close();
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = err.message || 'No se pudo guardar.';
                errorEl.classList.add('active');
            }
            const submitBtn = e.currentTarget.querySelector('[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear Cliente Express';
            }
        }
    });
}
