/* ==========================================================
   NEXA HUB — ERP: grid modular del dashboard
   ========================================================== */
import { FINANCE_WIDGETS } from './financeCatalog.js';
import { formatMoney, formatVariation } from './financeFormat.js';
import { openHelpDrawer } from './financeShell.js';
import { escapeHtml } from '../projectUi.js';

const SIZE_CYCLE = ['sm', 'md', 'lg'];

const ICONS = {
    income: '<path d="M12 19V5M12 5l-4 4M12 5l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    expense: '<path d="M12 5v14M12 19l-4-4M12 19l4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    chart: '<path d="M4 19h16M7 16V9M12 16V5M17 16v-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    ops: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    net: '<path d="M4 12h16M12 4v16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    flow: '<path d="M4 8h10l-2-2M20 16H10l2 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    wallet: '<rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M3 11h18M16 14h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    receivable: '<path d="M5 19V6a1 1 0 0 1 1-1h8l5 5v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z" stroke="currentColor" stroke-width="1.6"/><path d="M14 5v4h4" stroke="currentColor" stroke-width="1.6"/>',
    payable: '<path d="M8 7h12M8 12h12M8 17h8M4 7h.01M4 12h.01M4 17h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    pct: '<path d="M8 16l8-8M9.5 9.5a1.5 1.5 0 1 1 0-0.01M14.5 14.5a1.5 1.5 0 1 1 0-0.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
};

function metaFor(key) {
    return FINANCE_WIDGETS.find((w) => w.key === key) || { key, name: key, color: '#8C52FF', icon: 'chart' };
}

export function normalizeLayout(layout) {
    const byKey = new Map((layout || []).map((item) => [item.key, item]));
    const merged = FINANCE_WIDGETS.map((w, index) => {
        const prev = byKey.get(w.key);
        return {
            key: w.key,
            visible: prev?.visible !== false,
            order: Number.isFinite(prev?.order) ? prev.order : index,
            size: SIZE_CYCLE.includes(prev?.size) ? prev.size : (w.size || 'md')
        };
    });
    return merged.sort((a, b) => a.order - b.order).map((item, index) => ({ ...item, order: index }));
}

export function renderDashboardGrid({
    layout,
    values = {},
    variations = {},
    currency = 'COP',
    locale = 'es-CO',
    editMode = false
}) {
    const items = normalizeLayout(layout).filter((item) => item.visible || editMode);
    if (!items.length) {
        return '<p class="fin-empty">No hay tarjetas visibles. Activa el modo personalizar para mostrarlas.</p>';
    }

    return `
        <div class="fin-dash-grid" id="finDashGrid">
            ${items.map((item) => {
                const meta = metaFor(item.key);
                const raw = values[item.key];
                const display = item.key === 'profitability'
                    ? (raw === null || raw === undefined ? '—' : `${Number(raw).toFixed(1)}%`)
                    : formatMoney(raw ?? 0, { currency, locale });
                const variation = formatVariation(variations[item.key]);
                const icon = ICONS[meta.icon] || ICONS.chart;
                return `
                    <article class="fin-kpi-card size-${item.size}${item.visible ? '' : ' is-hidden-card'}"
                        draggable="${editMode ? 'true' : 'false'}"
                        data-widget-key="${item.key}"
                        style="--fin-accent:${escapeHtml(meta.color)}">
                        <div class="fin-kpi-top">
                            <span class="fin-kpi-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none">${icon}</svg>
                            </span>
                            <div class="fin-kpi-actions">
                                <button type="button" class="fin-help-btn" data-help="${item.key}" title="Qué significa" aria-label="Ayuda">ⓘ</button>
                                ${editMode ? `
                                    <button type="button" class="fin-icon-mini" data-resize="${item.key}" title="Redimensionar">⛶</button>
                                    <button type="button" class="fin-icon-mini" data-toggle-vis="${item.key}" title="${item.visible ? 'Ocultar' : 'Mostrar'}">${item.visible ? '◉' : '○'}</button>
                                    <span class="fin-drag-handle" title="Arrastrar">⠿</span>
                                ` : ''}
                            </div>
                        </div>
                        <span class="fin-kpi-name">${escapeHtml(meta.name)}</span>
                        <strong class="fin-kpi-value">${escapeHtml(display)}</strong>
                        <span class="fin-kpi-delta tone-${variation.tone}">${escapeHtml(variation.text)}</span>
                    </article>
                `;
            }).join('')}
        </div>
    `;
}

export function wireDashboardGrid({ getLayout, setLayout, onSave, editMode }) {
    document.querySelectorAll('[data-help]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openHelpDrawer(btn.getAttribute('data-help'));
        });
    });

    if (!editMode) return;

    document.querySelectorAll('[data-resize]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const key = btn.getAttribute('data-resize');
            const layout = normalizeLayout(getLayout());
            const item = layout.find((x) => x.key === key);
            if (!item) return;
            const idx = SIZE_CYCLE.indexOf(item.size);
            item.size = SIZE_CYCLE[(idx + 1) % SIZE_CYCLE.length];
            setLayout(layout);
            await onSave?.(layout);
        });
    });

    document.querySelectorAll('[data-toggle-vis]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const key = btn.getAttribute('data-toggle-vis');
            const layout = normalizeLayout(getLayout());
            const item = layout.find((x) => x.key === key);
            if (!item) return;
            item.visible = !item.visible;
            setLayout(layout);
            await onSave?.(layout);
        });
    });

    let dragKey = null;
    const grid = document.getElementById('finDashGrid');
    if (!grid) return;

    grid.querySelectorAll('.fin-kpi-card').forEach((card) => {
        card.addEventListener('dragstart', (e) => {
            dragKey = card.dataset.widgetKey;
            card.classList.add('is-dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('is-dragging');
            dragKey = null;
        });
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            const over = e.currentTarget;
            if (!dragKey || over.dataset.widgetKey === dragKey) return;
            const layout = normalizeLayout(getLayout());
            const from = layout.findIndex((x) => x.key === dragKey);
            const to = layout.findIndex((x) => x.key === over.dataset.widgetKey);
            if (from < 0 || to < 0 || from === to) return;
            const [moved] = layout.splice(from, 1);
            layout.splice(to, 0, moved);
            layout.forEach((item, i) => { item.order = i; });
            setLayout(layout);

            const dragging = grid.querySelector('.fin-kpi-card.is-dragging');
            if (dragging && over !== dragging) {
                const cards = [...grid.querySelectorAll('.fin-kpi-card')];
                const overIndex = cards.indexOf(over);
                const dragIndex = cards.indexOf(dragging);
                if (dragIndex < overIndex) over.after(dragging);
                else over.before(dragging);
            }
        });
        card.addEventListener('drop', async (e) => {
            e.preventDefault();
            await onSave?.(normalizeLayout(getLayout()));
        });
    });
}
