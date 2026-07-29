/* ==========================================================
   NEXA HUB — Página: Contabilidad · Dashboard
   ========================================================== */
import {
    ensureFinanceSettings,
    getMonthSummary,
    saveDashboardLayout
} from '../../services/financeService.js';
import {
    getSelectedMonth,
    setSelectedMonth,
    renderFinanceSubnav,
    renderFinancePageHeader,
    wireMonthSelector,
    ensureHelpDrawer
} from '../../components/finance/financeShell.js';
import {
    normalizeLayout,
    renderDashboardGrid,
    wireDashboardGrid
} from '../../components/finance/financeDashboardGrid.js';
import { formatMonthLabel } from '../../components/finance/financeFormat.js';

const root = document.getElementById('finRoot');

let settings = null;
let layout = [];
let monthKey = getSelectedMonth();
let editMode = false;
let summary = { values: {}, variations: {} };

async function init() {
    if (!root) return;
    ensureHelpDrawer();
    setSelectedMonth(monthKey);
    root.innerHTML = '<p class="fin-loading">Cargando contabilidad…</p>';

    try {
        settings = await ensureFinanceSettings();
        layout = normalizeLayout(settings.dashboard_layout);
        summary = await getMonthSummary(monthKey);
        render();
    } catch (error) {
        console.error('[contabilidadDashboard]', error);
        root.innerHTML = `<p class="fin-error">No se pudo cargar el ERP: ${error.message}</p>`;
    }
}

function render() {
    const currency = settings?.currency || 'COP';
    const locale = settings?.locale || 'es-CO';

    root.innerHTML = `
        ${renderFinanceSubnav('dashboard')}
        ${renderFinancePageHeader({
            title: 'Contabilidad',
            subtitle: `Resumen financiero · ${formatMonthLabel(monthKey)}`,
            monthKey
        })}
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">Dashboard modular · arrastra, oculta y redimensiona tus indicadores.</p>
            <button type="button" class="admin-btn-secondary" id="finToggleEdit">
                ${editMode ? 'Listo' : 'Personalizar'}
            </button>
        </div>
        <section class="fin-summary-strip">
            <div>
                <span>Ingresos</span>
                <strong>${formatQuick(summary.values.income_month, currency, locale)}</strong>
            </div>
            <div>
                <span>Gastos</span>
                <strong>${formatQuick(summary.values.expense_month, currency, locale)}</strong>
            </div>
            <div>
                <span>Resultado</span>
                <strong>${formatQuick(summary.values.gross_profit, currency, locale)}</strong>
            </div>
        </section>
        ${renderDashboardGrid({
            layout,
            values: summary.values,
            variations: summary.variations,
            currency,
            locale,
            editMode
        })}
    `;

    wireMonthSelector(async (next) => {
        monthKey = next;
        summary = await getMonthSummary(monthKey);
        render();
    });

    document.getElementById('finToggleEdit')?.addEventListener('click', () => {
        editMode = !editMode;
        render();
    });

    wireDashboardGrid({
        getLayout: () => layout,
        setLayout: (next) => {
            layout = normalizeLayout(next);
        },
        editMode,
        onSave: async (nextLayout) => {
            layout = normalizeLayout(nextLayout);
            settings = await saveDashboardLayout(layout);
            layout = normalizeLayout(settings.dashboard_layout);
            render();
        }
    });
}

function formatQuick(value, currency, locale) {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            maximumFractionDigits: currency === 'COP' ? 0 : 2
        }).format(Number(value) || 0);
    } catch (_) {
        return String(value ?? 0);
    }
}

init();
