/* ==========================================================
   NEXA HUB — ERP: filtros + buscador UI
   ========================================================== */
import { FINANCE_STATUS_LABELS } from './financeCatalog.js';
import { escapeHtml } from '../projectUi.js';

export function renderFinanceFilters({
    kind = 'income',
    filters = {},
    categories = [],
    methods = [],
    projects = [],
    clients = []
} = {}) {
    return `
        <div class="fin-filters" id="finFilters">
            <input type="search" id="finFilterSearch" class="fin-filter-search" placeholder="Buscar concepto, notas, proveedor…" value="${escapeHtml(filters.search || '')}">
            ${kind === 'income' ? `
                <select id="finFilterClient">
                    <option value="">Todos los clientes</option>
                    ${clients.map((c) => `<option value="${c.workspaceId}" ${filters.clientId === c.workspaceId ? 'selected' : ''}>${escapeHtml(c.company)}</option>`).join('')}
                </select>
            ` : ''}
            <select id="finFilterProject">
                <option value="">Todos los proyectos</option>
                ${projects.map((p) => `<option value="${p.id}" ${filters.projectId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
            </select>
            <select id="finFilterCategory">
                <option value="">Todas las categorías</option>
                ${categories.map((c) => `<option value="${c.id}" ${filters.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
            <select id="finFilterMethod">
                <option value="">Todos los métodos</option>
                ${methods.map((m) => `<option value="${m.id}" ${filters.paymentMethodId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            </select>
            <select id="finFilterStatus">
                <option value="">Todos los estados</option>
                ${Object.entries(FINANCE_STATUS_LABELS).map(([k, label]) => `
                    <option value="${k}" ${filters.status === k ? 'selected' : ''}>${escapeHtml(label)}</option>
                `).join('')}
            </select>
            <button type="button" class="admin-btn-secondary" id="finFilterClear">Limpiar</button>
        </div>
    `;
}

export function readFinanceFilters(kind = 'income') {
    return {
        search: document.getElementById('finFilterSearch')?.value.trim() || '',
        clientId: kind === 'income' ? (document.getElementById('finFilterClient')?.value || null) : null,
        projectId: document.getElementById('finFilterProject')?.value || null,
        categoryId: document.getElementById('finFilterCategory')?.value || null,
        paymentMethodId: document.getElementById('finFilterMethod')?.value || null,
        status: document.getElementById('finFilterStatus')?.value || null
    };
}

export function wireFinanceFilters(onChange) {
    const ids = ['finFilterSearch', 'finFilterClient', 'finFilterProject', 'finFilterCategory', 'finFilterMethod', 'finFilterStatus'];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const evt = id === 'finFilterSearch' ? 'input' : 'change';
        let timer = null;
        el.addEventListener(evt, () => {
            if (evt === 'input') {
                clearTimeout(timer);
                timer = setTimeout(() => onChange?.(), 280);
            } else onChange?.();
        });
    });
    document.getElementById('finFilterClear')?.addEventListener('click', () => {
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        onChange?.();
    });
}

export function renderGlobalSearchBar() {
    return `
        <div class="fin-global-search">
            <input type="search" id="finGlobalSearch" placeholder="Buscar en Contabilidad: clientes, conceptos, proveedores…">
            <div class="fin-global-results" id="finGlobalResults" hidden></div>
        </div>
    `;
}

let finGlobalSearchDocListenerBound = false;

export function wireGlobalSearch(searchFn) {
    const input = document.getElementById('finGlobalSearch');
    const box = document.getElementById('finGlobalResults');
    if (!input || !box) return;

    let timer = null;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const liveBox = document.getElementById('finGlobalResults');
            const liveInput = document.getElementById('finGlobalSearch');
            if (!liveBox || !liveInput) return;
            const q = liveInput.value.trim();
            if (!q) {
                liveBox.hidden = true;
                liveBox.innerHTML = '';
                return;
            }
            liveBox.hidden = false;
            liveBox.innerHTML = '<p class="fin-muted">Buscando…</p>';
            try {
                const result = await searchFn(q);
                const blocks = [];
                if (result.incomes?.length) {
                    blocks.push(`<div class="fin-gs-group"><strong>Ingresos</strong>${result.incomes.map((r) => `
                        <a href="contabilidad-ingresos.html">${escapeHtml(r.concept)} · ${escapeHtml(r.entry_date)}</a>
                    `).join('')}</div>`);
                }
                if (result.expenses?.length) {
                    blocks.push(`<div class="fin-gs-group"><strong>Gastos</strong>${result.expenses.map((r) => `
                        <a href="contabilidad-gastos.html">${escapeHtml(r.concept)} · ${escapeHtml(r.vendor_name || '')}</a>
                    `).join('')}</div>`);
                }
                if (result.categories?.length) {
                    blocks.push(`<div class="fin-gs-group"><strong>Categorías</strong>${result.categories.map((c) => `
                        <span>${escapeHtml(c.name)}</span>
                    `).join('')}</div>`);
                }
                if (result.clients?.length) {
                    blocks.push(`<div class="fin-gs-group"><strong>Clientes</strong>${result.clients.map((c) => `
                        <span>${escapeHtml(c.company)}</span>
                    `).join('')}</div>`);
                }
                liveBox.innerHTML = blocks.length ? blocks.join('') : '<p class="fin-muted">Sin resultados.</p>';
            } catch (error) {
                liveBox.innerHTML = `<p class="fin-error">${escapeHtml(error.message)}</p>`;
            }
        }, 300);
    });

    if (!finGlobalSearchDocListenerBound) {
        finGlobalSearchDocListenerBound = true;
        document.addEventListener('click', (e) => {
            const liveBox = document.getElementById('finGlobalResults');
            if (!liveBox) return;
            if (!e.target.closest('.fin-global-search')) {
                liveBox.hidden = true;
            }
        });
    }
}
