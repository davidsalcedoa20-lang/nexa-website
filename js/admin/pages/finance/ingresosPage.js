/* ==========================================================
   NEXA HUB — Página: Contabilidad · Ingresos
   ========================================================== */
import { listProjects } from '../../../services/projectService.js';
import {
    ensureFinanceSettings,
    listIncomes,
    createIncome,
    deleteIncome,
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
let projects = [];

async function init() {
    if (!root) return;
    ensureHelpDrawer();
    setSelectedMonth(monthKey);
    root.innerHTML = '<p class="fin-loading">Cargando ingresos…</p>';
    try {
        settings = await ensureFinanceSettings();
        [rows, categories, methods, projects] = await Promise.all([
            listIncomes({ monthKey }),
            listFinanceCategories('income'),
            listPaymentMethods(),
            listProjects({ includeArchived: false }).catch(() => [])
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
        ${renderFinanceSubnav('ingresos')}
        ${renderFinancePageHeader({
            title: 'Ingresos',
            subtitle: 'Registro de entradas del periodo',
            monthKey
        })}
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">${rows.length} registro${rows.length === 1 ? '' : 's'} este mes</p>
            <button type="button" class="admin-btn-primary" id="finNewIncome">+ Nuevo ingreso</button>
        </div>
        <div class="fin-table-wrap">
            <table class="fin-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th>Cliente</th>
                        <th>Proyecto</th>
                        <th>Categoría</th>
                        <th>Valor</th>
                        <th>Estado</th>
                        <th>Observaciones</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length ? rows.map((r) => `
                        <tr>
                            <td>${escapeHtml(r.entry_date)}</td>
                            <td><strong>${escapeHtml(r.concept)}</strong></td>
                            <td>${escapeHtml(r.workspaces?.name || '—')}</td>
                            <td>${escapeHtml(r.projects?.name || '—')}</td>
                            <td>${escapeHtml(r.finance_categories?.name || '—')}</td>
                            <td class="fin-num">${formatMoney(r.amount, { currency, locale })}</td>
                            <td><span class="fin-status status-${r.status}">${FINANCE_STATUS_LABELS[r.status] || r.status}</span></td>
                            <td class="fin-notes">${escapeHtml(r.notes || '—')}</td>
                            <td><button type="button" class="admin-icon-btn" data-del-income="${r.id}" title="Eliminar">✕</button></td>
                        </tr>
                    `).join('') : `
                        <tr><td colspan="9" class="fin-empty-cell">Sin ingresos en este mes. Crea el primero.</td></tr>
                    `}
                </tbody>
            </table>
        </div>

        <div class="admin-modal-overlay" id="finIncomeModal">
            <div class="admin-modal">
                <div class="admin-modal-header">
                    <h3>Nuevo ingreso</h3>
                    <button type="button" class="admin-modal-close" id="finIncomeClose">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
                <form id="finIncomeForm" class="admin-form" novalidate>
                    <div class="admin-field">
                        <label for="finIncomeDate">Fecha</label>
                        <input type="date" id="finIncomeDate" required>
                    </div>
                    <div class="admin-field">
                        <label for="finIncomeConcept">Concepto</label>
                        <input type="text" id="finIncomeConcept" required placeholder="Ej. Pago proyecto web">
                    </div>
                    <div class="admin-field">
                        <label for="finIncomeProject">Proyecto</label>
                        <select id="finIncomeProject">
                            <option value="">Sin proyecto</option>
                            ${projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="admin-field">
                        <label for="finIncomeCategory">Categoría</label>
                        <select id="finIncomeCategory">
                            <option value="">Sin categoría</option>
                            ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="admin-field">
                        <label for="finIncomeAmount">Valor</label>
                        <input type="number" id="finIncomeAmount" min="0" step="0.01" required>
                    </div>
                    <div class="admin-field">
                        <label for="finIncomeStatus">Estado</label>
                        <select id="finIncomeStatus">
                            <option value="confirmed">Confirmado</option>
                            <option value="pending">Pendiente</option>
                            <option value="paid">Pagado</option>
                            <option value="draft">Borrador</option>
                        </select>
                    </div>
                    <div class="admin-field">
                        <label for="finIncomeMethod">Método de pago</label>
                        <select id="finIncomeMethod">
                            <option value="">—</option>
                            ${methods.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="admin-field">
                        <label for="finIncomeNotes">Observaciones</label>
                        <textarea id="finIncomeNotes" rows="2"></textarea>
                    </div>
                    <span class="admin-form-error" id="finIncomeError"></span>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" id="finIncomeCancel">Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    wireMonthSelector(async (next) => {
        monthKey = next;
        rows = await listIncomes({ monthKey });
        render();
    });

    const modal = document.getElementById('finIncomeModal');
    const open = () => {
        const today = new Date();
        const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        document.getElementById('finIncomeDate').value = iso;
        modal.classList.add('active');
    };
    const close = () => modal.classList.remove('active');

    document.getElementById('finNewIncome')?.addEventListener('click', open);
    document.getElementById('finIncomeClose')?.addEventListener('click', close);
    document.getElementById('finIncomeCancel')?.addEventListener('click', close);

    document.getElementById('finIncomeForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('finIncomeError');
        errorEl.classList.remove('active');
        try {
            const projectId = document.getElementById('finIncomeProject').value || null;
            const project = projects.find((p) => p.id === projectId);
            await createIncome({
                entry_date: document.getElementById('finIncomeDate').value,
                concept: document.getElementById('finIncomeConcept').value.trim(),
                project_id: projectId,
                client_workspace_id: project?.workspace_id || null,
                category_id: document.getElementById('finIncomeCategory').value || null,
                amount: Number(document.getElementById('finIncomeAmount').value),
                status: document.getElementById('finIncomeStatus').value,
                payment_method_id: document.getElementById('finIncomeMethod').value || null,
                notes: document.getElementById('finIncomeNotes').value.trim() || null,
                currency: settings?.currency || 'COP'
            });
            close();
            rows = await listIncomes({ monthKey });
            render();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.classList.add('active');
        }
    });

    document.querySelectorAll('[data-del-income]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!window.confirm('¿Eliminar este ingreso?')) return;
            await deleteIncome(btn.getAttribute('data-del-income'));
            rows = await listIncomes({ monthKey });
            render();
        });
    });
}

init();
