/* ==========================================================
   NEXA HUB — ERP: gráficas SVG (sin dependencias)
   ========================================================== */
import { escapeHtml } from '../projectUi.js';
import { formatMoney } from './financeFormat.js';

const COLORS = ['#8C52FF', '#2D8CFF', '#4ADE80', '#FF8A3D', '#FF4D6A', '#FFC15F', '#5FA8FF', '#C9A8FF'];

export function renderChartsSection(chartData, { currency = 'COP', locale = 'es-CO' } = {}) {
    return `
        <section class="fin-charts" id="finCharts">
            <div class="fin-chart-card">
                <h3>Ingresos vs Gastos</h3>
                ${renderDualBars(chartData.incomeVsExpense, { currency, locale })}
            </div>
            <div class="fin-chart-card">
                <h3>Ingresos por categoría</h3>
                ${renderHorizontalBars(chartData.incomeByCategory, { currency, locale })}
            </div>
            <div class="fin-chart-card">
                <h3>Gastos por categoría</h3>
                ${renderHorizontalBars(chartData.expenseByCategory, { currency, locale })}
            </div>
            <div class="fin-chart-card">
                <h3>Ingresos por proyecto</h3>
                ${renderHorizontalBars(chartData.incomeByProject, { currency, locale })}
            </div>
            <div class="fin-chart-card">
                <h3>Ingresos por cliente</h3>
                ${renderHorizontalBars(chartData.incomeByClient, { currency, locale })}
            </div>
            <div class="fin-chart-card fin-chart-card--wide">
                <h3>Comparativo mensual</h3>
                ${renderMonthlyCompare(chartData.monthlyCompare, { currency, locale })}
            </div>
            <div class="fin-chart-card">
                <h3>Comparativo anual</h3>
                ${renderYearlyCompare(chartData.yearlyCompare, { currency, locale })}
            </div>
        </section>
    `;
}

function renderDualBars({ income = 0, expense = 0 }, opts) {
    const max = Math.max(income, expense, 1);
    return `
        <div class="fin-dual-bars">
            <div class="fin-dual-row">
                <span>Ingresos</span>
                <div class="fin-bar-track"><div class="fin-bar-fill is-income" style="width:${(income / max) * 100}%"></div></div>
                <strong>${escapeHtml(formatMoney(income, opts))}</strong>
            </div>
            <div class="fin-dual-row">
                <span>Gastos</span>
                <div class="fin-bar-track"><div class="fin-bar-fill is-expense" style="width:${(expense / max) * 100}%"></div></div>
                <strong>${escapeHtml(formatMoney(expense, opts))}</strong>
            </div>
        </div>
    `;
}

function renderHorizontalBars(items = [], opts) {
    if (!items.length) return '<p class="fin-muted">Sin datos en este periodo.</p>';
    const max = Math.max(...items.map((i) => i.value), 1);
    return `
        <div class="fin-hbar-list">
            ${items.slice(0, 8).map((item, idx) => `
                <div class="fin-hbar-row">
                    <span title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
                    <div class="fin-bar-track">
                        <div class="fin-bar-fill" style="width:${(item.value / max) * 100}%;background:${COLORS[idx % COLORS.length]}"></div>
                    </div>
                    <strong>${escapeHtml(formatMoney(item.value, opts))}</strong>
                </div>
            `).join('')}
        </div>
    `;
}

function renderMonthlyCompare(months = [], opts) {
    const max = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1);
    const labels = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    return `
        <div class="fin-month-compare">
            ${months.map((m, i) => `
                <div class="fin-month-col" title="${escapeHtml(m.label)}">
                    <div class="fin-month-col-bars">
                        <div class="fin-vbar is-income" style="height:${(m.income / max) * 100}%"></div>
                        <div class="fin-vbar is-expense" style="height:${(m.expense / max) * 100}%"></div>
                    </div>
                    <span>${labels[i]}</span>
                </div>
            `).join('')}
        </div>
        <div class="fin-chart-legend">
            <span class="is-income">Ingresos</span>
            <span class="is-expense">Gastos</span>
        </div>
    `;
}

function renderYearlyCompare(years = [], opts) {
    return `
        <div class="fin-year-compare">
            ${years.map((y) => `
                <div class="fin-year-card">
                    <strong>${escapeHtml(y.label)}</strong>
                    <div><span>Ingresos</span><b>${escapeHtml(formatMoney(y.income, opts))}</b></div>
                    <div><span>Gastos</span><b>${escapeHtml(formatMoney(y.expense, opts))}</b></div>
                    <div><span>Resultado</span><b>${escapeHtml(formatMoney(y.income - y.expense, opts))}</b></div>
                </div>
            `).join('')}
        </div>
    `;
}
