/* ==========================================================
   Modal: elegir tipo de cliente (Portal | Express)
   ========================================================== */

export function openClientTypeChooser({ onPortal, onExpress } = {}) {
    const existing = document.getElementById('clientTypeChooserOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay active';
    overlay.id = 'clientTypeChooserOverlay';
    overlay.innerHTML = `
        <div class="admin-modal cx-type-modal" role="dialog" aria-modal="true">
            <div class="admin-modal-header">
                <h3>Nuevo Cliente</h3>
                <button type="button" class="admin-modal-close" data-close aria-label="Cerrar">✕</button>
            </div>
            <p class="cx-type-intro">Elige el tipo de cliente que quieres crear.</p>
            <div class="cx-type-grid">
                <button type="button" class="cx-type-card" data-pick="portal">
                    <span class="cx-type-badge portal">Portal</span>
                    <strong>Cliente Portal</strong>
                    <p>Tiene usuario, contraseña y acceso al Portal NEXA Hub.</p>
                </button>
                <button type="button" class="cx-type-card" data-pick="express">
                    <span class="cx-type-badge express">Express</span>
                    <strong>Cliente Express</strong>
                    <p>Sin acceso al portal. Ideal para trabajos internos y proyectos con Drive.</p>
                </button>
            </div>
            <div class="admin-modal-actions">
                <button type="button" class="admin-btn-secondary" data-close>Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-pick="portal"]')?.addEventListener('click', () => { close(); onPortal?.(); });
    overlay.querySelector('[data-pick="express"]')?.addEventListener('click', () => { close(); onExpress?.(); });
}
