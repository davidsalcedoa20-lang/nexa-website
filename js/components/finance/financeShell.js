/* ==========================================================
   NEXA HUB — ERP: shell UI (subnav, mes, ayuda lateral)
   ========================================================== */
import { FINANCE_SUBNAV, FINANCE_HELP } from './financeCatalog.js';
import {
    buildMonthOptions,
    currentMonthKey,
    formatMonthLabel,
    shiftMonth
} from './financeFormat.js';
import { escapeHtml } from '../projectUi.js';

const MONTH_STORAGE_KEY = 'nexa_finance_month';

export function getSelectedMonth() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('month');
    if (fromUrl && /^\d{4}-\d{2}$/.test(fromUrl)) return fromUrl;
    const stored = localStorage.getItem(MONTH_STORAGE_KEY);
    if (stored && /^\d{4}-\d{2}$/.test(stored)) return stored;
    return currentMonthKey();
}

export function setSelectedMonth(monthKey) {
    localStorage.setItem(MONTH_STORAGE_KEY, monthKey);
    const url = new URL(window.location.href);
    url.searchParams.set('month', monthKey);
    window.history.replaceState({}, '', url.toString());
}

export function renderFinanceSubnav(activeId) {
    return `
        <nav class="fin-subnav" aria-label="Contabilidad">
            ${FINANCE_SUBNAV.map((item) => `
                <a href="${item.href}?month=${encodeURIComponent(getSelectedMonth())}"
                   class="fin-subnav-item${item.id === activeId ? ' is-active' : ''}">
                    ${escapeHtml(item.label)}
                </a>
            `).join('')}
        </nav>
    `;
}

export function renderMonthSelector(monthKey) {
    const options = buildMonthOptions(monthKey, 10);
    return `
        <div class="fin-month-bar">
            <button type="button" class="admin-icon-btn" id="finMonthPrev" title="Mes anterior" aria-label="Mes anterior">
                <svg viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <label class="fin-month-select-wrap">
                <span class="fin-sr-only">Mes</span>
                <select id="finMonthSelect" class="fin-month-select" aria-label="Seleccionar mes">
                    ${options.map((o) => `
                        <option value="${o.key}" ${o.key === monthKey ? 'selected' : ''}>${escapeHtml(o.label)}</option>
                    `).join('')}
                </select>
            </label>
            <button type="button" class="admin-icon-btn" id="finMonthNext" title="Mes siguiente" aria-label="Mes siguiente">
                <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="admin-btn-secondary" id="finMonthToday">Mes actual</button>
        </div>
    `;
}

export function wireMonthSelector(onChange) {
    const select = document.getElementById('finMonthSelect');
    const emit = (key) => {
        setSelectedMonth(key);
        if (typeof onChange === 'function') onChange(key);
    };

    select?.addEventListener('change', () => emit(select.value));
    document.getElementById('finMonthPrev')?.addEventListener('click', () => {
        const next = shiftMonth(select.value, -1);
        select.value = next;
        if (![...select.options].some((o) => o.value === next)) {
            select.innerHTML = buildMonthOptions(next, 10)
                .map((o) => `<option value="${o.key}" ${o.key === next ? 'selected' : ''}>${escapeHtml(o.label)}</option>`)
                .join('');
        }
        emit(next);
    });
    document.getElementById('finMonthNext')?.addEventListener('click', () => {
        const next = shiftMonth(select.value, 1);
        select.value = next;
        if (![...select.options].some((o) => o.value === next)) {
            select.innerHTML = buildMonthOptions(next, 10)
                .map((o) => `<option value="${o.key}" ${o.key === next ? 'selected' : ''}>${escapeHtml(o.label)}</option>`)
                .join('');
        }
        emit(next);
    });
    document.getElementById('finMonthToday')?.addEventListener('click', () => {
        const now = currentMonthKey();
        select.value = now;
        emit(now);
    });
}

export function ensureHelpDrawer() {
    if (document.getElementById('finHelpDrawer')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
        <div class="fin-help-backdrop" id="finHelpBackdrop" hidden></div>
        <aside class="fin-help-drawer" id="finHelpDrawer" aria-hidden="true">
            <div class="fin-help-drawer-head">
                <div>
                    <span class="fin-help-kicker">Ayuda financiera</span>
                    <h2 id="finHelpTitle">—</h2>
                </div>
                <button type="button" class="admin-modal-close" id="finHelpClose" aria-label="Cerrar">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                </button>
            </div>
            <div class="fin-help-drawer-body" id="finHelpBody"></div>
        </aside>
    `;
    document.body.appendChild(wrap);

    const close = () => closeHelpDrawer();
    document.getElementById('finHelpClose')?.addEventListener('click', close);
    document.getElementById('finHelpBackdrop')?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });
}

export function openHelpDrawer(widgetKey) {
    ensureHelpDrawer();
    const help = FINANCE_HELP[widgetKey];
    const drawer = document.getElementById('finHelpDrawer');
    const backdrop = document.getElementById('finHelpBackdrop');
    const title = document.getElementById('finHelpTitle');
    const body = document.getElementById('finHelpBody');
    if (!help || !drawer || !body) return;

    title.textContent = help.title;
    body.innerHTML = `
        <section class="fin-help-block">
            <h3>Qué significa</h3>
            <p>${escapeHtml(help.meaning)}</p>
        </section>
        <section class="fin-help-block">
            <h3>Cómo se calcula</h3>
            <p>${escapeHtml(help.how)}</p>
        </section>
        <section class="fin-help-block">
            <h3>Qué afecta este indicador</h3>
            <ul>${(help.affects || ['Los ingresos y gastos registrados en el mes seleccionado.']).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </section>
        <section class="fin-help-block">
            <h3>Para qué sirve</h3>
            <p>${escapeHtml(help.why)}</p>
        </section>
        <section class="fin-help-block">
            <h3>Cómo mejorarlo</h3>
            <ul>${(help.improve || ['Registra movimientos con disciplina y revisa categorías cada mes.']).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </section>
        <section class="fin-help-block">
            <h3>Ejemplo real</h3>
            <p>${escapeHtml(help.example)}</p>
        </section>
        <section class="fin-help-block">
            <h3>Consejos</h3>
            <ul>${(help.tips || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </section>
        <section class="fin-help-block">
            <h3>Errores comunes</h3>
            <ul>${(help.mistakes || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </section>
    `;

    backdrop.hidden = false;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
}

export function closeHelpDrawer() {
    const drawer = document.getElementById('finHelpDrawer');
    const backdrop = document.getElementById('finHelpBackdrop');
    if (drawer) {
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) backdrop.hidden = true;
}

export function renderFinancePageHeader({ title, subtitle, monthKey, showMonth = true }) {
    return `
        <div class="fin-page-header">
            <div class="fin-page-heading">
                <span class="fin-kicker">ERP Financiero</span>
                <h1>${escapeHtml(title)}</h1>
                ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
            </div>
            ${showMonth ? `
                <div class="fin-page-header-right">
                    <span class="fin-month-chip">${escapeHtml(formatMonthLabel(monthKey))}</span>
                    ${renderMonthSelector(monthKey)}
                </div>
            ` : ''}
        </div>
    `;
}

export { formatMonthLabel };
