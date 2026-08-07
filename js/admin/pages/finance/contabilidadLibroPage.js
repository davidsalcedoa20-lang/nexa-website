/* ==========================================================
   NEXA HUB — Contabilidad V2: detalle de un libro
   ========================================================== */
import { listProjects } from '../../../services/projectService.js';
import {
    getFinanceBook,
    getBookSummary,
    saveBookDashboardLayout,
    listIncomes,
    createIncome,
    updateIncome,
    deleteIncome,
    listExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    listFixedPayments,
    createFixedPayment,
    updateFixedPayment,
    deleteFixedPayment,
    listSalaryEmployees,
    createSalaryEmployee,
    updateSalaryEmployee,
    deleteSalaryEmployee,
    listPartners,
    createPartner,
    updatePartner,
    deletePartner,
    listPartnerPayments,
    registerPartnerLiquidation,
    listLoans,
    createLoan,
    updateLoan,
    deleteLoan,
    listFinanceCategories
} from '../../../services/financeService.js';
import {
    FINANCE_SECTIONS,
    LOAN_TYPE_LABELS,
    LOAN_STATUS_LABELS
} from '../../../components/finance/financeCatalog.js';
import {
    getSelectedMonth,
    setSelectedMonth,
    getBookIdFromUrl,
    getSectionFromUrl,
    renderBookSubnav,
    renderBookHeader,
    wireMonthSelector,
    ensureHelpDrawer,
    openHelpDrawer,
    bookSectionHref
} from '../../../components/finance/financeShell.js';
import {
    normalizeLayout,
    renderDashboardGrid,
    wireDashboardGrid
} from '../../../components/finance/financeDashboardGrid.js';
import {
    renderAssistantPanel,
    tipOfTheMonth
} from '../../../components/finance/financeAssistant.js';
import { formatMoney } from '../../../components/finance/financeFormat.js';
import { escapeHtml } from '../../../components/projectUi.js';

const root = document.getElementById('finRoot');
const bookId = getBookIdFromUrl();
let section = getSectionFromUrl('dashboard');
let monthKey = getSelectedMonth();
let book = null;
let summary = null;
let layout = [];
let editMode = false;
let categories = [];
let projects = [];
let rows = [];
let partnerPayments = [];
let loanTab = 'received';

const SECTION_META = {
    dashboard: { title: 'Dashboard', subtitle: 'Resumen financiero en tiempo real' },
    ingresos: { title: 'Ingresos', subtitle: 'Registra el dinero que entra.' },
    egresos: { title: 'Egresos', subtitle: 'Toda salida real de dinero. Solo aquí baja la Caja.' },
    fijos: { title: 'Gastos Fijos', subtitle: 'Presupuesto mensual. No descuenta la Caja automáticamente.' },
    empleados: { title: 'Empleados', subtitle: 'Sueldo fijo mensual. Sin porcentajes.' },
    socios: { title: 'Socios', subtitle: 'Reparto por porcentaje del dinero disponible.' },
    prestamos: { title: 'Préstamos', subtitle: 'Recibidos y otorgados, con progreso de cuotas.' },
    resumen: { title: 'Resumen', subtitle: 'Solo los indicadores que importan.' }
};

async function init() {
    if (!root) return;
    if (!bookId) {
        window.location.href = 'contabilidad.html';
        return;
    }
    if (!FINANCE_SECTIONS.some((s) => s.id === section)) section = 'dashboard';

    ensureHelpDrawer();
    setSelectedMonth(monthKey);
    root.innerHTML = '<p class="fin-loading">Abriendo finanzas…</p>';

    try {
        book = await getFinanceBook(bookId);
        layout = normalizeLayout(book.dashboard_layout);
        await loadSectionData();
        render();
    } catch (error) {
        console.error('[contabilidadLibro]', error);
        root.innerHTML = `
            <p class="fin-error">${escapeHtml(error.message)}</p>
            <a href="contabilidad.html" class="admin-btn-secondary">Volver</a>
        `;
    }
}

async function loadSectionData() {
    summary = await getBookSummary(bookId, monthKey);
    if (section === 'ingresos' || section === 'egresos') {
        categories = await listFinanceCategories(section === 'ingresos' ? 'income' : 'expense');
        if (section === 'ingresos') {
            projects = await listProjects({ includeArchived: false }).catch(() => []);
            rows = await listIncomes(bookId, { monthKey });
        } else {
            rows = await listExpenses(bookId, { monthKey });
        }
    } else if (section === 'fijos') {
        rows = await listFixedPayments(bookId, { includeEmployees: false });
    } else if (section === 'empleados') {
        rows = await listSalaryEmployees(bookId);
    } else if (section === 'socios') {
        rows = await listPartners(bookId);
        partnerPayments = [];
    } else if (section === 'prestamos') {
        rows = await listLoans(bookId);
    }
}

function money(n) {
    return formatMoney(n, { currency: book?.currency || 'COP' });
}

function render() {
    const meta = SECTION_META[section] || SECTION_META.dashboard;
    root.innerHTML = `
        ${renderBookSubnav(bookId, section, monthKey)}
        ${renderBookHeader({
            book,
            title: meta.title,
            subtitle: meta.subtitle,
            monthKey,
            showMonth: !['fijos', 'prestamos', 'empleados'].includes(section)
        })}
        <div class="fin-layout${section === 'dashboard' ? ' is-dashboard' : ''}">
            <div class="fin-layout-main" id="finSectionBody">${renderSectionBody()}</div>
            ${section === 'dashboard' ? '' : renderAssistantPanel(section)}
        </div>
        <div id="finModalHost"></div>
    `;

    wireMonthSelector(async (next) => {
        monthKey = next;
        root.innerHTML = '<p class="fin-loading">Actualizando…</p>';
        await loadSectionData();
        render();
    });

    wireSection();
}

function renderSectionBody() {
    switch (section) {
        case 'dashboard': return renderDashboard();
        case 'ingresos': return renderEntriesTable('income');
        case 'egresos': return renderEntriesTable('expense');
        case 'fijos': return renderFixed();
        case 'empleados': return renderEmployees();
        case 'socios': return renderSocios();
        case 'prestamos': return renderLoans();
        case 'resumen': return renderResumen();
        default: return '<p class="fin-empty">Sección no encontrada.</p>';
    }
}

/* ---------------- Dashboard (diseño oficial — clon visual) ---------------- */

function dashIcon(name) {
    const icons = {
        wallet: '<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="6" width="19" height="13.5" rx="2.8" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 10h19M15.5 14h3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
        income: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 15l5-5 3.2 3.2L20 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 5H20v5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        expense: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 9l5 5 3.2-3.2L20 19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 19H20v-5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        budget: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="15" rx="2.2" stroke="currentColor" stroke-width="1.6"/><path d="M8 3.5v3.5M16 3.5v3.5M3.5 10h17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8.5 14.2l2.2 2.2 4.3-4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        users: '<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.1" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="9.2" r="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M3.2 18.8c.7-2.7 2.8-4.2 5.8-4.2s5.1 1.5 5.8 4.2M14.2 18.8c.35-1.5 1.4-2.6 2.9-2.6 1.4 0 2.4.9 2.9 2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
        tip: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a6.2 6.2 0 0 0-3.6 11.1c.9.7 1.5 1.7 1.5 2.7h4.2c0-1 .6-2 1.5-2.7A6.2 6.2 0 0 0 12 3z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
        minus: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
    };
    return icons[name] || icons.wallet;
}

function smoothPath(points) {
    if (!points.length) return '';
    if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
    let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] || points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
}

function buildCashFlowSvg(income, expense, available, moneyFmt) {
    const w = 720;
    const h = 260;
    const pad = { t: 24, r: 20, b: 32, l: 44 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const maxV = Math.max(income, expense, Math.abs(available), 1) * 1.25;
    const n = 8;
    const series = (base, amp, phase) => Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        const wave = 0.72 + 0.28 * Math.sin((t * Math.PI * 1.7) + phase);
        const ramp = 0.42 + 0.58 * t;
        const v = Math.max(0, (base || maxV * 0.18) * ramp * (1 + amp * (wave - 1)));
        return [pad.l + t * iw, pad.t + ih - (Math.min(v, maxV) / maxV) * ih];
    });
    const incomePts = series(income, 0.12, 0.2);
    const expensePts = series(expense, 0.1, 1.4);
    const cashPts = series(Math.max(available, 0), 0.08, 2.2);
    const mid = 3;
    const tipX = incomePts[mid][0];
    const tipY = Math.min(incomePts[mid][1], expensePts[mid][1], cashPts[mid][1]) - 8;
    const labels = ['1', '5', '10', '15', '20', '25', '28', '30'];
    const dots = (pts, color) => pts.map((p) => `
        <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="#12141a" stroke="${color}" stroke-width="2"/>
    `).join('');

    return `
        <div class="ndx-chart-stage">
            <svg class="ndx-chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id="ndxIncFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#4ADE80" stop-opacity=".18"/>
                        <stop offset="100%" stop-color="#4ADE80" stop-opacity="0"/>
                    </linearGradient>
                    <filter id="ndxGlow"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                ${[0, 0.25, 0.5, 0.75, 1].map((g) => {
                    const y = pad.t + ih * (1 - g);
                    return `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="rgba(255,255,255,.06)" stroke-dasharray="4 6"/>`;
                }).join('')}
                <path d="${smoothPath(incomePts)} L${incomePts[n - 1][0]},${pad.t + ih} L${incomePts[0][0]},${pad.t + ih} Z" fill="url(#ndxIncFill)"/>
                <path d="${smoothPath(incomePts)}" fill="none" stroke="#4ADE80" stroke-width="2.6" stroke-linecap="round" filter="url(#ndxGlow)"/>
                <path d="${smoothPath(expensePts)}" fill="none" stroke="#FF6B81" stroke-width="2.6" stroke-linecap="round" filter="url(#ndxGlow)"/>
                <path d="${smoothPath(cashPts)}" fill="none" stroke="#8C52FF" stroke-width="2.6" stroke-linecap="round" filter="url(#ndxGlow)"/>
                ${dots(incomePts, '#4ADE80')}
                ${dots(expensePts, '#FF6B81')}
                ${dots(cashPts, '#8C52FF')}
                <line x1="${tipX}" y1="${pad.t}" x2="${tipX}" y2="${pad.t + ih}" stroke="rgba(255,255,255,.12)" stroke-dasharray="3 5"/>
                ${labels.map((lb, i) => {
                    const x = pad.l + (i / (n - 1)) * iw;
                    return `<text x="${x}" y="${h - 10}" text-anchor="middle" fill="rgba(255,255,255,.34)" font-size="11" font-family="Poppins,sans-serif">${lb}</text>`;
                }).join('')}
            </svg>
            <div class="ndx-chart-tooltip" style="left:${((tipX / w) * 100).toFixed(1)}%; top:${Math.max(8, (tipY / h) * 100 - 4).toFixed(1)}%">
                <strong>15 del mes</strong>
                <div><i class="dot tone-green"></i> Ingresos <b>${moneyFmt(income)}</b></div>
                <div><i class="dot tone-red"></i> Egresos <b>${moneyFmt(expense)}</b></div>
                <div><i class="dot tone-purple"></i> Caja <b>${moneyFmt(available)}</b></div>
            </div>
        </div>
    `;
}

function buildDonutSvg(segments) {
    const size = 168;
    const cx = 84;
    const cy = 84;
    const r = 58;
    const stroke = 22;
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const arcs = segments.map((seg) => {
        const len = (seg.value / total) * c;
        const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${stroke}"
            stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}"
            transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
        offset += len;
        return el;
    }).join('');
    return `
        <svg class="ndx-donut-svg" viewBox="0 0 ${size} ${size}" aria-hidden="true">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="${stroke}"/>
            ${arcs}
            <circle cx="${cx}" cy="${cy}" r="${r - stroke / 2 - 2}" fill="#15171c"/>
        </svg>
    `;
}

function buildRingSvg(pct) {
    const p = Math.max(0, Math.min(100, pct));
    const r = 46;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - p / 100);
    return `
        <svg class="ndx-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="12"/>
            <circle cx="60" cy="60" r="${r}" fill="none" stroke="#8C52FF" stroke-width="12"
                stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
                transform="rotate(-90 60 60)"/>
            <text x="60" y="56" text-anchor="middle" fill="#fff" font-size="22" font-weight="700" font-family="Poppins,sans-serif">${p}%</text>
            <text x="60" y="74" text-anchor="middle" fill="rgba(255,255,255,.45)" font-size="10" font-family="Poppins,sans-serif">Ahorro</text>
        </svg>
    `;
}

function renderDashboard() {
    const v = summary.values;
    const toShare = Math.max(0, v.available);
    const fixedItems = summary.fixedItems || [];
    const loans = summary.activeLoans || [];
    const employees = summary.salaryEmployees || [];
    const empCount = summary.counts.employees || 0;
    const partnerPct = summary.shares.reduce((s, r) => s + Number(r.percentage || 0), 0);
    const tipText = tipOfTheMonth(v);
    const catCount = (summary.counts.fixed || 0) + (Number(v.salary_total) > 0 ? 1 : 0);

    const budgetTotal = Number(v.fixed_total || 0);
    const budgetExecuted = Math.min(Number(v.expense_total || 0), budgetTotal || Number(v.expense_total || 0));
    const budgetPct = budgetTotal > 0
        ? Math.min(100, Math.round((budgetExecuted / budgetTotal) * 100))
        : 0;

    const budgetRows = [
        ...fixedItems.map((f) => ({ name: f.name, budgeted: Number(f.amount || 0) })),
        ...(Number(v.salary_total) > 0 ? [{ name: 'Sueldos', budgeted: Number(v.salary_total) }] : [])
    ].slice(0, 6);

    const distParts = [
        ...(Number(v.salary_total) > 0 ? [{ name: 'Sueldos', value: Number(v.salary_total), color: '#8C52FF' }] : []),
        ...fixedItems.slice(0, 4).map((f, i) => ({
            name: f.name,
            value: Number(f.amount || 0),
            color: ['#2D8CFF', '#22D3EE', '#FF8A3D', '#6B7280'][i % 4]
        }))
    ].filter((x) => x.value > 0);
    if (!distParts.length) distParts.push({ name: 'Sin datos', value: 1, color: '#3a3a3a' });
    const distTotal = distParts.reduce((s, x) => s + x.value, 0) || 1;

    const savingsPct = Number(v.income_total) > 0
        ? Math.max(0, Math.min(100, Math.round((toShare / Number(v.income_total)) * 100)))
        : 0;

    return `
        <div class="ndx-dash">
            <div class="ndx-dash-toolbar">
                <span></span>
                <button type="button" class="admin-btn-secondary ndx-customize-btn" id="finToggleEdit">
                    ${editMode ? 'Listo' : 'Personalizar'}
                </button>
            </div>

            <section class="ndx-kpi-row" aria-label="Indicadores">
                <article class="ndx-kpi">
                    <div class="ndx-kpi-top">
                        <span class="ndx-kpi-ico tone-green">${dashIcon('income')}</span>
                        <button type="button" class="fin-help-btn" data-help="income_total">ⓘ</button>
                    </div>
                    <span class="ndx-kpi-label">Ingresos este mes</span>
                    <strong class="ndx-kpi-value">${money(v.income_total)}</strong>
                    <div class="ndx-kpi-meta">${summary.counts.incomes} registro${summary.counts.incomes === 1 ? '' : 's'}</div>
                    <div class="ndx-kpi-trend tone-green">↑ vs mes anterior</div>
                </article>
                <article class="ndx-kpi">
                    <div class="ndx-kpi-top">
                        <span class="ndx-kpi-ico tone-red">${dashIcon('expense')}</span>
                        <button type="button" class="fin-help-btn" data-help="expense_total">ⓘ</button>
                    </div>
                    <span class="ndx-kpi-label">Egresos este mes</span>
                    <strong class="ndx-kpi-value">${money(v.expense_total)}</strong>
                    <div class="ndx-kpi-meta">${summary.counts.expenses} registro${summary.counts.expenses === 1 ? '' : 's'}</div>
                    <div class="ndx-kpi-trend tone-red">↑ salidas del mes</div>
                </article>
                <article class="ndx-kpi">
                    <div class="ndx-kpi-top">
                        <span class="ndx-kpi-ico tone-purple">${dashIcon('wallet')}</span>
                        <button type="button" class="fin-help-btn" data-help="available">ⓘ</button>
                    </div>
                    <span class="ndx-kpi-label">Caja disponible</span>
                    <strong class="ndx-kpi-value ${v.available < 0 ? 'is-neg' : ''}">${money(v.available)}</strong>
                    <div class="ndx-kpi-meta">Disponible para usar</div>
                    <div class="ndx-kpi-trend tone-green">→ Ingresos − Egresos</div>
                </article>
                <article class="ndx-kpi">
                    <div class="ndx-kpi-top">
                        <span class="ndx-kpi-ico tone-orange">${dashIcon('budget')}</span>
                        <button type="button" class="fin-help-btn" data-help="fixed_total">ⓘ</button>
                    </div>
                    <span class="ndx-kpi-label">Presupuesto fijo</span>
                    <strong class="ndx-kpi-value">${money(v.fixed_total)}</strong>
                    <div class="ndx-kpi-meta">Costo mensual fijo</div>
                    <div class="ndx-kpi-trend tone-orange">${catCount} categorías</div>
                </article>
                <article class="ndx-kpi">
                    <div class="ndx-kpi-top">
                        <span class="ndx-kpi-ico tone-blue">${dashIcon('users')}</span>
                        <button type="button" class="fin-help-btn" data-help="distributed">ⓘ</button>
                    </div>
                    <span class="ndx-kpi-label">Reparto a socios</span>
                    <strong class="ndx-kpi-value">${money(v.distributed)}</strong>
                    <div class="ndx-kpi-meta">Este mes</div>
                    <div class="ndx-kpi-trend tone-blue">${partnerPct}% distribuido</div>
                </article>
            </section>

            <section class="ndx-row-2">
                <article class="ndx-card ndx-cashflow">
                    <div class="ndx-card-head">
                        <div>
                            <h3>Flujo de Caja</h3>
                            <div class="ndx-legend">
                                <span><i class="dot tone-green"></i> Ingresos</span>
                                <span><i class="dot tone-red"></i> Egresos</span>
                                <span><i class="dot tone-purple"></i> Caja disponible</span>
                            </div>
                        </div>
                        <span class="ndx-chip">${escapeHtml(summary.monthLabel || 'Este mes')}</span>
                    </div>
                    ${buildCashFlowSvg(Number(v.income_total || 0), Number(v.expense_total || 0), Number(v.available || 0), money)}
                </article>

                <article class="ndx-card ndx-loans">
                    <div class="ndx-card-head">
                        <h3>Préstamos activos</h3>
                        <a class="ndx-link" href="${bookSectionHref(bookId, 'prestamos', monthKey)}">Ver todos</a>
                    </div>
                    ${loans.length ? `
                        <div class="ndx-loan-list">
                            ${loans.map((l) => {
                                const paidN = Number(l.paid_installments || 0);
                                const totalN = Math.max(1, Number(l.installments || 1));
                                const pct = Number(l.progress_pct ?? Math.min(100, Math.round((paidN / totalN) * 100)));
                                const isGranted = l.loan_type === 'granted';
                                return `
                                    <div class="ndx-loan-item">
                                        <div class="ndx-loan-main">
                                            <div class="ndx-loan-left">
                                                <strong>${escapeHtml(l.counterparty)}</strong>
                                                <div class="ndx-bar tone-orange-bar"><i style="width:${pct}%"></i></div>
                                                <span>${paidN}/${totalN} cuotas</span>
                                            </div>
                                            <div class="ndx-loan-right">
                                                <b>${money(l.principal)}</b>
                                                <span class="ndx-pill ${isGranted ? 'pill-orange' : 'pill-green'}">${escapeHtml(isGranted ? 'Otorgado' : 'Recibido')}</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : `<p class="fin-muted">No hay préstamos activos.</p>`}
                </article>

                <article class="ndx-card ndx-actions">
                    <div class="ndx-card-head"><h3>Acciones rápidas</h3></div>
                    <div class="ndx-qa-stack">
                        <a class="ndx-qa tone-income" href="${bookSectionHref(bookId, 'ingresos', monthKey)}"><span>${dashIcon('plus')}</span> Nuevo ingreso</a>
                        <a class="ndx-qa tone-expense" href="${bookSectionHref(bookId, 'egresos', monthKey)}"><span>${dashIcon('minus')}</span> Nuevo egreso</a>
                        <a class="ndx-qa tone-fixed" href="${bookSectionHref(bookId, 'fijos', monthKey)}"><span>${dashIcon('plus')}</span> Gasto fijo</a>
                        <a class="ndx-qa tone-loan" href="${bookSectionHref(bookId, 'prestamos', monthKey)}"><span>${dashIcon('plus')}</span> Nuevo préstamo</a>
                        <a class="ndx-qa tone-emp" href="${bookSectionHref(bookId, 'empleados', monthKey)}"><span>${dashIcon('plus')}</span> Nuevo empleado</a>
                        <a class="ndx-qa tone-partner" href="${bookSectionHref(bookId, 'socios', monthKey)}"><span>${dashIcon('plus')}</span> Nuevo socio</a>
                    </div>
                </article>
            </section>

            <section class="ndx-row-3">
                <article class="ndx-card ndx-budget">
                    <div class="ndx-card-head">
                        <h3>Presupuesto fijo mensual</h3>
                    </div>
                    <div class="ndx-budget-top">
                        <div>
                            <span>Total mensual</span>
                            <strong>${money(budgetTotal)}</strong>
                        </div>
                        <div>
                            <span>Ejecutado</span>
                            <strong>${money(budgetExecuted)}</strong>
                        </div>
                        <div class="ndx-budget-pct"><strong>${budgetPct}%</strong></div>
                    </div>
                    <div class="ndx-bar ndx-bar-lg tone-orange-bar"><i style="width:${budgetPct}%"></i></div>
                    <div class="ndx-budget-table">
                        <div class="ndx-budget-thead">
                            <span>Categoría</span><span>Presupuestado</span><span>Ejecutado</span><span>Estado</span>
                        </div>
                        ${budgetRows.length ? budgetRows.map((row) => {
                            const share = budgetTotal > 0 ? row.budgeted / budgetTotal : 0;
                            const executed = Math.round(budgetExecuted * share);
                            const rowPct = row.budgeted > 0
                                ? Math.min(100, Math.round((executed / row.budgeted) * 100))
                                : 0;
                            return `
                                <div class="ndx-budget-row">
                                    <span>${escapeHtml(row.name)}</span>
                                    <b>${money(row.budgeted)}</b>
                                    <b class="muted">${money(executed)}</b>
                                    <div class="ndx-budget-state">
                                        <div class="ndx-bar tone-orange-bar"><i style="width:${rowPct}%"></i></div>
                                        <em>${rowPct}%</em>
                                    </div>
                                </div>
                            `;
                        }).join('') : `<p class="fin-muted">Sin categorías de presupuesto.</p>`}
                    </div>
                    <a class="ndx-link tone-orange-link" href="${bookSectionHref(bookId, 'fijos', monthKey)}">Ver todas las categorías</a>
                </article>

                <article class="ndx-card ndx-emps">
                    <div class="ndx-card-head">
                        <h3>Resumen de empleados</h3>
                    </div>
                    <div class="ndx-emp-stats">
                        <div class="ndx-emp-stat">
                            <span class="ndx-kpi-ico tone-purple sm">${dashIcon('users')}</span>
                            <div><strong>${empCount}</strong><span>Empleados</span></div>
                        </div>
                        <div class="ndx-emp-stat">
                            <span class="ndx-kpi-ico tone-green sm">${dashIcon('wallet')}</span>
                            <div><strong>${money(v.salary_total || 0)}</strong><span>Sueldos mensuales</span></div>
                        </div>
                        <div class="ndx-emp-stat">
                            <span class="ndx-kpi-ico tone-blue sm">${dashIcon('budget')}</span>
                            <div><strong>${empCount}</strong><span>Activos este mes</span></div>
                        </div>
                    </div>
                    <div class="ndx-emp-list">
                        <div class="ndx-emp-thead">
                            <span>Lista de empleados</span>
                            <span>Sueldo mensual</span>
                        </div>
                        ${employees.length ? employees.map((e) => `
                            <div class="ndx-emp-row">
                                <div class="fin-share-person">
                                    <span class="fin-avatar">${escapeHtml((e.full_name || '?').slice(0, 1).toUpperCase())}</span>
                                    <div>
                                        <strong>${escapeHtml(e.full_name)}</strong>
                                        <span>${escapeHtml(e.job_title || 'Sin cargo')}</span>
                                    </div>
                                </div>
                                <div class="ndx-emp-right">
                                    <b>${money(e.salary)}</b>
                                    <span class="ndx-pill pill-green">${e.is_active ? 'Activo' : 'Inactivo'}</span>
                                </div>
                            </div>
                        `).join('') : `<p class="fin-muted">Sin empleados registrados.</p>`}
                    </div>
                    <a class="ndx-link" href="${bookSectionHref(bookId, 'empleados', monthKey)}">Ver todos los empleados</a>
                </article>

                <article class="ndx-card ndx-tip">
                    <div class="ndx-tip-head">
                        <span class="ndx-kpi-ico tone-orange">${dashIcon('tip')}</span>
                        <div>
                            <span class="ndx-kpi-label">Tip del mes</span>
                            <h3>Prioriza tu flujo</h3>
                        </div>
                    </div>
                    <p class="ndx-tip-text">${escapeHtml(tipText)}</p>
                    <div class="ndx-tip-art" aria-hidden="true">
                        <svg viewBox="0 0 240 120" fill="none">
                            <circle cx="42" cy="78" r="16" stroke="#8C52FF" stroke-width="1.5" opacity=".75"/>
                            <circle cx="58" cy="86" r="10" stroke="#C9A8FF" stroke-width="1.4" opacity=".55"/>
                            <rect x="88" y="34" width="58" height="40" rx="8" stroke="#8C52FF" stroke-width="1.5" opacity=".7"/>
                            <path d="M96 54h42M96 62h28" stroke="#C9A8FF" stroke-width="1.4" opacity=".6"/>
                            <path d="M160 88c20-34 40-34 60 0" stroke="#8C52FF" stroke-width="1.5" opacity=".55"/>
                            <path d="M172 70v28M184 58v40M196 64v34M208 50v48" stroke="#8C52FF" stroke-width="3.2" stroke-linecap="round" opacity=".5"/>
                            <circle cx="210" cy="28" r="10" stroke="#FF8A3D" stroke-width="1.4" opacity=".65"/>
                            <path d="M210 23v6M207 28h6" stroke="#FF8A3D" stroke-width="1.3" stroke-linecap="round"/>
                        </svg>
                    </div>
                </article>
            </section>

            <section class="ndx-row-4">
                <article class="ndx-card ndx-summary">
                    <div class="ndx-card-head"><h3>Resumen financiero del mes</h3></div>
                    <div class="ndx-summary-body">
                        <div class="ndx-summary-ring">
                            ${buildRingSvg(savingsPct)}
                            <div>
                                <span>Ahorro del mes</span>
                                <strong>${money(toShare)}</strong>
                            </div>
                        </div>
                        <div class="ndx-summary-metrics">
                            <div><span>Ingresos</span><b class="is-pos">${money(v.income_total)}</b></div>
                            <div><span>Egresos</span><b class="is-neg">${money(v.expense_total)}</b></div>
                            <div><span>Caja inicial</span><b>$ 0</b></div>
                            <div><span>Caja final</span><b class="tone-purple-txt">${money(v.available)}</b></div>
                        </div>
                    </div>
                </article>

                <article class="ndx-card ndx-dist">
                    <div class="ndx-card-head"><h3>Distribución de gastos</h3></div>
                    <div class="ndx-dist-body">
                        ${buildDonutSvg(distParts)}
                        <ul class="ndx-dist-legend">
                            ${distParts.map((p) => `
                                <li>
                                    <i style="background:${p.color}"></i>
                                    <span>${escapeHtml(p.name)}</span>
                                    <b>${Math.round((p.value / distTotal) * 100)}%</b>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                </article>
            </section>

            ${editMode ? `
                <div class="fin-customize-wrap">
                    <h3>Personalizar tarjetas</h3>
                    <p class="fin-muted">Arrastra, oculta o cambia el tamaño. Los cambios se guardan solos.</p>
                    ${renderDashboardGrid({
                        layout,
                        values: v,
                        currency: book.currency || 'COP',
                        editMode: true
                    })}
                </div>
            ` : ''}
        </div>
    `;
}

/* ---------------- Ingresos / Egresos ---------------- */

function renderEntriesTable(kind) {
    const isIncome = kind === 'income';
    return `
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">${rows.length} registro${rows.length === 1 ? '' : 's'} este mes</p>
            <button type="button" class="admin-btn-primary" id="finNewEntry">
                + ${isIncome ? 'Nuevo ingreso' : 'Nuevo egreso'}
            </button>
        </div>
        <div class="fin-table-wrap">
            <table class="fin-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th>Categoría</th>
                        ${isIncome ? '<th>Proyecto</th>' : ''}
                        <th>Valor</th>
                        <th>Observaciones</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length ? rows.map((r) => `
                        <tr>
                            <td>${escapeHtml(r.entry_date)}</td>
                            <td><strong>${escapeHtml(r.concept)}</strong></td>
                            <td>${escapeHtml(r.finance_categories?.name || '—')}</td>
                            ${isIncome ? `<td>${escapeHtml(r.projects?.name || '—')}</td>` : ''}
                            <td class="fin-num">${money(r.amount)}</td>
                            <td class="fin-notes">${escapeHtml(r.notes || '—')}</td>
                            <td class="fin-row-actions">
                                <button type="button" class="admin-btn-secondary" data-edit="${r.id}">Editar</button>
                                <button type="button" class="admin-icon-btn" data-del="${r.id}" title="Eliminar">✕</button>
                            </td>
                        </tr>
                    `).join('') : `<tr><td colspan="${isIncome ? 7 : 6}" class="fin-empty-cell">Aún no hay registros este mes.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;
}

function entryModalHtml(kind, row = null) {
    const isIncome = kind === 'income';
    const today = new Date().toISOString().slice(0, 10);
    return `
        <div class="admin-modal-overlay active" id="finEntryModal">
            <div class="admin-modal fin-entry-modal">
                <div class="admin-modal-header">
                    <h3>${row ? 'Editar' : 'Nuevo'} ${isIncome ? 'ingreso' : 'egreso'}</h3>
                    <button type="button" class="admin-modal-close" data-close-entry>✕</button>
                </div>
                <form id="finEntryForm" class="admin-form">
                    <div class="fin-form-grid">
                        <div class="admin-field">
                            <label>Fecha *</label>
                            <input type="date" name="entry_date" required value="${escapeHtml(row?.entry_date || today)}">
                        </div>
                        <div class="admin-field">
                            <label>Valor *</label>
                            <input type="number" name="amount" min="0" step="any" required value="${row ? Number(row.amount) : ''}" placeholder="0">
                        </div>
                        <div class="admin-field fin-span-2">
                            <label>Concepto *</label>
                            <input name="concept" required maxlength="160" value="${escapeHtml(row?.concept || '')}" placeholder="Ej. Pago cliente">
                        </div>
                        <div class="admin-field ${isIncome ? '' : 'fin-span-2'}">
                            <label>Categoría</label>
                            <select name="category_id" class="admin-select">
                                <option value="">Sin categoría</option>
                                ${categories.map((c) => `
                                    <option value="${c.id}" ${row?.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>
                                `).join('')}
                            </select>
                        </div>
                        ${isIncome ? `
                            <div class="admin-field">
                                <label>Proyecto (opcional)</label>
                                <select name="project_id" class="admin-select">
                                    <option value="">Ninguno</option>
                                    ${projects.map((p) => `
                                        <option value="${p.id}" ${row?.project_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>
                                    `).join('')}
                                </select>
                            </div>
                        ` : ''}
                        <div class="admin-field fin-span-2">
                            <label>Observaciones</label>
                            <textarea name="notes" rows="2" maxlength="500">${escapeHtml(row?.notes || '')}</textarea>
                        </div>
                    </div>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" data-close-entry>Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/* ---------------- Gastos fijos ---------------- */

function renderFixed() {
    const activeTotal = rows.filter((r) => r.is_active).reduce((s, r) => s + Number(r.amount || 0), 0);
    return `
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">
                Presupuesto operativo: <strong>${money(activeTotal)}</strong> / mes
                · No descuenta la Caja.
                <button type="button" class="fin-help-btn" data-help="fixed_total">ⓘ</button>
            </p>
            <button type="button" class="admin-btn-primary" id="finNewFixed">+ Nuevo gasto fijo</button>
        </div>
        <div class="fin-table-wrap">
            <table class="fin-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Valor</th>
                        <th>Día de pago</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length ? rows.map((r) => `
                        <tr>
                            <td><strong>${escapeHtml(r.name)}</strong></td>
                            <td class="fin-num">${money(r.amount)}</td>
                            <td>Día ${escapeHtml(String(r.payment_day || 1))}</td>
                            <td><span class="fin-status ${r.is_active ? 'status-confirmed' : 'status-draft'}">${r.is_active ? 'Activo' : 'Inactivo'}</span></td>
                            <td class="fin-row-actions">
                                <button type="button" class="admin-btn-secondary" data-edit="${r.id}">Editar</button>
                                <button type="button" class="admin-icon-btn" data-del="${r.id}" title="Eliminar">✕</button>
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="5" class="fin-empty-cell">Registra arriendo, internet, software, servicios…</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function fixedModalHtml(row = null) {
    return `
        <div class="admin-modal-overlay active" id="finFixedModal">
            <div class="admin-modal fin-entry-modal">
                <div class="admin-modal-header">
                    <h3>${row ? 'Editar' : 'Nuevo'} gasto fijo</h3>
                    <button type="button" class="admin-modal-close" data-close-fixed>✕</button>
                </div>
                <form id="finFixedForm" class="admin-form">
                    <div class="fin-form-grid">
                        <div class="admin-field fin-span-2">
                            <label>Nombre *</label>
                            <input name="name" required value="${escapeHtml(row?.name || '')}" placeholder="Ej. Arriendo">
                        </div>
                        <div class="admin-field">
                            <label>Valor *</label>
                            <input type="number" name="amount" min="0" step="any" required value="${row ? Number(row.amount) : ''}">
                        </div>
                        <div class="admin-field">
                            <label>Día de pago</label>
                            <input type="number" name="payment_day" min="1" max="31" value="${row?.payment_day || 1}">
                        </div>
                        <div class="admin-field fin-span-2">
                            <label>Estado</label>
                            <select name="is_active" class="admin-select">
                                <option value="1" ${row?.is_active !== false ? 'selected' : ''}>Activo</option>
                                <option value="0" ${row && !row.is_active ? 'selected' : ''}>Inactivo</option>
                            </select>
                        </div>
                    </div>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" data-close-fixed>Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/* ---------------- Empleados (sueldo fijo) ---------------- */

function renderEmployees() {
    const salaryTotal = rows.filter((e) => e.is_active).reduce((s, e) => s + Number(e.salary || 0), 0);
    return `
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">
                Nómina mensual: <strong>${money(salaryTotal)}</strong>
                · Forma parte del presupuesto fijo (no descuenta Caja sola).
            </p>
            <button type="button" class="admin-btn-primary" id="finNewEmployee">+ Nuevo empleado</button>
        </div>
        <div class="fin-table-wrap">
            <table class="fin-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Cargo</th>
                        <th>Sueldo mensual</th>
                        <th>Fecha de pago</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length ? rows.map((e) => `
                        <tr>
                            <td><strong>${escapeHtml(e.full_name)}</strong></td>
                            <td>${escapeHtml(e.job_title || '—')}</td>
                            <td class="fin-num">${money(e.salary)}</td>
                            <td>Día ${escapeHtml(String(e.payment_day || 1))}</td>
                            <td><span class="fin-status ${e.is_active ? 'status-confirmed' : 'status-draft'}">${e.is_active ? 'Activo' : 'Inactivo'}</span></td>
                            <td class="fin-row-actions">
                                <button type="button" class="admin-btn-secondary" data-edit="${e.id}">Editar</button>
                                <button type="button" class="admin-icon-btn" data-del="${e.id}" title="Eliminar">✕</button>
                            </td>
                        </tr>
                    `).join('') : '<tr><td colspan="6" class="fin-empty-cell">Agrega empleados con sueldo fijo. El porcentaje vive en Socios.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function employeeModalHtml(row = null) {
    return `
        <div class="admin-modal-overlay active" id="finEmpModal">
            <div class="admin-modal fin-entry-modal">
                <div class="admin-modal-header">
                    <h3>${row ? 'Editar' : 'Nuevo'} empleado</h3>
                    <button type="button" class="admin-modal-close" data-close-emp>✕</button>
                </div>
                <form id="finEmpForm" class="admin-form">
                    <div class="fin-form-grid">
                        <div class="admin-field fin-span-2">
                            <label>Nombre *</label>
                            <input name="full_name" required value="${escapeHtml(row?.full_name || '')}">
                        </div>
                        <div class="admin-field">
                            <label>Cargo</label>
                            <input name="job_title" value="${escapeHtml(row?.job_title || '')}" placeholder="Ej. Director de Edición">
                        </div>
                        <div class="admin-field">
                            <label>Sueldo mensual *</label>
                            <input type="number" name="salary" min="0" step="any" required value="${row ? Number(row.salary) : ''}">
                        </div>
                        <div class="admin-field">
                            <label>Fecha de pago (día)</label>
                            <input type="number" name="payment_day" min="1" max="31" value="${row?.payment_day || 30}">
                        </div>
                        <div class="admin-field">
                            <label>Estado</label>
                            <select name="is_active" class="admin-select">
                                <option value="1" ${row?.is_active !== false ? 'selected' : ''}>Activo</option>
                                <option value="0" ${row && !row.is_active ? 'selected' : ''}>Inactivo</option>
                            </select>
                        </div>
                    </div>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" data-close-emp>Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/* ---------------- Socios (porcentaje) ---------------- */

function renderSocios() {
    const pctSum = rows.filter((e) => e.is_active).reduce((s, e) => s + Number(e.percentage || 0), 0);
    return `
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">
                Disponible este mes: <strong>${money(summary.values.available)}</strong>
                · Porcentajes activos: <strong>${pctSum}%</strong>
                <button type="button" class="fin-help-btn" data-help="distributed">ⓘ</button>
            </p>
            <button type="button" class="admin-btn-primary" id="finNewPartner">+ Nuevo socio</button>
        </div>
        <div class="fin-table-wrap">
            <table class="fin-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Participación</th>
                        <th>Porcentaje</th>
                        <th>Fecha liquidación</th>
                        <th>Valor generado</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length ? rows.map((e) => {
                        const share = summary.shares.find((s) => s.id === e.id);
                        return `
                            <tr>
                                <td><strong>${escapeHtml(e.full_name)}</strong></td>
                                <td>${escapeHtml(e.participation || '—')}</td>
                                <td class="fin-num">${Number(e.percentage)}%</td>
                                <td>${e.settlement_day ? `Día ${escapeHtml(String(e.settlement_day))}` : '—'}</td>
                                <td class="fin-num">${e.is_active ? money(share?.amount || 0) : '—'}</td>
                                <td><span class="fin-status ${e.is_active ? 'status-confirmed' : 'status-draft'}">${e.is_active ? 'Activo' : 'Inactivo'}</span></td>
                                <td class="fin-row-actions">
                                    <button type="button" class="admin-btn-secondary" data-history="${e.id}">Historial</button>
                                    <button type="button" class="admin-btn-secondary" data-edit="${e.id}">Editar</button>
                                    <button type="button" class="admin-icon-btn" data-del="${e.id}" title="Eliminar">✕</button>
                                </td>
                            </tr>
                        `;
                    }).join('') : '<tr><td colspan="7" class="fin-empty-cell">Agrega socios y su porcentaje de participación.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function partnerModalHtml(row = null) {
    return `
        <div class="admin-modal-overlay active" id="finPartnerModal">
            <div class="admin-modal fin-entry-modal">
                <div class="admin-modal-header">
                    <h3>${row ? 'Editar' : 'Nuevo'} socio</h3>
                    <button type="button" class="admin-modal-close" data-close-partner>✕</button>
                </div>
                <form id="finPartnerForm" class="admin-form">
                    <div class="fin-form-grid">
                        <div class="admin-field fin-span-2">
                            <label>Nombre *</label>
                            <input name="full_name" required value="${escapeHtml(row?.full_name || '')}">
                        </div>
                        <div class="admin-field">
                            <label>Participación</label>
                            <input name="participation" value="${escapeHtml(row?.participation || '')}" placeholder="Ej. Socio fundador">
                        </div>
                        <div class="admin-field">
                            <label>Porcentaje *</label>
                            <input type="number" name="percentage" min="0" max="100" step="0.01" required value="${row ? Number(row.percentage) : ''}">
                        </div>
                        <div class="admin-field">
                            <label>Fecha de liquidación (día)</label>
                            <input type="number" name="settlement_day" min="1" max="31" value="${row?.settlement_day || ''}" placeholder="Opcional">
                        </div>
                        <div class="admin-field">
                            <label>Estado</label>
                            <select name="is_active" class="admin-select">
                                <option value="1" ${row?.is_active !== false ? 'selected' : ''}>Activo</option>
                                <option value="0" ${row && !row.is_active ? 'selected' : ''}>Inactivo</option>
                            </select>
                        </div>
                    </div>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" data-close-partner>Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function partnerHistoryModalHtml(partner, payments, suggestedAmount) {
    const today = new Date().toISOString().slice(0, 10);
    return `
        <div class="admin-modal-overlay active" id="finPartnerHistModal">
            <div class="admin-modal fin-entry-modal">
                <div class="admin-modal-header">
                    <h3>Historial — ${escapeHtml(partner.full_name)}</h3>
                    <button type="button" class="admin-modal-close" data-close-partner-hist>✕</button>
                </div>
                <div class="fin-partner-hist">
                    <p class="fin-muted">Valor generado este mes: <strong style="color:#fff">${money(suggestedAmount)}</strong></p>
                    <form id="finPartnerPayForm" class="admin-form" style="margin-bottom:16px">
                        <div class="fin-form-grid">
                            <div class="admin-field">
                                <label>Registrar liquidación</label>
                                <input type="number" name="amount" min="0" step="any" required value="${suggestedAmount > 0 ? suggestedAmount : ''}">
                            </div>
                            <div class="admin-field">
                                <label>Fecha</label>
                                <input type="date" name="entry_date" required value="${today}">
                            </div>
                        </div>
                        <button type="submit" class="admin-btn-primary">Registrar (crea egreso)</button>
                    </form>
                    <div class="fin-table-wrap" style="max-height:280px;overflow:auto">
                        <table class="fin-table">
                            <thead><tr><th>Fecha</th><th>Concepto</th><th>Valor</th></tr></thead>
                            <tbody>
                                ${payments.length ? payments.map((p) => `
                                    <tr>
                                        <td>${escapeHtml(p.entry_date)}</td>
                                        <td>${escapeHtml(p.concept)}</td>
                                        <td class="fin-num">${money(p.amount)}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="3" class="fin-empty-cell">Sin liquidaciones registradas.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/* ---------------- Préstamos ---------------- */

function renderLoanCard(l) {
    const st = l.computed_status || l.status;
    const paidN = Number(l.paid_installments || 0);
    const totalN = Math.max(1, Number(l.installments || 1));
    const pct = Number(l.progress_pct ?? Math.min(100, Math.round((paidN / totalN) * 100)));
    return `
        <article class="fin-loan-card">
            <div class="fin-loan-card-top">
                <div>
                    <strong>${escapeHtml(l.counterparty)}</strong>
                    <span class="fin-muted">${escapeHtml(l.start_date || '—')}</span>
                </div>
                <span class="fin-status status-${st === 'overdue' ? 'cancelled' : st}">${escapeHtml(LOAN_STATUS_LABELS[st] || st)}</span>
            </div>
            <div class="fin-loan-card-grid">
                <div><span>Monto</span><b>${money(l.principal)}</b></div>
                <div><span>Valor cuota</span><b>${money(l.installment_amount)}</b></div>
                <div><span>Abonado</span><b>${money(l.paid_amount)}</b></div>
                <div><span>Saldo</span><b>${money(l.remaining_balance)}</b></div>
            </div>
            <div class="fin-cuota-progress">
                <div class="fin-cuota-labels">
                    <span>Cuotas pagadas</span>
                    <strong>${paidN}/${totalN}</strong>
                </div>
                <div class="fin-progress fin-progress-lg"><i style="width:${pct}%"></i></div>
            </div>
            ${l.notes ? `<p class="fin-loan-notes">${escapeHtml(l.notes)}</p>` : ''}
            <div class="fin-row-actions" style="margin-top:10px">
                <button type="button" class="admin-btn-secondary" data-edit="${l.id}">Editar</button>
                <button type="button" class="admin-icon-btn" data-del="${l.id}" title="Eliminar">✕</button>
            </div>
        </article>
    `;
}

function renderLoans() {
    const received = rows.filter((l) => l.loan_type === 'received');
    const granted = rows.filter((l) => l.loan_type === 'granted');
    const list = loanTab === 'granted' ? granted : received;
    const pending = loanTab === 'granted'
        ? summary.values.pending_granted_balance
        : summary.values.pending_received_balance;

    return `
        <div class="fin-toolbar">
            <div class="fin-loan-tabs" role="tablist">
                <button type="button" class="fin-loan-tab ${loanTab === 'received' ? 'is-active' : ''}" data-loan-tab="received">
                    Préstamos recibidos (${received.length})
                </button>
                <button type="button" class="fin-loan-tab ${loanTab === 'granted' ? 'is-active' : ''}" data-loan-tab="granted">
                    Préstamos otorgados (${granted.length})
                </button>
            </div>
            <button type="button" class="admin-btn-primary" id="finNewLoan">+ Nuevo préstamo</button>
        </div>
        <p class="fin-toolbar-note" style="margin-top:0">
            Pendiente en esta sección: <strong>${money(pending || 0)}</strong>
            <button type="button" class="fin-help-btn" data-help="pending_loan_balance">ⓘ</button>
        </p>
        <div class="fin-loan-grid">
            ${list.length
                ? list.map(renderLoanCard).join('')
                : `<p class="fin-empty">No hay préstamos ${loanTab === 'granted' ? 'otorgados' : 'recibidos'}.</p>`}
        </div>
    `;
}

function loanModalHtml(row = null) {
    const today = new Date().toISOString().slice(0, 10);
    const defaultType = row?.loan_type || loanTab || 'received';
    return `
        <div class="admin-modal-overlay active" id="finLoanModal">
            <div class="admin-modal fin-entry-modal">
                <div class="admin-modal-header">
                    <h3>${row ? 'Editar' : 'Nuevo'} préstamo</h3>
                    <button type="button" class="admin-modal-close" data-close-loan>✕</button>
                </div>
                <form id="finLoanForm" class="admin-form">
                    <div class="fin-form-grid">
                        <div class="admin-field">
                            <label>Tipo</label>
                            <select name="loan_type" class="admin-select">
                                <option value="received" ${defaultType !== 'granted' ? 'selected' : ''}>Préstamo recibido</option>
                                <option value="granted" ${defaultType === 'granted' ? 'selected' : ''}>Préstamo otorgado</option>
                            </select>
                        </div>
                        <div class="admin-field">
                            <label>Fecha *</label>
                            <input type="date" name="start_date" required value="${escapeHtml(row?.start_date || today)}">
                        </div>
                        <div class="admin-field fin-span-2">
                            <label>Persona *</label>
                            <input name="counterparty" required value="${escapeHtml(row?.counterparty || '')}">
                        </div>
                        <div class="admin-field">
                            <label>Monto *</label>
                            <input type="number" name="principal" min="0" step="any" required value="${row ? Number(row.principal) : ''}">
                        </div>
                        <div class="admin-field">
                            <label>Abonado</label>
                            <input type="number" name="paid_amount" min="0" step="any" value="${row ? Number(row.paid_amount || 0) : 0}">
                        </div>
                        <div class="admin-field">
                            <label>Número de cuotas</label>
                            <input type="number" name="installments" min="1" value="${row?.installments || 1}">
                        </div>
                        <div class="admin-field">
                            <label>Valor cuota</label>
                            <input type="number" name="installment_amount" min="0" step="any" value="${row ? Number(row.installment_amount || 0) : ''}" placeholder="Auto si lo dejas vacío">
                        </div>
                        <div class="admin-field">
                            <label>Próxima cuota</label>
                            <input type="date" name="next_due_date" value="${escapeHtml(row?.next_due_date || '')}">
                        </div>
                        <div class="admin-field">
                            <label>Estado</label>
                            <select name="status" class="admin-select">
                                <option value="pending" ${!row || row.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                                <option value="paid" ${row?.status === 'paid' ? 'selected' : ''}>Pagado</option>
                                <option value="overdue" ${row?.status === 'overdue' ? 'selected' : ''}>Vencido</option>
                            </select>
                        </div>
                        <div class="admin-field fin-span-2">
                            <label>Observaciones</label>
                            <textarea name="notes" rows="2" maxlength="500">${escapeHtml(row?.notes || '')}</textarea>
                        </div>
                    </div>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" data-close-loan>Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/* ---------------- Resumen ---------------- */

function renderResumen() {
    const v = summary.values;
    const cards = [
        { key: 'income_total', label: 'Ingresos', value: money(v.income_total) },
        { key: 'expense_total', label: 'Egresos', value: money(v.expense_total) },
        { key: 'available', label: 'Caja disponible', value: money(v.available) },
        { key: 'fixed_total', label: 'Presupuesto fijo', value: money(v.fixed_total) },
        { key: 'distributed', label: 'Reparto socios', value: money(v.distributed) },
        { key: 'pending_loan_balance', label: 'Pendiente préstamos', value: money(v.pending_loan_balance) },
        { key: 'pending_loans', label: 'Préstamos activos', value: String(v.pending_loans) }
    ];
    return `
        <div class="fin-resumen-grid">
            ${cards.map((c) => `
                <article class="fin-resumen-card">
                    <div class="fin-kpi-top">
                        <span class="fin-kpi-name">${escapeHtml(c.label)}</span>
                        <button type="button" class="fin-help-btn" data-help="${c.key}">ⓘ</button>
                    </div>
                    <strong class="fin-kpi-value">${escapeHtml(c.value)}</strong>
                </article>
            `).join('')}
        </div>
        ${summary.shares.length ? `
            <section class="fin-panel fin-shares-panel">
                <h3>Cómo se reparte entre socios este mes</h3>
                <div class="fin-shares-list">
                    ${summary.shares.map((s) => `
                        <div class="fin-share-row">
                            <div class="fin-share-person">
                                <span class="fin-avatar">${escapeHtml((s.name || '?').slice(0, 1).toUpperCase())}</span>
                                <div>
                                    <strong>${escapeHtml(s.name)}</strong>
                                    <span>${s.percentage}%</span>
                                </div>
                            </div>
                            <b>${money(s.amount)}</b>
                        </div>
                    `).join('')}
                </div>
            </section>
        ` : ''}
    `;
}

/* ---------------- Wiring ---------------- */

function wireSection() {
    document.querySelectorAll('[data-help]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openHelpDrawer(btn.getAttribute('data-help'));
        });
    });

    if (section === 'dashboard') {
        document.getElementById('finToggleEdit')?.addEventListener('click', () => {
            editMode = !editMode;
            render();
        });
        if (editMode) {
            wireDashboardGrid({
                getLayout: () => layout,
                setLayout: (next) => { layout = normalizeLayout(next); },
                onSave: async (next) => {
                    layout = normalizeLayout(next);
                    book = await saveBookDashboardLayout(bookId, layout);
                    render();
                },
                editMode: true
            });
        }
        return;
    }

    if (section === 'ingresos' || section === 'egresos') {
        const kind = section === 'ingresos' ? 'income' : 'expense';
        document.getElementById('finNewEntry')?.addEventListener('click', () => openEntryModal(kind, null));
        document.querySelectorAll('[data-edit]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const row = rows.find((r) => r.id === btn.getAttribute('data-edit'));
                openEntryModal(kind, row);
            });
        });
        document.querySelectorAll('[data-del]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!window.confirm('¿Eliminar este registro?')) return;
                const id = btn.getAttribute('data-del');
                if (kind === 'income') await deleteIncome(bookId, id);
                else await deleteExpense(bookId, id);
                await reloadAndRender();
            });
        });
        return;
    }

    if (section === 'fijos') {
        document.getElementById('finNewFixed')?.addEventListener('click', () => openFixedModal(null));
        document.querySelectorAll('[data-edit]').forEach((btn) => {
            btn.addEventListener('click', () => openFixedModal(rows.find((r) => r.id === btn.getAttribute('data-edit'))));
        });
        document.querySelectorAll('[data-del]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!window.confirm('¿Eliminar este gasto fijo?')) return;
                await deleteFixedPayment(bookId, btn.getAttribute('data-del'));
                await reloadAndRender();
            });
        });
        return;
    }

    if (section === 'empleados') {
        document.getElementById('finNewEmployee')?.addEventListener('click', () => openEmployeeModal(null));
        document.querySelectorAll('[data-edit]').forEach((btn) => {
            btn.addEventListener('click', () => openEmployeeModal(rows.find((r) => r.id === btn.getAttribute('data-edit'))));
        });
        document.querySelectorAll('[data-del]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!window.confirm('¿Eliminar este empleado?')) return;
                await deleteSalaryEmployee(bookId, btn.getAttribute('data-del'));
                await reloadAndRender();
            });
        });
        return;
    }

    if (section === 'socios') {
        document.getElementById('finNewPartner')?.addEventListener('click', () => openPartnerModal(null));
        document.querySelectorAll('[data-edit]').forEach((btn) => {
            btn.addEventListener('click', () => openPartnerModal(rows.find((r) => r.id === btn.getAttribute('data-edit'))));
        });
        document.querySelectorAll('[data-history]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const partner = rows.find((r) => r.id === btn.getAttribute('data-history'));
                if (!partner) return;
                await openPartnerHistory(partner);
            });
        });
        document.querySelectorAll('[data-del]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!window.confirm('¿Eliminar este socio?')) return;
                await deletePartner(bookId, btn.getAttribute('data-del'));
                await reloadAndRender();
            });
        });
        return;
    }

    if (section === 'prestamos') {
        document.querySelectorAll('[data-loan-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                loanTab = btn.getAttribute('data-loan-tab') || 'received';
                render();
            });
        });
        document.getElementById('finNewLoan')?.addEventListener('click', () => openLoanModal(null));
        document.querySelectorAll('[data-edit]').forEach((btn) => {
            btn.addEventListener('click', () => openLoanModal(rows.find((r) => r.id === btn.getAttribute('data-edit'))));
        });
        document.querySelectorAll('[data-del]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!window.confirm('¿Eliminar este préstamo?')) return;
                await deleteLoan(bookId, btn.getAttribute('data-del'));
                await reloadAndRender();
            });
        });
    }
}

async function reloadAndRender() {
    await loadSectionData();
    render();
}

function mountModal(html) {
    const host = document.getElementById('finModalHost');
    if (host) host.innerHTML = html;
}

function openEntryModal(kind, row) {
    mountModal(entryModalHtml(kind, row));
    const close = () => { document.getElementById('finModalHost').innerHTML = ''; };
    document.querySelectorAll('[data-close-entry]').forEach((b) => b.addEventListener('click', close));
    document.getElementById('finEntryForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
            entry_date: fd.get('entry_date'),
            concept: fd.get('concept'),
            category_id: fd.get('category_id') || null,
            project_id: fd.get('project_id') || null,
            amount: fd.get('amount'),
            notes: fd.get('notes'),
            currency: book.currency
        };
        try {
            if (kind === 'income') {
                if (row) await updateIncome(bookId, row.id, payload);
                else await createIncome(bookId, payload);
            } else {
                if (row) await updateExpense(bookId, row.id, payload);
                else await createExpense(bookId, payload);
            }
            close();
            await reloadAndRender();
        } catch (error) {
            alert(error.message);
        }
    });
}

function openFixedModal(row) {
    mountModal(fixedModalHtml(row));
    const close = () => { document.getElementById('finModalHost').innerHTML = ''; };
    document.querySelectorAll('[data-close-fixed]').forEach((b) => b.addEventListener('click', close));
    document.getElementById('finFixedForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
            name: fd.get('name'),
            amount: fd.get('amount'),
            payment_day: fd.get('payment_day'),
            is_active: fd.get('is_active') === '1'
        };
        try {
            if (row) await updateFixedPayment(bookId, row.id, payload);
            else await createFixedPayment(bookId, payload);
            close();
            await reloadAndRender();
        } catch (error) {
            alert(error.message);
        }
    });
}

function openEmployeeModal(row) {
    mountModal(employeeModalHtml(row));
    const close = () => { document.getElementById('finModalHost').innerHTML = ''; };
    document.querySelectorAll('[data-close-emp]').forEach((b) => b.addEventListener('click', close));
    document.getElementById('finEmpForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
            full_name: fd.get('full_name'),
            job_title: fd.get('job_title'),
            salary: fd.get('salary'),
            payment_day: fd.get('payment_day'),
            is_active: fd.get('is_active') === '1'
        };
        try {
            if (row) await updateSalaryEmployee(bookId, row.id, payload);
            else await createSalaryEmployee(bookId, payload);
            close();
            await reloadAndRender();
        } catch (error) {
            alert(error.message);
        }
    });
}

function openPartnerModal(row) {
    mountModal(partnerModalHtml(row));
    const close = () => { document.getElementById('finModalHost').innerHTML = ''; };
    document.querySelectorAll('[data-close-partner]').forEach((b) => b.addEventListener('click', close));
    document.getElementById('finPartnerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
            full_name: fd.get('full_name'),
            participation: fd.get('participation'),
            percentage: fd.get('percentage'),
            settlement_day: fd.get('settlement_day') || null,
            is_active: fd.get('is_active') === '1'
        };
        try {
            if (row) await updatePartner(bookId, row.id, payload);
            else await createPartner(bookId, payload);
            close();
            await reloadAndRender();
        } catch (error) {
            alert(error.message);
        }
    });
}

async function openPartnerHistory(partner) {
    const share = summary.shares.find((s) => s.id === partner.id);
    const payments = await listPartnerPayments(bookId, partner.id);
    mountModal(partnerHistoryModalHtml(partner, payments, Number(share?.amount || 0)));
    const close = () => { document.getElementById('finModalHost').innerHTML = ''; };
    document.querySelectorAll('[data-close-partner-hist]').forEach((b) => b.addEventListener('click', close));
    document.getElementById('finPartnerPayForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        try {
            await registerPartnerLiquidation(bookId, partner, {
                amount: fd.get('amount'),
                entry_date: fd.get('entry_date'),
                currency: book.currency
            });
            close();
            await reloadAndRender();
        } catch (error) {
            alert(error.message);
        }
    });
}

function openLoanModal(row) {
    mountModal(loanModalHtml(row));
    const close = () => { document.getElementById('finModalHost').innerHTML = ''; };
    document.querySelectorAll('[data-close-loan]').forEach((b) => b.addEventListener('click', close));
    document.getElementById('finLoanForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
            loan_type: fd.get('loan_type'),
            counterparty: fd.get('counterparty'),
            principal: fd.get('principal'),
            start_date: fd.get('start_date'),
            installments: fd.get('installments'),
            installment_amount: fd.get('installment_amount'),
            next_due_date: fd.get('next_due_date') || null,
            paid_amount: fd.get('paid_amount'),
            status: fd.get('status'),
            notes: fd.get('notes')
        };
        try {
            if (row) await updateLoan(bookId, row.id, payload);
            else await createLoan(bookId, payload);
            close();
            await reloadAndRender();
        } catch (error) {
            alert(error.message);
        }
    });
}

init();
