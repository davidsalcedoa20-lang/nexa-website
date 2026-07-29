/* ==========================================================
   NEXA HUB — Página: Contabilidad · Gastos
   ========================================================== */
import {
    ensureFinanceSettings,
    listExpenses,
    createExpense,
    deleteExpense,
    listFinanceCategories,
    listPaymentMethods
} from '../../../services/financeService.js';
import {
    getSelectedMonth,
    setSelectedMonth,
    renderFinanceSubnav,
    renderFinancePageHeader,
    wireMonthSelector,
    ensureHelpDrawer
} from '../../../components/finance/financeShell.js';
import { formatMoney } from '../../../components/finance/financeFormat.js';
import { FINANCE_STATUS_LABELS } from '../../../components/finance/financeCatalog.js';
import { escapeHtml } from '../../../components/projectUi.js';

const root = document.getElementById('finRoot');
let monthKey = getSelectedMonth();
let settings = null;
let rows = [];
let categories = [];
let methods = [];

async function init() {
    if (!root) return;
    ensureHelpDrawer();
    setSelectedMonth(monthKey);
    root.innerHTML = '<p class="fin-loading">Cargando gastos…</p>';
    try {
        settings = await ensureFinanceSettings();
        [rows, categories, methods] = await Promise.all([
            listExpenses({ monthKey }),
            listFinanceCategories('expense'),
            listPaymentMethods()
        ]);
        render();
    } catch (error) {
        root.innerHTML = `<p class="fin-error">${escapeHtml(error.message)}</p>`;
    }
}

function render() {
    const currency = settings?.currency || 'COP';
    const locale = settings?.locale || 'es-CO';

    root.innerHTML = `
        ${renderFinanceSubnav('gastos')}
        ${renderFinancePageHeader({
            title: 'Gastos',
            subtitle: 'Registro de salidas del periodo',
            monthKey
        })}
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">${rows.length} registro${rows.length === 1 ? '' : 's'} este mes</p>
            <button type="button" class="admin-btn-primary" id="finNewExpense">+ Nuevo gasto</button>
        </div>
        <div class="fin-table-wrap">
            <table class="fin-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Concepto</th>
                        <th>Categoría</th>
                        <th>Valor</th>
                        <th>Método de pago</th>
                        <th>Estado</th>
                        <th>Observaciones</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length ? rows.map((r) => `
                        <tr>
                            <td>${escapeHtml(r.entry_date)}</td>
                            <td>${escapeHtml(r.vendor_name || '—')}</td>
                            <td><strong>${escapeHtml(r.concept)}</strong></td>
                            <td>${escapeHtml(r.finance_categories?.name || '—')}</td>
                            <td class="fin-num">${formatMoney(r.amount, { currency, locale })}</td>
                            <td>${escapeHtml(r.finance_payment_methods?.name || '—')}</td>
                            <td><span class="fin-status status-${r.status}">${FINANCE_STATUS_LABELS[r.status] || r.status}</span></td>
                            <td class="fin-notes">${escapeHtml(r.notes || '—')}</td>
                            <td><button type="button" class="admin-icon-btn" data-del-expense="${r.id}" title="Eliminar">✕</button></td>
                        </tr>
                    `).join('') : `
                        <tr><td colspan="9" class="fin-empty-cell">Sin gastos en este mes.</td></tr>
                    `}
                </tbody>
            </table>
        </div>

        <div class="admin-modal-overlay" id="finExpenseModal">
            <div class="admin-modal">
                <div class="admin-modal-header">
                    <h3>Nuevo gasto</h3>
                    <button type="button" class="admin-modal-close" id="finExpenseClose">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
                <form id="finExpenseForm" class="admin-form" novalidate>
                    <div class="admin-field">
                        <label for="finExpenseDate">Fecha</label>
                        <input type="date" id="finExpenseDate" required>
                    </div>
                    <div class="admin-field">
                        <label for="finExpenseVendor">Proveedor</label>
                        <input type="text" id="finExpenseVendor" placeholder="Ej. AWS, freelancer…">
                    </div>
                    <div class="admin-field">
                        <label for="finExpenseConcept">Concepto</label>
                        <input type="text" id="finExpenseConcept" required>
                    </div>
                    <div class="admin-field">
                        <label for="finExpenseCategory">Categoría</label>
                        <select id="finExpenseCategory">
                            <option value="">Sin categoría</option>
                            ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="admin-field">
                        <label for="finExpenseAmount">Valor</label>
                        <input type="number" id="finExpenseAmount" min="0" step="0.01" required>
                    </div>
                    <div class="admin-field">
                        <label for="finExpenseMethod">Método de pago</label>
                        <select id="finExpenseMethod">
                            <option value="">—</option>
                            ${methods.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="admin-field">
                        <label for="finExpenseNotes">Observaciones</label>
                        <textarea id="finExpenseNotes" rows="2"></textarea>
                    </div>
                    <span class="admin-form-error" id="finExpenseError"></span>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" id="finExpenseCancel">Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    wireMonthSelector(async (next) => {
        monthKey = next;
        rows = await listExpenses({ monthKey });
        render();
    });

    const modal = document.getElementById('finExpenseModal');
    const open = () => {
        const today = new Date();
        document.getElementById('finExpenseDate').value =
            `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        modal.classList.add('active');
    };
    const close = () => modal.classList.remove('active');

    document.getElementById('finNewExpense')?.addEventListener('click', open);
    document.getElementById('finExpenseClose')?.addEventListener('click', close);
    document.getElementById('finExpenseCancel')?.addEventListener('click', close);

    document.getElementById('finExpenseForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('finExpenseError');
        errorEl.classList.remove('active');
        try {
            await createExpense({
                entry_date: document.getElementById('finExpenseDate').value,
                vendor_name: document.getElementById('finExpenseVendor').value.trim() || null,
                concept: document.getElementById('finExpenseConcept').value.trim(),
                category_id: document.getElementById('finExpenseCategory').value || null,
                amount: Number(document.getElementById('finExpenseAmount').value),
                payment_method_id: document.getElementById('finExpenseMethod').value || null,
                notes: document.getElementById('finExpenseNotes').value.trim() || null,
                status: 'confirmed',
                currency: settings?.currency || 'COP'
            });
            close();
            rows = await listExpenses({ monthKey });
            render();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.classList.add('active');
        }
    });

    document.querySelectorAll('[data-del-expense]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!window.confirm('¿Eliminar este gasto?')) return;
            await deleteExpense(btn.getAttribute('data-del-expense'));
            rows = await listExpenses({ monthKey });
            render();
        });
    });
}

init();
