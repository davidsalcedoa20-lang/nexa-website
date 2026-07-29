/* ==========================================================
   NEXA HUB — Flujo de Caja (vista operativa Fase 2)
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
import { formatMoney } from '../../../components/finance/financeFormat.js';
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

        const movements = [
            ...incomes.filter((r) => ['confirmed', 'paid'].includes(r.status)).map((r) => ({
                date: r.entry_date,
                type: 'in',
                label: r.concept,
                amount: Number(r.amount || 0) + Number(r.tax_amount || 0)
            })),
            ...expenses.filter((r) => ['confirmed', 'paid'].includes(r.status)).map((r) => ({
                date: r.entry_date,
                type: 'out',
                label: r.concept,
                amount: Number(r.amount || 0) + Number(r.tax_amount || 0)
            }))
        ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

        const totalIn = movements.filter((m) => m.type === 'in').reduce((s, m) => s + m.amount, 0);
        const totalOut = movements.filter((m) => m.type === 'out').reduce((s, m) => s + m.amount, 0);

        root.innerHTML = `
            ${renderFinanceSubnav('flujo')}
            ${renderGlobalSearchBar()}
            ${renderFinancePageHeader({
                title: 'Flujo de Caja',
                subtitle: 'Entradas y salidas reales del periodo (valor + IVA)',
                monthKey
            })}
            <section class="fin-summary-strip">
                <div><span>Entradas</span><strong>${escapeHtml(formatMoney(totalIn, { currency, locale }))}</strong></div>
                <div><span>Salidas</span><strong>${escapeHtml(formatMoney(totalOut, { currency, locale }))}</strong></div>
                <div><span>Flujo neto</span><strong>${escapeHtml(formatMoney(totalIn - totalOut, { currency, locale }))}</strong></div>
            </section>
            <div class="fin-table-wrap">
                <table class="fin-table">
                    <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Monto</th></tr></thead>
                    <tbody>
                        ${movements.length ? movements.map((m) => `
                            <tr>
                                <td>${escapeHtml(m.date)}</td>
                                <td><span class="fin-status ${m.type === 'in' ? 'status-paid' : 'status-cancelled'}">${m.type === 'in' ? 'Entrada' : 'Salida'}</span></td>
                                <td>${escapeHtml(m.label)}</td>
                                <td class="fin-num">${formatMoney(m.amount, { currency, locale })}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" class="fin-empty-cell">Sin movimientos en este mes.</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

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
