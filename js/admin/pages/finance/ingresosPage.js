/* ==========================================================
   NEXA HUB — Página: Contabilidad · Ingresos (Fase 2)
   ========================================================== */
import { listProjects } from '../../../services/projectService.js';
import { listClients, createClient } from '../../services/clientService.js';
import { generateTemporaryPassword } from '../../../utils/passwordGenerator.js';
import {
    ensureFinanceSettings,
    listIncomes,
    createIncome,
    updateIncome,
    deleteIncome,
    duplicateIncome,
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
    exportIncomesCsv,
    exportIncomesExcel,
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
let clients = [];
let filters = {};
let editingId = null;
let attachmentEntryId = null;
let pendingFiles = [];

async function reloadRows() {
    rows = await listIncomes({ monthKey, ...filters });
}

async function init() {
    if (!root) return;
    ensureHelpDrawer();
    setSelectedMonth(monthKey);
    root.innerHTML = '<p class="fin-loading">Cargando ingresos…</p>';
    try {
        settings = await ensureFinanceSettings();
        [categories, methods, projects, clients] = await Promise.all([
            listFinanceCategories('income'),
            listPaymentMethods(),
            listProjects({ includeArchived: false }).catch(() => []),
            listClients().catch(() => [])
        ]);
        await reloadRows();
        render();
    } catch (error) {
        root.innerHTML = `<p class="fin-error">${escapeHtml(error.message)}</p>`;
    }
}

function clientLabel(r) {
    return r.workspaces?.name || r.workspaces?.profiles?.full_name || '—';
}

function render() {
    const currency = settings?.currency || 'COP';
    const locale = settings?.locale || 'es-CO';

    root.innerHTML = `
        ${renderFinanceSubnav('ingresos')}
        ${renderGlobalSearchBar()}
        ${renderFinancePageHeader({
            title: 'Ingresos',
            subtitle: 'Registro operativo de entradas',
            monthKey
        })}
        ${renderFinanceFilters({ kind: 'income', filters, categories, methods, projects, clients })}
        <div class="fin-toolbar">
            <p class="fin-toolbar-note">${rows.length} registro${rows.length === 1 ? '' : 's'}</p>
            <div class="fin-toolbar-actions">
                <button type="button" class="admin-btn-secondary" id="finExportCsv">CSV</button>
                <button type="button" class="admin-btn-secondary" id="finExportExcel">Excel</button>
                <button type="button" class="admin-btn-secondary" id="finExportPdf">PDF</button>
                <button type="button" class="admin-btn-primary" id="finNewIncome">+ Nuevo ingreso</button>
            </div>
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
                        <th>IVA</th>
                        <th>Estado</th>
                        <th>Método</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length ? rows.map((r) => `
                        <tr>
                            <td>${escapeHtml(r.entry_date)}</td>
                            <td>
                                <strong>${escapeHtml(r.concept)}</strong>
                                ${r.description ? `<div class="fin-notes">${escapeHtml(r.description)}</div>` : ''}
                            </td>
                            <td>${escapeHtml(clientLabel(r))}</td>
                            <td>${escapeHtml(r.projects?.name || '—')}</td>
                            <td>${escapeHtml(r.finance_categories?.name || '—')}</td>
                            <td class="fin-num">${formatMoney(r.amount, { currency, locale })}</td>
                            <td class="fin-num">${formatMoney(r.tax_amount || 0, { currency, locale })}</td>
                            <td><span class="fin-status status-${r.status}">${FINANCE_STATUS_LABELS[r.status] || r.status}</span></td>
                            <td>${escapeHtml(r.finance_payment_methods?.name || '—')}</td>
                            <td class="fin-row-actions">
                                <button type="button" class="admin-btn-secondary" data-edit="${r.id}">Editar</button>
                                <button type="button" class="admin-btn-secondary" data-dup="${r.id}">Duplicar</button>
                                <button type="button" class="admin-icon-btn" data-del="${r.id}" title="Eliminar">✕</button>
                            </td>
                        </tr>
                    `).join('') : `<tr><td colspan="10" class="fin-empty-cell">Sin ingresos con estos filtros.</td></tr>`}
                </tbody>
            </table>
        </div>
        ${renderIncomeModal()}
        ${renderQuickClientModal()}
        ${renderQuickCategoryModal()}
    `;

    wireMonthSelector(async (next) => {
        monthKey = next;
        await reloadRows();
        render();
    });
    wireGlobalSearch(searchFinance);
    wireFinanceFilters(async () => {
        filters = readFinanceFilters('income');
        await reloadRows();
        render();
    });

    document.getElementById('finNewIncome')?.addEventListener('click', () => openModal(null));
    document.getElementById('finExportCsv')?.addEventListener('click', () => exportIncomesCsv(rows));
    document.getElementById('finExportExcel')?.addEventListener('click', () => exportIncomesExcel(rows));
    document.getElementById('finExportPdf')?.addEventListener('click', () => exportTablePdf({
        title: `Ingresos ${monthKey}`,
        rows,
        kind: 'income',
        currency,
        locale
    }));

    document.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const row = rows.find((r) => r.id === btn.getAttribute('data-edit'));
            openModal(row);
        });
    });
    document.querySelectorAll('[data-dup]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await duplicateIncome(btn.getAttribute('data-dup'));
            await reloadRows();
            await getMonthSummary(monthKey);
            render();
        });
    });
    document.querySelectorAll('[data-del]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!window.confirm('¿Eliminar este ingreso?')) return;
            await deleteIncome(btn.getAttribute('data-del'));
            await reloadRows();
            render();
        });
    });

    wireIncomeModal();
}

function renderIncomeModal() {
    return `
        <div class="admin-modal-overlay" id="finIncomeModal">
            <div class="admin-modal fin-entry-modal">
                <div class="admin-modal-header">
                    <h3 id="finIncomeModalTitle">Nuevo ingreso</h3>
                    <button type="button" class="admin-modal-close" data-close-income>
                        <svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </button>
                </div>
                <form id="finIncomeForm" class="admin-form fin-entry-form" novalidate>
                    <div class="fin-form-grid">
                        <div class="admin-field"><label>Fecha *</label><input type="date" id="finIncomeDate" required></div>
                        <div class="admin-field"><label>Estado</label>
                            <select id="finIncomeStatus">
                                ${Object.entries(FINANCE_STATUS_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
                            </select>
                        </div>
                        <div class="admin-field fin-span-2"><label>Concepto *</label><input type="text" id="finIncomeConcept" required></div>
                        <div class="admin-field fin-span-2"><label>Descripción</label><textarea id="finIncomeDescription" rows="2"></textarea></div>
                        <div class="admin-field">
                            <label>Cliente</label>
                            <div class="fin-inline-form">
                                <select id="finIncomeClient"><option value="">Sin cliente</option>
                                    ${clients.map((c) => `<option value="${c.workspaceId}">${escapeHtml(c.company)}</option>`).join('')}
                                </select>
                                <button type="button" class="admin-btn-secondary" id="finQuickClient">+ Nuevo</button>
                            </div>
                        </div>
                        <div class="admin-field">
                            <label>Proyecto</label>
                            <select id="finIncomeProject"><option value="">Sin proyecto</option>
                                ${projects.map((p) => `<option value="${p.id}" data-workspace="${p.workspace_id || ''}">${escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="admin-field">
                            <label>Categoría</label>
                            <div class="fin-inline-form">
                                <select id="finIncomeCategory"><option value="">Sin categoría</option>
                                    ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
                                </select>
                                <button type="button" class="admin-btn-secondary" id="finQuickCategory">+</button>
                            </div>
                        </div>
                        <div class="admin-field">
                            <label>Método de pago</label>
                            <select id="finIncomeMethod"><option value="">—</option>
                                ${methods.map((m) => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="admin-field"><label>Valor *</label><input type="number" id="finIncomeAmount" min="0" step="0.01" required></div>
                        <div class="admin-field"><label>IVA</label><input type="number" id="finIncomeTax" min="0" step="0.01" value="0"></div>
                        <div class="admin-field"><label>Nº comprobante</label><input type="text" id="finIncomeVoucher"></div>
                        <div class="admin-field fin-span-2"><label>Observaciones</label><textarea id="finIncomeNotes" rows="2"></textarea></div>
                        <div class="admin-field fin-span-2">
                            <label>Adjuntos (PDF o imagen)</label>
                            <input type="file" id="finIncomeFiles" accept=".pdf,image/*" multiple>
                            <div id="finIncomeAttachList" class="fin-attach-list"></div>
                        </div>
                    </div>
                    <span class="admin-form-error" id="finIncomeError"></span>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" data-close-income>Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function renderQuickClientModal() {
    return `
        <div class="admin-modal-overlay" id="finClientModal">
            <div class="admin-modal">
                <div class="admin-modal-header"><h3>Nuevo cliente</h3>
                    <button type="button" class="admin-modal-close" id="finClientClose">✕</button>
                </div>
                <form id="finClientForm" class="admin-form" novalidate>
                    <div class="admin-field"><label>Empresa *</label><input id="finClientCompany" required></div>
                    <div class="admin-field"><label>Contacto *</label><input id="finClientContact" required></div>
                    <div class="admin-field"><label>Email *</label><input type="email" id="finClientEmail" required></div>
                    <div class="admin-field"><label>Teléfono</label><input id="finClientPhone"></div>
                    <span class="admin-form-error" id="finClientError"></span>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" id="finClientCancel">Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Crear cliente</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function renderQuickCategoryModal() {
    return `
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
}

async function openModal(row) {
    editingId = row?.id || null;
    pendingFiles = [];
    attachmentEntryId = row?.id || null;
    document.getElementById('finIncomeModalTitle').textContent = row ? 'Editar ingreso' : 'Nuevo ingreso';
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    document.getElementById('finIncomeDate').value = row?.entry_date || iso;
    document.getElementById('finIncomeConcept').value = row?.concept || '';
    document.getElementById('finIncomeDescription').value = row?.description || '';
    document.getElementById('finIncomeClient').value = row?.client_workspace_id || '';
    document.getElementById('finIncomeProject').value = row?.project_id || '';
    document.getElementById('finIncomeCategory').value = row?.category_id || '';
    document.getElementById('finIncomeMethod').value = row?.payment_method_id || '';
    document.getElementById('finIncomeAmount').value = row?.amount ?? '';
    document.getElementById('finIncomeTax').value = row?.tax_amount ?? 0;
    document.getElementById('finIncomeStatus').value = row?.status || 'confirmed';
    document.getElementById('finIncomeVoucher').value = row?.voucher_number || '';
    document.getElementById('finIncomeNotes').value = row?.notes || '';
    document.getElementById('finIncomeError').classList.remove('active');
    document.getElementById('finIncomeModal').classList.add('active');
    await refreshAttachments();
}

async function refreshAttachments() {
    const list = document.getElementById('finIncomeAttachList');
    if (!list) return;
    if (!attachmentEntryId) {
        list.innerHTML = pendingFiles.length
            ? `<p class="fin-muted">${pendingFiles.length} archivo(s) pendientes de subir al guardar.</p>`
            : '<p class="fin-muted">Los adjuntos se suben al guardar el ingreso.</p>';
        return;
    }
    const items = await listAttachments('income', attachmentEntryId);
    list.innerHTML = items.length ? items.map((a) => `
        <div class="fin-attach-item">
            <button type="button" data-open-att="${a.id}" data-path="${escapeHtml(a.storage_path)}">${escapeHtml(a.file_name)}</button>
            <button type="button" class="admin-icon-btn" data-del-att="${a.id}">✕</button>
        </div>
    `).join('') : '<p class="fin-muted">Sin adjuntos.</p>';

    list.querySelectorAll('[data-open-att]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const url = await getAttachmentSignedUrl(btn.getAttribute('data-path'));
            window.open(url, '_blank');
        });
    });
    list.querySelectorAll('[data-del-att]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            await deleteFinanceAttachment(btn.getAttribute('data-del-att'));
            await refreshAttachments();
        });
    });
}

function wireIncomeModal() {
    const modal = document.getElementById('finIncomeModal');
    const close = () => modal.classList.remove('active');
    document.querySelectorAll('[data-close-income]').forEach((b) => b.addEventListener('click', close));

    document.getElementById('finIncomeProject')?.addEventListener('change', (e) => {
        const opt = e.target.selectedOptions?.[0];
        const ws = opt?.getAttribute('data-workspace');
        if (ws) document.getElementById('finIncomeClient').value = ws;
    });

    document.getElementById('finIncomeFiles')?.addEventListener('change', (e) => {
        pendingFiles = [...(e.target.files || [])];
        refreshAttachments();
    });

    document.getElementById('finQuickClient')?.addEventListener('click', () => {
        document.getElementById('finClientModal').classList.add('active');
    });
    document.getElementById('finClientClose')?.addEventListener('click', () => document.getElementById('finClientModal').classList.remove('active'));
    document.getElementById('finClientCancel')?.addEventListener('click', () => document.getElementById('finClientModal').classList.remove('active'));
    document.getElementById('finClientForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('finClientError');
        errorEl.classList.remove('active');
        try {
            const result = await createClient({
                company: document.getElementById('finClientCompany').value.trim(),
                contact: document.getElementById('finClientContact').value.trim(),
                email: document.getElementById('finClientEmail').value.trim().toLowerCase(),
                phone: document.getElementById('finClientPhone').value.trim() || undefined,
                password: generateTemporaryPassword()
            });
            clients = await listClients();
            const wsId = result?.workspace?.id || result?.workspaceId;
            document.getElementById('finClientModal').classList.remove('active');
            // Re-render keeps modal state messy; refresh client select only
            const select = document.getElementById('finIncomeClient');
            select.innerHTML = '<option value="">Sin cliente</option>' + clients.map((c) =>
                `<option value="${c.workspaceId}">${escapeHtml(c.company)}</option>`
            ).join('');
            if (wsId) select.value = wsId;
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.classList.add('active');
        }
    });

    document.getElementById('finQuickCategory')?.addEventListener('click', () => {
        document.getElementById('finCatModal').classList.add('active');
    });
    document.getElementById('finCatClose')?.addEventListener('click', () => document.getElementById('finCatModal').classList.remove('active'));
    document.getElementById('finCatCancel')?.addEventListener('click', () => document.getElementById('finCatModal').classList.remove('active'));
    document.getElementById('finCatForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('finCatName').value.trim();
        if (!name) return;
        const created = await createCategory({ name, kind: 'income' });
        categories = await listFinanceCategories('income');
        const select = document.getElementById('finIncomeCategory');
        select.innerHTML = '<option value="">Sin categoría</option>' + categories.map((c) =>
            `<option value="${c.id}">${escapeHtml(c.name)}</option>`
        ).join('');
        select.value = created.id;
        document.getElementById('finCatModal').classList.remove('active');
    });

    document.getElementById('finIncomeForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('finIncomeError');
        errorEl.classList.remove('active');
        try {
            const payload = {
                entry_date: document.getElementById('finIncomeDate').value,
                concept: document.getElementById('finIncomeConcept').value,
                description: document.getElementById('finIncomeDescription').value,
                client_workspace_id: document.getElementById('finIncomeClient').value || null,
                project_id: document.getElementById('finIncomeProject').value || null,
                category_id: document.getElementById('finIncomeCategory').value || null,
                payment_method_id: document.getElementById('finIncomeMethod').value || null,
                amount: Number(document.getElementById('finIncomeAmount').value),
                tax_amount: Number(document.getElementById('finIncomeTax').value || 0),
                status: document.getElementById('finIncomeStatus').value,
                voucher_number: document.getElementById('finIncomeVoucher').value,
                notes: document.getElementById('finIncomeNotes').value,
                currency: settings?.currency || 'COP'
            };
            let saved;
            if (editingId) saved = await updateIncome(editingId, payload);
            else saved = await createIncome(payload);

            for (const file of pendingFiles) {
                await uploadFinanceAttachment({ entryType: 'income', entryId: saved.id, file });
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
