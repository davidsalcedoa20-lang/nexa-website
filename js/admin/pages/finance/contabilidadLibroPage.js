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
    listEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
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

const SECTION_META = {
    dashboard: { title: 'Dashboard', subtitle: 'Lo esencial de este mes, en un vistazo.' },
    ingresos: { title: 'Ingresos', subtitle: 'Registra el dinero que entra.' },
    egresos: { title: 'Egresos', subtitle: 'Registra el dinero que sale.' },
    fijos: { title: 'Pagos Fijos', subtitle: 'Gastos que se repiten todos los meses.' },
    empleados: { title: 'Empleados', subtitle: 'Reparto por porcentaje del dinero disponible.' },
    prestamos: { title: 'Préstamos', subtitle: 'Lo que debes o te deben, sin complicaciones.' },
    resumen: { title: 'Resumen', subtitle: 'Indicadores fáciles de entender.' }
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
    root.innerHTML = '<p class="fin-loading">Abriendo contabilidad…</p>';

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
        rows = await listFixedPayments(bookId);
    } else if (section === 'empleados') {
        rows = await listEmployees(bookId);
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
            showMonth: !['fijos', 'prestamos'].includes(section)
        })}
        <div id="finSectionBody">${renderSectionBody()}</div>
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
        case 'prestamos': return renderLoans();
        case 'resumen': return renderResumen();
        default: return '<p class="fin-empty">Sección no encontrada.</p>';
    }
}

/* ---------------- Dashboard ---------------- */

function renderDashboard() {
    const v = summary.values;
    return `
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">Mueve, oculta o cambia el tamaño de las tarjetas.</p>
            <button type="button" class="admin-btn-secondary" id="finToggleEdit">
                ${editMode ? 'Listo' : 'Personalizar'}
            </button>
        </div>
        <section class="fin-summary-strip fin-summary-strip-4">
            <div>
                <span>Ingresos <button type="button" class="fin-help-btn" data-help="income_total">ⓘ</button></span>
                <strong>${money(v.income_total)}</strong>
            </div>
            <div>
                <span>Egresos <button type="button" class="fin-help-btn" data-help="expense_total">ⓘ</button></span>
                <strong>${money(v.expense_total)}</strong>
            </div>
            <div>
                <span>Pagos fijos <button type="button" class="fin-help-btn" data-help="fixed_total">ⓘ</button></span>
                <strong>${money(v.fixed_total)}</strong>
            </div>
            <div>
                <span>Disponible <button type="button" class="fin-help-btn" data-help="available">ⓘ</button></span>
                <strong>${money(v.available)}</strong>
            </div>
        </section>
        ${renderDashboardGrid({
            layout,
            values: v,
            currency: book.currency || 'COP',
            editMode
        })}
        ${summary.shares.length ? `
            <section class="fin-panel fin-shares-panel">
                <div class="fin-panel-head">
                    <h3>Reparto del disponible</h3>
                    <button type="button" class="fin-help-btn" data-help="distributed">ⓘ</button>
                </div>
                <div class="fin-shares-list">
                    ${summary.shares.map((s) => `
                        <div class="fin-share-row">
                            <div>
                                <strong>${escapeHtml(s.name)}</strong>
                                <span>${escapeHtml(s.job_title || 'Sin cargo')} · ${s.percentage}%</span>
                            </div>
                            <b>${money(s.amount)}</b>
                        </div>
                    `).join('')}
                </div>
            </section>
        ` : `
            <p class="fin-muted">Agrega empleados con porcentaje para ver el reparto automático.
                <a href="${bookSectionHref(bookId, 'empleados', monthKey)}">Ir a Empleados</a>
            </p>
        `}
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

/* ---------------- Pagos fijos ---------------- */

function renderFixed() {
    const activeTotal = rows.filter((r) => r.is_active).reduce((s, r) => s + Number(r.amount || 0), 0);
    return `
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">
                Necesitas <strong>${money(activeTotal)}</strong> cada mes para cubrir pagos activos.
                <button type="button" class="fin-help-btn" data-help="fixed_total">ⓘ</button>
            </p>
            <button type="button" class="admin-btn-primary" id="finNewFixed">+ Nuevo pago fijo</button>
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
                    `).join('') : '<tr><td colspan="5" class="fin-empty-cell">Registra hosting, internet, arriendo…</td></tr>'}
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
                    <h3>${row ? 'Editar' : 'Nuevo'} pago fijo</h3>
                    <button type="button" class="admin-modal-close" data-close-fixed>✕</button>
                </div>
                <form id="finFixedForm" class="admin-form">
                    <div class="fin-form-grid">
                        <div class="admin-field fin-span-2">
                            <label>Nombre *</label>
                            <input name="name" required value="${escapeHtml(row?.name || '')}" placeholder="Ej. Hosting">
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

/* ---------------- Empleados ---------------- */

function renderEmployees() {
    const pctSum = rows.filter((e) => e.is_active).reduce((s, e) => s + Number(e.percentage || 0), 0);
    return `
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">
                Disponible este mes: <strong>${money(summary.values.available)}</strong>
                · Porcentajes activos: <strong>${pctSum}%</strong>
                <button type="button" class="fin-help-btn" data-help="distributed">ⓘ</button>
            </p>
            <button type="button" class="admin-btn-primary" id="finNewEmployee">+ Nuevo empleado</button>
        </div>
        <div class="fin-table-wrap">
            <table class="fin-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Cargo</th>
                        <th>Porcentaje</th>
                        <th>Este mes</th>
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
                                <td>${escapeHtml(e.job_title || '—')}</td>
                                <td class="fin-num">${Number(e.percentage)}%</td>
                                <td class="fin-num">${e.is_active ? money(share?.amount || 0) : '—'}</td>
                                <td><span class="fin-status ${e.is_active ? 'status-confirmed' : 'status-draft'}">${e.is_active ? 'Activo' : 'Inactivo'}</span></td>
                                <td class="fin-row-actions">
                                    <button type="button" class="admin-btn-secondary" data-edit="${e.id}">Editar</button>
                                    <button type="button" class="admin-icon-btn" data-del="${e.id}" title="Eliminar">✕</button>
                                </td>
                            </tr>
                        `;
                    }).join('') : '<tr><td colspan="6" class="fin-empty-cell">Agrega personas y su porcentaje de participación.</td></tr>'}
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
                            <input name="job_title" value="${escapeHtml(row?.job_title || '')}" placeholder="Opcional">
                        </div>
                        <div class="admin-field">
                            <label>Porcentaje *</label>
                            <input type="number" name="percentage" min="0" max="100" step="0.01" required value="${row ? Number(row.percentage) : ''}">
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
                        <button type="button" class="admin-btn-secondary" data-close-emp>Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/* ---------------- Préstamos ---------------- */

function renderLoans() {
    return `
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">
                ${summary.counts.loans} activo${summary.counts.loans === 1 ? '' : 's'} ·
                Pendiente total: <strong>${money(summary.values.pending_loan_balance)}</strong>
                <button type="button" class="fin-help-btn" data-help="pending_loan_balance">ⓘ</button>
            </p>
            <button type="button" class="admin-btn-primary" id="finNewLoan">+ Nuevo préstamo</button>
        </div>
        <div class="fin-table-wrap">
            <table class="fin-table">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Persona / entidad</th>
                        <th>Valor</th>
                        <th>Abonado</th>
                        <th>Saldo</th>
                        <th>Cuotas</th>
                        <th>Próxima</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length ? rows.map((l) => {
                        const st = l.computed_status || l.status;
                        return `
                            <tr>
                                <td>${escapeHtml(LOAN_TYPE_LABELS[l.loan_type] || l.loan_type)}</td>
                                <td><strong>${escapeHtml(l.counterparty)}</strong></td>
                                <td class="fin-num">${money(l.principal)}</td>
                                <td class="fin-num">${money(l.paid_amount)}</td>
                                <td class="fin-num">${money(l.remaining_balance)}</td>
                                <td>${escapeHtml(String(l.remaining_installments ?? '—'))} / ${escapeHtml(String(l.installments || '—'))}</td>
                                <td>${escapeHtml(l.next_due_date || '—')}</td>
                                <td><span class="fin-status status-${st === 'overdue' ? 'cancelled' : st}">${escapeHtml(LOAN_STATUS_LABELS[st] || st)}</span></td>
                                <td class="fin-row-actions">
                                    <button type="button" class="admin-btn-secondary" data-edit="${l.id}">Editar</button>
                                    <button type="button" class="admin-icon-btn" data-del="${l.id}" title="Eliminar">✕</button>
                                </td>
                            </tr>
                        `;
                    }).join('') : '<tr><td colspan="9" class="fin-empty-cell">Sin préstamos registrados.</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function loanModalHtml(row = null) {
    const today = new Date().toISOString().slice(0, 10);
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
                                <option value="received" ${row?.loan_type !== 'granted' ? 'selected' : ''}>Préstamo recibido</option>
                                <option value="granted" ${row?.loan_type === 'granted' ? 'selected' : ''}>Préstamo otorgado</option>
                            </select>
                        </div>
                        <div class="admin-field">
                            <label>Fecha *</label>
                            <input type="date" name="start_date" required value="${escapeHtml(row?.start_date || today)}">
                        </div>
                        <div class="admin-field fin-span-2">
                            <label>Persona o entidad *</label>
                            <input name="counterparty" required value="${escapeHtml(row?.counterparty || '')}">
                        </div>
                        <div class="admin-field">
                            <label>Valor *</label>
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
        { key: 'income_total', label: 'Dinero ingresado', value: money(v.income_total) },
        { key: 'expense_total', label: 'Dinero gastado', value: money(v.expense_total) },
        { key: 'fixed_total', label: 'Pagos fijos', value: money(v.fixed_total) },
        { key: 'available', label: 'Dinero disponible', value: money(v.available) },
        { key: 'distributed', label: 'Dinero repartido', value: money(v.distributed) },
        { key: 'pending_loan_balance', label: 'Dinero pendiente', value: money(v.pending_loan_balance) },
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
                <h3>Cómo se reparte este mes</h3>
                <div class="fin-shares-list">
                    ${summary.shares.map((s) => `
                        <div class="fin-share-row">
                            <div>
                                <strong>${escapeHtml(s.name)}</strong>
                                <span>${s.percentage}%</span>
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
        document.getElementById('finToggleEdit')?.addEventListener('click', async () => {
            editMode = !editMode;
            render();
        });
        wireDashboardGrid({
            getLayout: () => layout,
            setLayout: (next) => { layout = normalizeLayout(next); },
            onSave: async (next) => {
                layout = normalizeLayout(next);
                book = await saveBookDashboardLayout(bookId, layout);
                render();
            },
            editMode
        });
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
                if (!window.confirm('¿Eliminar este pago fijo?')) return;
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
                await deleteEmployee(bookId, btn.getAttribute('data-del'));
                await reloadAndRender();
            });
        });
        return;
    }

    if (section === 'prestamos') {
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
            percentage: fd.get('percentage'),
            is_active: fd.get('is_active') === '1'
        };
        try {
            if (row) await updateEmployee(bookId, row.id, payload);
            else await createEmployee(bookId, payload);
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
            status: fd.get('status')
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
