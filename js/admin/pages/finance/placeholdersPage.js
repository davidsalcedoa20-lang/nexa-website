/* ==========================================================
   NEXA HUB — Páginas placeholder ERP (Flujo / Indicadores / Reportes)
   ========================================================== */
import { ensureFinanceSettings, getMonthSummary } from '../../../services/financeService.js';
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
import { escapeHtml } from '../../../components/projectUi.js';

export async function mountFinancePlaceholderPage({
    activeId,
    title,
    subtitle,
    bodyHtml
}) {
    const root = document.getElementById('finRoot');
    if (!root) return;
    ensureHelpDrawer();
    let monthKey = getSelectedMonth();
    setSelectedMonth(monthKey);

    const paint = async () => {
        root.innerHTML = `
            ${renderFinanceSubnav(activeId)}
            ${renderFinancePageHeader({ title, subtitle, monthKey })}
            <section class="fin-panel">
                ${bodyHtml}
            </section>
        `;
        wireMonthSelector(async (next) => {
            monthKey = next;
            await paint();
        });
    };

    try {
        await ensureFinanceSettings();
        await paint();
    } catch (error) {
        root.innerHTML = `<p class="fin-error">${escapeHtml(error.message)}</p>`;
    }
}

export async function mountIndicadoresPage() {
    const root = document.getElementById('finRoot');
    if (!root) return;
    ensureHelpDrawer();
    let monthKey = getSelectedMonth();
    setSelectedMonth(monthKey);

    try {
        const settings = await ensureFinanceSettings();
        const summary = await getMonthSummary(monthKey);
        const layout = normalizeLayout(settings.dashboard_layout);

        const paint = async () => {
            const s = await getMonthSummary(monthKey);
            root.innerHTML = `
                ${renderFinanceSubnav('indicadores')}
                ${renderFinancePageHeader({
                    title: 'Indicadores',
                    subtitle: 'Tarjetas clave del periodo (estructura Fase 1)',
                    monthKey
                })}
                ${renderDashboardGrid({
                    layout,
                    values: s.values,
                    variations: s.variations,
                    currency: settings.currency,
                    locale: settings.locale,
                    editMode: false
                })}
            `;
            wireMonthSelector(async (next) => {
                monthKey = next;
                await paint();
            });
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
