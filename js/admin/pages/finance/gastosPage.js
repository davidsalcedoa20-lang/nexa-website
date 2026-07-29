/* ==========================================================
   NEXA HUB — Página: Contabilidad · Gastos (Fase 2)
   ========================================================== */
import { listProjects } from '../../../services/projectService.js';
import {
    ensureFinanceSettings,
    listExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    duplicateExpense,
    listFinanceCategories,
    listPaymentMethods,
    createCategory,
    listAttachments,
    uploadFinanceAttachment,
    getAttachmentSignedUrl,
    deleteFinanceAttachment,
    searchFinance,
    getMonthSummary
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
import {
    renderFinanceFilters,
    readFinanceFilters,
    wireFinanceFilters,
    renderGlobalSearchBar,
    wireGlobalSearch
} from '../../../components/finance/financeFilters.js';
import {
    exportExpensesCsv,
    exportExpensesExcel,
    exportTablePdf
} from '../../../components/finance/financeExport.js';
import { escapeHtml } from '../../../components/projectUi.js';

const root = document.getElementById('finRoot');
let monthKey = getSelectedMonth();
let settings = null;
let rows = [];
let categories = [];
let methods = [];
let projects = [];
let filters = {};
let editingId = null;
let attachmentEntryId = null;
let pendingFiles = [];

async function reloadRows() {
    rows = await listExpenses({ monthKey, ...filters });
}

async function init() {
    if (!root) return;
    ensureHelpDrawer();
    setSelectedMonth(monthKey);
    root.innerHTML = '<p class="fin-loading">Cargando gastos…</p>';
    try {
        settings = await ensureFinanceSettings();
        [categories, methods, projects] = await Promise.all([
            listFinanceCategories('expense'),
            listPaymentMethods(),
            listProjects({ includeArchived: false }).catch(() => [])
        ]);
        await reloadRows();
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
        ${renderGlobalSearchBar()}
        ${renderFinancePageHeader({
            title: 'Gastos',
            subtitle: 'Registro operativo de salidas',
            monthKey
        })}
        ${renderFinanceFilters({ kind: 'expense', filters, categories, methods, projects })}
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">${rows.length} registro${rows.length === 1 ? '' : 's'}</p>
            <div class="fin-toolbar-actions">
                <button type="button" class="admin-btn-secondary" id="finExportCsv">CSV</button>
                <button type="button" class="admin-btn-secondary" id="finExportExcel">Excel</button>
                <button type="button" class="admin-btn-secondary" id="finExportPdf">PDF</button>
                <button type="button" class="admin-btn-primary" id="finNewExpense">+ Nuevo gasto</button>
            </div>
        </div>
        <div class="fin-table-wrap">
            <table class="fin-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Concepto</th>
                        <th>Proyecto</th>
                        <th>Categoría</th>
                        <th>Valor</th>
                        <th>IVA</th>
                        <th>Método</th>
                        <th>Estado</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length ? rows.map((r) => `
                        <tr>
                            <td>${escapeHtml(r.entry_date)}</td>
                            <td>${escapeHtml(r.vendor_name || '—')}</td>
                            <td>
                                <strong>${escapeHtml(r.concept)}</strong>
                                ${r.description ? `<div class="fin-notes">${escapeHtml(r.description)}</div>` : ''}
                            </td>
                            <td>${escapeHtml(r.projects?.name || '—')}</td>
                            <td>${escapeHtml(r.finance_categories?.name || '—')}</td>
                            <td class="fin-num">${formatMoney(r.amount, { currency, locale })}</td>
                            <td class="fin-num">${formatMoney(r.tax_amount || 0, { currency, locale })}</td>
                            <td>${escapeHtml(r.finance_payment_methods?.name || '—')}</td>
                            <td><span class="fin-status status-${r.status}">${FINANCE_STATUS_LABELS[r.status] || r.status}</span></td>
                            <td class="fin-row-actions">
                                <button type="button" class="admin-btn-secondary" data-edit="${r.id}">Editar</button>
                                <button type="button" class="admin-btn-secondary" data-dup="${r.id}">Duplicar</button>
                                <button type="button" class="admin-icon-btn" data-del="${r.id}" title="Eliminar">✕</button>
                            </td>
                        </tr>
                    `).join('') : `<tr><td colspan="10" class="fin-empty-cell">Sin gastos con estos filtros.</td></tr>`}
                </tbody>
            </table>
        </div>

        <div class="admin-modal-overlay" id="finExpenseModal">
            <div class="admin-modal fin-entry-modal">
                <div class="admin-modal-header">
                    <h3 id="finExpenseModalTitle">Nuevo gasto</h3>
                    <button type="button" class="admin-modal-close" data-close-expense>
                        <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
                <form id="finExpenseForm" class="admin-form fin-entry-form" novalidate>
                    <div class="fin-form-grid">
                        <div class="admin-field"><label>Fecha *</label><input type="date" id="finExpenseDate" required></div>
                        <div class="admin-field"><label>Estado</label>
                            <select id="finExpenseStatus">
                                ${Object.entries(FINANCE_STATUS_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                            </select>
                        </div>
                        <div class="admin-field"><label>Proveedor</label><input type="text" id="finExpenseVendor"></div>
                        <div class="admin-field"><label>Nº factura</label><input type="text" id="finExpenseInvoice"></div>
                        <div class="admin-field fin-span-2"><label>Concepto *</label><input type="text" id="finExpenseConcept" required></div>
                        <div class="admin-field fin-span-2"><label>Descripción</label><textarea id="finExpenseDescription" rows="2"></textarea></div>
                        <div class="admin-field">
                            <label>Proyecto</label>
                            <select id="finExpenseProject"><option value="">Sin proyecto</option>
                                ${projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="admin-field">
                            <label>Categoría</label>
                            <div class="fin-inline-form">
                                <select id="finExpenseCategory"><option value="">Sin categoría</option>
                                    ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
                                </select>
                                <button type="button" class="admin-btn-secondary" id="finQuickCategory">+</button>
                            </div>
                        </div>
                        <div class="admin-field">
                            <label>Método de pago</label>
                            <select id="finExpenseMethod"><option value="">—</option>
                                ${methods.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="admin-field"><label>Valor *</label><input type="number" id="finExpenseAmount" min="0" step="0.01" required></div>
                        <div class="admin-field"><label>IVA</label><input type="number" id="finExpenseTax" min="0" step="0.01" value="0"></div>
                        <div class="admin-field fin-span-2"><label>Observaciones</label><textarea id="finExpenseNotes" rows="2"></textarea></div>
                        <div class="admin-field fin-span-2">
                            <label>Adjuntos (PDF o imagen)</label>
                            <input type="file" id="finExpenseFiles" accept=".pdf,image/*" multiple>
                            <div id="finExpenseAttachList" class="fin-attach-list"></div>
                        </div>
                    </div>
                    <span class="admin-form-error" id="finExpenseError"></span>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" data-close-expense>Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="admin-modal-overlay" id="finCatModal">
            <div class="admin-modal">
                <div class="admin-modal-header"><h3>Nueva categoría</h3>
                    <button type="button" class="admin-modal-close" id="finCatClose">✕</button>
                </div>
                <form id="finCatForm" class="admin-form">
                    <div class="admin-field"><label>Nombre</label><input id="finCatName" required></div>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" id="finCatCancel">Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Crear</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    wireMonthSelector(async (next) => {
        monthKey = next;
        await reloadRows();
        render();
    });
    wireGlobalSearch(searchFinance);
    wireFinanceFilters(async () => {
        filters = readFinanceFilters('expense');
        await reloadRows();
        render();
    });

    document.getElementById('finNewExpense')?.addEventListener('click', () => openModal(null));
    document.getElementById('finExportCsv')?.addEventListener('click', () => exportExpensesCsv(rows));
    document.getElementById('finExportExcel')?.addEventListener('click', () => exportExpensesExcel(rows));
    document.getElementById('finExportPdf')?.addEventListener('click', () => exportTablePdf({
        title: `Gastos ${monthKey}`,
        rows,
        kind: 'expense',
        currency,
        locale
    }));

    document.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => openModal(rows.find((r) => r.id === btn.getAttribute('data-edit'))));
    });
    document.querySelectorAll('[data-dup]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await duplicateExpense(btn.getAttribute('data-dup'));
            await reloadRows();
            render();
        });
    });
    document.querySelectorAll('[data-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!window.confirm('¿Eliminar este gasto?')) return;
            await deleteExpense(btn.getAttribute('data-del'));
            await reloadRows();
            render();
        });
    });

    wireExpenseModal();
}

async function openModal(row) {
    editingId = row?.id || null;
    pendingFiles = [];
    attachmentEntryId = row?.id || null;
    document.getElementById('finExpenseModalTitle').textContent = row ? 'Editar gasto' : 'Nuevo gasto';
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    document.getElementById('finExpenseDate').value = row?.entry_date || iso;
    document.getElementById('finExpenseVendor').value = row?.vendor_name || '';
    document.getElementById('finExpenseConcept').value = row?.concept || '';
    document.getElementById('finExpenseDescription').value = row?.description || '';
    document.getElementById('finExpenseProject').value = row?.project_id || '';
    document.getElementById('finExpenseCategory').value = row?.category_id || '';
    document.getElementById('finExpenseMethod').value = row?.payment_method_id || '';
    document.getElementById('finExpenseAmount').value = row?.amount ?? '';
    document.getElementById('finExpenseTax').value = row?.tax_amount ?? 0;
    document.getElementById('finExpenseStatus').value = row?.status || 'confirmed';
    document.getElementById('finExpenseInvoice').value = row?.invoice_number || '';
    document.getElementById('finExpenseNotes').value = row?.notes || '';
    document.getElementById('finExpenseError').classList.remove('active');
    document.getElementById('finExpenseModal').classList.add('active');
    await refreshAttachments();
}

async function refreshAttachments() {
    const list = document.getElementById('finExpenseAttachList');
    if (!list) return;
    if (!attachmentEntryId) {
        list.innerHTML = pendingFiles.length
            ? `<p class="fin-muted">${pendingFiles.length} archivo(s) pendientes de subir al guardar.</p>`
            : '<p class="fin-muted">Los adjuntos se suben al guardar el gasto.</p>';
        return;
    }
    const items = await listAttachments('expense', attachmentEntryId);
    list.innerHTML = items.length ? items.map((a) => `
        <div class="fin-attach-item">
            <button type="button" data-open-att="${a.id}" data-path="${escapeHtml(a.storage_path)}">${escapeHtml(a.file_name)}</button>
            <button type="button" class="admin-icon-btn" data-del-att="${a.id}">✕</button>
        </div>
    `).join('') : '<p class="fin-muted">Sin adjuntos.</p>';
    list.querySelectorAll('[data-open-att]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            window.open(await getAttachmentSignedUrl(btn.getAttribute('data-path')), '_blank');
        });
    });
    list.querySelectorAll('[data-del-att]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await deleteFinanceAttachment(btn.getAttribute('data-del-att'));
            await refreshAttachments();
        });
    });
}

function wireExpenseModal() {
    const modal = document.getElementById('finExpenseModal');
    const close = () => modal.classList.remove('active');
    document.querySelectorAll('[data-close-expense]').forEach((b) => b.addEventListener('click', close));

    document.getElementById('finExpenseFiles')?.addEventListener('change', (e) => {
        pendingFiles = [...(e.target.files || [])];
        refreshAttachments();
    });

    document.getElementById('finQuickCategory')?.addEventListener('click', () => document.getElementById('finCatModal').classList.add('active'));
    document.getElementById('finCatClose')?.addEventListener('click', () => document.getElementById('finCatModal').classList.remove('active'));
    document.getElementById('finCatCancel')?.addEventListener('click', () => document.getElementById('finCatModal').classList.remove('active'));
    document.getElementById('finCatForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('finCatName').value.trim();
        if (!name) return;
        const created = await createCategory({ name, kind: 'expense' });
        categories = await listFinanceCategories('expense');
        const select = document.getElementById('finExpenseCategory');
        select.innerHTML = '<option value="">Sin categoría</option>' + categories.map((c) =>
            `<option value="${c.id}">${escapeHtml(c.name)}</option>`
        ).join('');
        select.value = created.id;
        document.getElementById('finCatModal').classList.remove('active');
    });

    document.getElementById('finExpenseForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('finExpenseError');
        errorEl.classList.remove('active');
        try {
            const payload = {
                entry_date: document.getElementById('finExpenseDate').value,
                vendor_name: document.getElementById('finExpenseVendor').value,
                concept: document.getElementById('finExpenseConcept').value,
                description: document.getElementById('finExpenseDescription').value,
                project_id: document.getElementById('finExpenseProject').value || null,
                category_id: document.getElementById('finExpenseCategory').value || null,
                payment_method_id: document.getElementById('finExpenseMethod').value || null,
                amount: Number(document.getElementById('finExpenseAmount').value),
                tax_amount: Number(document.getElementById('finExpenseTax').value || 0),
                status: document.getElementById('finExpenseStatus').value,
                invoice_number: document.getElementById('finExpenseInvoice').value,
                notes: document.getElementById('finExpenseNotes').value,
                currency: settings?.currency || 'COP'
            };
            let saved;
            if (editingId) saved = await updateExpense(editingId, payload);
            else saved = await createExpense(payload);
            for (const file of pendingFiles) {
                await uploadFinanceAttachment({ entryType: 'expense', entryId: saved.id, file });
            }
            await getMonthSummary(monthKey);
            close();
            await reloadRows();
            render();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.classList.add('active');
        }
    });
}

init();
