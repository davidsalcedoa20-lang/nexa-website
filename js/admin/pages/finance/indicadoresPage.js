/* ==========================================================
   NEXA HUB — Página: Indicadores + gráficas (Fase 2)
   ========================================================== */
import {
    ensureFinanceSettings,
    getMonthSummary,
    getFinanceChartData,
    searchFinance
} from '../../../services/financeService.js';
import {
    getSelectedMonth,
    setSelectedMonth,
    renderFinanceSubnav,
    renderFinancePageHeader,
    wireMonthSelector,
    ensureHelpDrawer
} from '../../../components/finance/financeShell.js';
import {
    normalizeLayout,
    renderDashboardGrid,
    wireDashboardGrid
} from '../../../components/finance/financeDashboardGrid.js';
import { renderChartsSection } from '../../../components/finance/financeCharts.js';
import {
    renderGlobalSearchBar,
    wireGlobalSearch
} from '../../../components/finance/financeFilters.js';
import { formatMoney } from '../../../components/finance/financeFormat.js';
import { escapeHtml } from '../../../components/projectUi.js';

const root = document.getElementById('finRoot');

async function mountIndicadoresPage() {
    if (!root) return;
    ensureHelpDrawer();
    let monthKey = getSelectedMonth();
    setSelectedMonth(monthKey);

    try {
        const settings = await ensureFinanceSettings();

        const paint = async () => {
            const [summary, charts] = await Promise.all([
                getMonthSummary(monthKey),
                getFinanceChartData(monthKey)
            ]);
            const layout = normalizeLayout(settings.dashboard_layout);
            const currency = settings.currency || 'COP';
            const locale = settings.locale || 'es-CO';

            root.innerHTML = `
                ${renderFinanceSubnav('indicadores')}
                ${renderGlobalSearchBar()}
                ${renderFinancePageHeader({
                    title: 'Indicadores',
                    subtitle: 'KPIs calculados automáticamente + gráficas dinámicas',
                    monthKey
                })}
                <section class="fin-summary-strip">
                    <div><span>Margen</span><strong>${summary.values.margin == null ? '—' : `${summary.values.margin.toFixed(1)}%`}</strong></div>
                    <div><span>Rentabilidad</span><strong>${summary.values.profitability == null ? '—' : `${summary.values.profitability.toFixed(1)}%`}</strong></div>
                    <div><span>Flujo de caja</span><strong>${escapeHtml(formatMoney(summary.values.cash_flow, { currency, locale }))}</strong></div>
                </section>
                ${renderDashboardGrid({
                    layout,
                    values: summary.values,
                    variations: summary.variations,
                    currency,
                    locale,
                    editMode: false
                })}
                ${renderChartsSection(charts, { currency, locale })}
            `;

            wireMonthSelector(async (next) => {
                monthKey = next;
                await paint();
            });
            wireGlobalSearch(searchFinance);
            wireDashboardGrid({
                getLayout: () => layout,
                setLayout: () => {},
                editMode: false
            });
        };

        await paint();
    } catch (error) {
        root.innerHTML = `<p class="fin-error">${escapeHtml(error.message)}</p>`;
    }
}

mountIndicadoresPage();
