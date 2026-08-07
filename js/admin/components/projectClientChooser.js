/* ==========================================================
   Modal: seleccionar cliente (Portal | Express) antes de crear proyecto
   ========================================================== */

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {object} opts
 * @param {Array<{ kind:'portal'|'express', id:string, label:string, sublabel?:string }>} opts.clients
 * @param {(client: object) => void} opts.onSelect
 */
export function openProjectClientChooser({ clients = [], onSelect } = {}) {
    const existing = document.getElementById('projectClientChooserOverlay');
    if (existing) existing.remove();

    const sorted = [...clients].sort((a, b) =>
        String(a.label || '').localeCompare(String(b.label || ''), 'es', { sensitivity: 'base' })
    );

    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay active';
    overlay.id = 'projectClientChooserOverlay';
    overlay.innerHTML = `
        <div class="admin-modal cx-chooser-modal" role="dialog" aria-modal="true">
            <div class="admin-modal-header">
                <h3>Seleccionar cliente</h3>
                <button type="button" class="admin-modal-close" data-close aria-label="Cerrar">✕</button>
            </div>
            <p class="cx-type-intro">Elige el cliente al que pertenece el proyecto. El sistema cargará el formulario según el tipo.</p>
            <div class="admin-field" style="margin-bottom:12px">
                <input type="search" id="cxClientSearch" class="admin-input" placeholder="Buscar cliente…" autocomplete="off">
            </div>
            <div class="cx-chooser-list" id="cxChooserList" role="listbox">
                ${sorted.length ? sorted.map((c, i) => renderItem(c, i)).join('') : `
                    <p class="cx-chooser-empty">No hay clientes disponibles. Crea uno en Clientes primero.</p>
                `}
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

    const listEl = overlay.querySelector('#cxChooserList');
    const searchEl = overlay.querySelector('#cxClientSearch');

    function applySearch() {
        const q = (searchEl?.value || '').trim().toLowerCase();
        listEl.querySelectorAll('[data-chooser-idx]').forEach((el) => {
            const hay = (el.getAttribute('data-search') || '').toLowerCase();
            el.style.display = !q || hay.includes(q) ? '' : 'none';
        });
    }
    searchEl?.addEventListener('input', applySearch);

    listEl.querySelectorAll('[data-chooser-idx]').forEach((el) => {
        el.addEventListener('click', () => {
            const idx = Number(el.getAttribute('data-chooser-idx'));
            const client = sorted[idx];
            if (!client) return;
            close();
            onSelect?.(client);
        });
    });
}

function renderItem(c, i) {
    const kindLabel = c.kind === 'express' ? 'Cliente Express' : 'Cliente Portal';
    const kindClass = c.kind === 'express' ? 'express' : 'portal';
    const search = [c.label, c.sublabel, kindLabel].filter(Boolean).join(' ');
    return `
        <button type="button" class="cx-chooser-item" role="option"
            data-chooser-idx="${i}" data-search="${escapeHtml(search)}">
            <span class="cx-chooser-main">
                <strong>${escapeHtml(c.label || 'Sin nombre')}</strong>
                ${c.sublabel ? `<span class="cx-chooser-sub">${escapeHtml(c.sublabel)}</span>` : ''}
            </span>
            <span class="cx-kind-badge ${kindClass}">${kindLabel}</span>
        </button>
    `;
}
