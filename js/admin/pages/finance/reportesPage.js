/* ==========================================================
   NEXA HUB — Reportes (exportación Fase 2)
   ========================================================== */
import {
    ensureFinanceSettings,
    listIncomes,
    listExpenses,
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
    renderGlobalSearchBar,
    wireGlobalSearch
} from '../../../components/finance/financeFilters.js';
import {
    exportIncomesCsv,
    exportIncomesExcel,
    exportExpensesCsv,
    exportExpensesExcel,
    exportTablePdf
} from '../../../components/finance/financeExport.js';
import { formatMonthLabel } from '../../../components/finance/financeFormat.js';
import { escapeHtml } from '../../../components/projectUi.js';

const root = document.getElementById('finRoot');

async function init() {
    if (!root) return;
    ensureHelpDrawer();
    let monthKey = getSelectedMonth();
    setSelectedMonth(monthKey);

    const paint = async () => {
        const settings = await ensureFinanceSettings();
        const [incomes, expenses] = await Promise.all([
            listIncomes({ monthKey }),
            listExpenses({ monthKey })
        ]);
        const currency = settings.currency || 'COP';
        const locale = settings.locale || 'es-CO';
        const label = formatMonthLabel(monthKey);

        root.innerHTML = `
            ${renderFinanceSubnav('reportes')}
            ${renderGlobalSearchBar()}
            ${renderFinancePageHeader({
                title: 'Reportes',
                subtitle: `Exportaciones del periodo · ${label}`,
                monthKey
            })}
            <div class="fin-report-grid">
                <article class="fin-report-card">
                    <div>
                        <strong>Ingresos CSV</strong>
                        <span>${incomes.length} filas</span>
                    </div>
                    <button type="button" class="admin-btn-secondary" id="repIncCsv">Exportar</button>
                </article>
                <article class="fin-report-card">
                    <div>
                        <strong>Ingresos Excel</strong>
                        <span>${incomes.length} filas</span>
                    </div>
                    <button type="button" class="admin-btn-secondary" id="repIncXls">Exportar</button>
                </article>
                <article class="fin-report-card">
                    <div>
                        <strong>Ingresos PDF</strong>
                        <span>${incomes.length} filas</span>
                    </div>
                    <button type="button" class="admin-btn-secondary" id="repIncPdf">Exportar</button>
                </article>
                <article class="fin-report-card">
                    <div>
                        <strong>Gastos CSV</strong>
                        <span>${expenses.length} filas</span>
                    </div>
                    <button type="button" class="admin-btn-secondary" id="repExpCsv">Exportar</button>
                </article>
                <article class="fin-report-card">
                    <div>
                        <strong>Gastos Excel</strong>
                        <span>${expenses.length} filas</span>
                    </div>
                    <button type="button" class="admin-btn-secondary" id="repExpXls">Exportar</button>
                </article>
                <article class="fin-report-card">
                    <div>
                        <strong>Gastos PDF</strong>
                        <span>${expenses.length} filas</span>
                    </div>
                    <button type="button" class="admin-btn-secondary" id="repExpPdf">Exportar</button>
                </article>
            </div>
            <section class="fin-panel">
                <h3>Comparativas</h3>
                <p class="fin-muted">Usa Indicadores para ver comparativo mensual y anual con datos reales. Las exportaciones de arriba usan el mes seleccionado.</p>
            </section>
        `;

        document.getElementById('repIncCsv')?.addEventListener('click', () => exportIncomesCsv(incomes, `ingresos-${monthKey}.csv`));
        document.getElementById('repIncXls')?.addEventListener('click', () => exportIncomesExcel(incomes, `ingresos-${monthKey}.xls`));
        document.getElementById('repIncPdf')?.addEventListener('click', () => exportTablePdf({ title: `Ingresos ${label}`, rows: incomes, kind: 'income', currency, locale }));
        document.getElementById('repExpCsv')?.addEventListener('click', () => exportExpensesCsv(expenses, `gastos-${monthKey}.csv`));
        document.getElementById('repExpXls')?.addEventListener('click', () => exportExpensesExcel(expenses, `gastos-${monthKey}.xls`));
        document.getElementById('repExpPdf')?.addEventListener('click', () => exportTablePdf({ title: `Gastos ${label}`, rows: expenses, kind: 'expense', currency, locale }));

        wireMonthSelector(async (next) => {
            monthKey = next;
            await paint();
        });
        wireGlobalSearch(searchFinance);
    };

    try {
        await paint();
    } catch (error) {
        root.innerHTML = `<p class="fin-error">${escapeHtml(error.message)}</p>`;
    }
}

init();
