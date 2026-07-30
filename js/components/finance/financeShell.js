/* ==========================================================
   NEXA HUB — Contabilidad V2: shell UI
   ========================================================== */
import { FINANCE_SECTIONS, FINANCE_HELP } from './financeCatalog.js';
import {
    buildMonthOptions,
    currentMonthKey,
    formatMonthLabel,
    shiftMonth
} from './financeFormat.js';
import { escapeHtml } from '../projectUi.js';

const MONTH_KEY = 'nexa_finance_v2_month';

export function getSelectedMonth() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('month');
    if (fromUrl && /^\d{4}-\d{2}$/.test(fromUrl)) return fromUrl;
    const stored = localStorage.getItem(MONTH_KEY);
    if (stored && /^\d{4}-\d{2}$/.test(stored)) return stored;
    return currentMonthKey();
}

export function setSelectedMonth(monthKey) {
    localStorage.setItem(MONTH_KEY, monthKey);
    const url = new URL(window.location.href);
    url.searchParams.set('month', monthKey);
    window.history.replaceState({}, '', url.toString());
}

export function getBookIdFromUrl() {
    return new URLSearchParams(window.location.search).get('id');
}

export function getSectionFromUrl(fallback = 'dashboard') {
    return new URLSearchParams(window.location.search).get('s') || fallback;
}

export function bookSectionHref(bookId, section, monthKey = getSelectedMonth()) {
    return `contabilidad-libro.html?id=${encodeURIComponent(bookId)}&s=${encodeURIComponent(section)}&month=${encodeURIComponent(monthKey)}`;
}

export function renderBookSubnav(bookId, activeId, monthKey) {
    return `
        <nav class="fin-subnav" aria-label="Secciones de contabilidad">
            <a href="contabilidad.html" class="fin-subnav-item">← Mis Contabilidades</a>
            ${FINANCE_SECTIONS.map((item) => `
                <a href="${bookSectionHref(bookId, item.id, monthKey)}"
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
            <select id="finMonthSelect" class="fin-month-select" aria-label="Mes">
                ${options.map((o) => `
                    <option value="${o.key}" ${o.key === monthKey ? 'selected' : ''}>${escapeHtml(o.label)}</option>
                `).join('')}
            </select>
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
        onChange?.(key);
    };
    select?.addEventListener('change', () => emit(select.value));
    document.getElementById('finMonthPrev')?.addEventListener('click', () => {
        const next = shiftMonth(select.value, -1);
        if (![...select.options].some((o) => o.value === next)) {
            select.innerHTML = buildMonthOptions(next, 10)
                .map((o) => `<option value="${o.key}" ${o.key === next ? 'selected' : ''}>${escapeHtml(o.label)}</option>`)
                .join('');
        }
        select.value = next;
        emit(next);
    });
    document.getElementById('finMonthNext')?.addEventListener('click', () => {
        const next = shiftMonth(select.value, 1);
        if (![...select.options].some((o) => o.value === next)) {
            select.innerHTML = buildMonthOptions(next, 10)
                .map((o) => `<option value="${o.key}" ${o.key === next ? 'selected' : ''}>${escapeHtml(o.label)}</option>`)
                .join('');
        }
        select.value = next;
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
                    <span class="fin-help-kicker">¿Qué significa esto?</span>
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

export function openHelpDrawer(key) {
    ensureHelpDrawer();
    const help = FINANCE_HELP[key];
    if (!help) return;
    document.getElementById('finHelpTitle').textContent = help.title;
    document.getElementById('finHelpBody').innerHTML = `
        <section class="fin-help-block"><h3>Qué significa</h3><p>${escapeHtml(help.meaning)}</p></section>
        <section class="fin-help-block"><h3>Cómo se calcula</h3><p>${escapeHtml(help.how)}</p></section>
        <section class="fin-help-block"><h3>Ejemplo</h3><p>${escapeHtml(help.example)}</p></section>
        <section class="fin-help-block"><h3>Consejo</h3><p>${escapeHtml(help.tip || '')}</p></section>
    `;
    document.getElementById('finHelpBackdrop').hidden = false;
    document.getElementById('finHelpDrawer').classList.add('is-open');
    document.getElementById('finHelpDrawer').setAttribute('aria-hidden', 'false');
}

export function closeHelpDrawer() {
    document.getElementById('finHelpDrawer')?.classList.remove('is-open');
    document.getElementById('finHelpDrawer')?.setAttribute('aria-hidden', 'true');
    const backdrop = document.getElementById('finHelpBackdrop');
    if (backdrop) backdrop.hidden = true;
}

export function renderBookHeader({ book, title, subtitle, monthKey, showMonth = true }) {
    const color = book?.color_hex || '#8C52FF';
    return `
        <div class="fin-page-header">
            <div class="fin-page-heading">
                <span class="fin-kicker" style="color:${escapeHtml(color)}">${escapeHtml(book?.name || 'Contabilidad')}</span>
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

export { formatMonthLabel, escapeHtml };
