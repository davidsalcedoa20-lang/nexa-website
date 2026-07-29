/* ==========================================================
   NEXA HUB — Servicio: ERP Financiero (Fase 1 + Fase 2)
   ========================================================== */
import { supabase } from './supabaseClient.js';
import { DEFAULT_DASHBOARD_LAYOUT } from '../components/finance/financeCatalog.js';
import { monthDateRange, shiftMonth, parseMonthKey } from '../components/finance/financeFormat.js';

const ATTACH_BUCKET = 'finance-attachments';
const ACTIVE_STATUSES = ['confirmed', 'paid'];

async function requireAdminId() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) throw new Error('Sesión no válida.');
    return uid;
}

export async function logFinanceAudit({ entity_type, entity_id = null, action, payload = {} }) {
    try {
        const adminId = await requireAdminId();
        await supabase.from('finance_audit_log').insert({
            admin_id: adminId,
            entity_type,
            entity_id,
            action,
            payload,
            created_by: adminId
        });
    } catch (_) {
        /* auditoría no debe romper el flujo */
    }
}

export async function ensureFinanceSettings() {
    const adminId = await requireAdminId();
    const { data: existing, error: readError } = await supabase
        .from('finance_settings')
        .select('*')
        .eq('admin_id', adminId)
        .maybeSingle();
    if (readError) throw readError;

    if (existing) {
        // Idempotente: completa catálogos Fase 2 si faltan (ignorar error si RPC no aplica).
        const { error: seedError } = await supabase.rpc('seed_finance_defaults', {
            p_admin_id: adminId
        });
        if (seedError) {
            console.warn('[financeService] seed_finance_defaults:', seedError.message);
        }

        if (!Array.isArray(existing.dashboard_layout) || !existing.dashboard_layout.length) {
            const { data, error } = await supabase
                .from('finance_settings')
                .update({ dashboard_layout: DEFAULT_DASHBOARD_LAYOUT })
                .eq('admin_id', adminId)
                .select()
                .single();
            if (error) throw error;
            return data;
        }
        return existing;
    }

    const { data, error } = await supabase
        .from('finance_settings')
        .insert({
            admin_id: adminId,
            currency: 'COP',
            locale: 'es-CO',
            number_format: 'es-CO',
            fiscal_year_start_month: 1,
            dashboard_layout: DEFAULT_DASHBOARD_LAYOUT
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateFinanceSettings(payload) {
    const adminId = await requireAdminId();
    const { data, error } = await supabase
        .from('finance_settings')
        .update(payload)
        .eq('admin_id', adminId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function saveDashboardLayout(layout) {
    return updateFinanceSettings({ dashboard_layout: layout });
}

export async function listFinanceCategories(kind = null) {
    await ensureFinanceSettings();
    let query = supabase
        .from('finance_categories')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true })
        .order('name', { ascending: true });
    if (kind) query = query.in('kind', [kind, 'both']);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function listPaymentMethods() {
    await ensureFinanceSettings();
    const { data, error } = await supabase
        .from('finance_payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true })
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function listFinanceTags() {
    await ensureFinanceSettings();
    const { data, error } = await supabase
        .from('finance_tags')
        .select('*')
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function listFinanceAccounts() {
    await ensureFinanceSettings();
    const { data, error } = await supabase
        .from('finance_accounts')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true });
    if (error) throw error;
    return data || [];
}

function applyEntryFilters(query, filters = {}, { kind = 'income' } = {}) {
    const {
        from = null,
        to = null,
        monthKey = null,
        projectId = null,
        clientId = null,
        categoryId = null,
        paymentMethodId = null,
        status = null,
        search = null
    } = filters;

    let start = from;
    let end = to;
    if (monthKey) {
        const range = monthDateRange(monthKey);
        start = range.start;
        end = range.end;
    }
    if (start) query = query.gte('entry_date', start);
    if (end) query = query.lte('entry_date', end);
    if (projectId) query = query.eq('project_id', projectId);
    if (clientId && kind === 'income') query = query.eq('client_workspace_id', clientId);
    if (categoryId) query = query.eq('category_id', categoryId);
    if (paymentMethodId) query = query.eq('payment_method_id', paymentMethodId);
    if (status) query = query.eq('status', status);
    if (search && String(search).trim()) {
        const raw = String(search).trim().replace(/,/g, ' ');
        const q = `%${raw}%`;
        const parts = kind === 'income'
            ? [`concept.ilike.${q}`, `description.ilike.${q}`, `notes.ilike.${q}`, `voucher_number.ilike.${q}`]
            : [`concept.ilike.${q}`, `description.ilike.${q}`, `notes.ilike.${q}`, `invoice_number.ilike.${q}`, `vendor_name.ilike.${q}`];
        query = query.or(parts.join(','));
    }
    return query;
}

const INCOME_SELECT = '*, finance_categories(name, color_hex), finance_payment_methods(name), projects(id, name, workspace_id), workspaces(id, name, profiles:client_id(full_name))';
const EXPENSE_SELECT = '*, finance_categories(name, color_hex), finance_payment_methods(name), projects(id, name)';

export async function listIncomes(filters = {}) {
    await ensureFinanceSettings();
    let query = supabase
        .from('finance_incomes')
        .select(INCOME_SELECT)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
    query = applyEntryFilters(query, filters, { kind: 'income' });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function listExpenses(filters = {}) {
    await ensureFinanceSettings();
    let query = supabase
        .from('finance_expenses')
        .select(EXPENSE_SELECT)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });

    query = applyEntryFilters(query, filters, { kind: 'expense' });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

function validateEntryPayload(payload, { requireConcept = true } = {}) {
    if (requireConcept && !String(payload.concept || '').trim()) {
        throw new Error('El concepto es obligatorio.');
    }
    if (!payload.entry_date) throw new Error('La fecha es obligatoria.');
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('El valor no puede ser negativo.');
    }
    const tax = Number(payload.tax_amount ?? 0);
    if (!Number.isFinite(tax) || tax < 0) {
        throw new Error('El IVA no puede ser negativo.');
    }
    return {
        ...payload,
        concept: String(payload.concept).trim(),
        amount,
        tax_amount: tax,
        description: payload.description?.trim() || null,
        notes: payload.notes?.trim() || null
    };
}

export async function createIncome(payload) {
    const adminId = await requireAdminId();
    const clean = validateEntryPayload(payload);
    const row = {
        entry_date: clean.entry_date,
        concept: clean.concept,
        description: clean.description,
        client_workspace_id: payload.client_workspace_id || null,
        project_id: payload.project_id || null,
        category_id: payload.category_id || null,
        payment_method_id: payload.payment_method_id || null,
        account_id: payload.account_id || null,
        amount: clean.amount,
        tax_amount: clean.tax_amount,
        currency: payload.currency || 'COP',
        status: payload.status || 'confirmed',
        notes: clean.notes,
        voucher_number: payload.voucher_number?.trim() || null,
        tags: payload.tags || [],
        admin_id: adminId,
        created_by: adminId
    };
    const { data, error } = await supabase
        .from('finance_incomes')
        .insert(row)
        .select(INCOME_SELECT)
        .single();
    if (error) throw error;
    await logFinanceAudit({ entity_type: 'income', entity_id: data.id, action: 'create', payload: row });
    return data;
}

export async function updateIncome(id, payload) {
    const clean = validateEntryPayload(payload);
    const row = {
        entry_date: clean.entry_date,
        concept: clean.concept,
        description: clean.description,
        client_workspace_id: payload.client_workspace_id || null,
        project_id: payload.project_id || null,
        category_id: payload.category_id || null,
        payment_method_id: payload.payment_method_id || null,
        account_id: payload.account_id || null,
        amount: clean.amount,
        tax_amount: clean.tax_amount,
        currency: payload.currency || 'COP',
        status: payload.status || 'confirmed',
        notes: clean.notes,
        voucher_number: payload.voucher_number?.trim() || null,
        tags: payload.tags || []
    };
    const { data, error } = await supabase
        .from('finance_incomes')
        .update(row)
        .eq('id', id)
        .select(INCOME_SELECT)
        .single();
    if (error) throw error;
    await logFinanceAudit({ entity_type: 'income', entity_id: id, action: 'update', payload: row });
    return data;
}

export async function deleteIncome(id) {
    const { error } = await supabase
        .from('finance_incomes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
    await logFinanceAudit({ entity_type: 'income', entity_id: id, action: 'soft_delete' });
}

export async function duplicateIncome(id) {
    const rows = await listIncomes({});
    const source = rows.find((r) => r.id === id);
    if (!source) throw new Error('Ingreso no encontrado.');
    return createIncome({
        entry_date: source.entry_date,
        concept: `${source.concept} (copia)`,
        description: source.description,
        client_workspace_id: source.client_workspace_id,
        project_id: source.project_id,
        category_id: source.category_id,
        payment_method_id: source.payment_method_id,
        account_id: source.account_id,
        amount: source.amount,
        tax_amount: source.tax_amount || 0,
        currency: source.currency,
        status: 'draft',
        notes: source.notes,
        voucher_number: null,
        tags: source.tags || []
    });
}

export async function createExpense(payload) {
    const adminId = await requireAdminId();
    const clean = validateEntryPayload(payload);
    const row = {
        entry_date: clean.entry_date,
        concept: clean.concept,
        description: clean.description,
        vendor_name: payload.vendor_name?.trim() || null,
        project_id: payload.project_id || null,
        category_id: payload.category_id || null,
        payment_method_id: payload.payment_method_id || null,
        account_id: payload.account_id || null,
        amount: clean.amount,
        tax_amount: clean.tax_amount,
        currency: payload.currency || 'COP',
        status: payload.status || 'confirmed',
        notes: clean.notes,
        invoice_number: payload.invoice_number?.trim() || null,
        tags: payload.tags || [],
        admin_id: adminId,
        created_by: adminId
    };
    const { data, error } = await supabase
        .from('finance_expenses')
        .insert(row)
        .select(EXPENSE_SELECT)
        .single();
    if (error) throw error;
    await logFinanceAudit({ entity_type: 'expense', entity_id: data.id, action: 'create', payload: row });
    return data;
}

export async function updateExpense(id, payload) {
    const clean = validateEntryPayload(payload);
    const row = {
        entry_date: clean.entry_date,
        concept: clean.concept,
        description: clean.description,
        vendor_name: payload.vendor_name?.trim() || null,
        project_id: payload.project_id || null,
        category_id: payload.category_id || null,
        payment_method_id: payload.payment_method_id || null,
        account_id: payload.account_id || null,
        amount: clean.amount,
        tax_amount: clean.tax_amount,
        currency: payload.currency || 'COP',
        status: payload.status || 'confirmed',
        notes: clean.notes,
        invoice_number: payload.invoice_number?.trim() || null,
        tags: payload.tags || []
    };
    const { data, error } = await supabase
        .from('finance_expenses')
        .update(row)
        .eq('id', id)
        .select(EXPENSE_SELECT)
        .single();
    if (error) throw error;
    await logFinanceAudit({ entity_type: 'expense', entity_id: id, action: 'update', payload: row });
    return data;
}

export async function deleteExpense(id) {
    const { error } = await supabase
        .from('finance_expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
    await logFinanceAudit({ entity_type: 'expense', entity_id: id, action: 'soft_delete' });
}

export async function duplicateExpense(id) {
    const rows = await listExpenses({});
    const source = rows.find((r) => r.id === id);
    if (!source) throw new Error('Gasto no encontrado.');
    return createExpense({
        entry_date: source.entry_date,
        concept: `${source.concept} (copia)`,
        description: source.description,
        vendor_name: source.vendor_name,
        project_id: source.project_id,
        category_id: source.category_id,
        payment_method_id: source.payment_method_id,
        account_id: source.account_id,
        amount: source.amount,
        tax_amount: source.tax_amount || 0,
        currency: source.currency,
        status: 'draft',
        notes: source.notes,
        invoice_number: null,
        tags: source.tags || []
    });
}

function sumActive(rows, field = 'amount') {
    return rows
        .filter((r) => ACTIVE_STATUSES.includes(r.status))
        .reduce((acc, r) => acc + Number(r[field] || 0), 0);
}

function sumActiveTotal(rows) {
    return rows
        .filter((r) => ACTIVE_STATUSES.includes(r.status))
        .reduce((acc, r) => acc + Number(r.amount || 0) + Number(r.tax_amount || 0), 0);
}

/**
 * Indicadores del mes — cálculos reales Fase 2.
 * P&L usa base (sin IVA). Flujo/saldo usa base + IVA.
 */
export async function getMonthSummary(monthKey) {
    const incomes = await listIncomes({ monthKey });
    const expenses = await listExpenses({ monthKey });

    const incomeBase = sumActive(incomes, 'amount');
    const expenseBase = sumActive(expenses, 'amount');
    const incomeCash = sumActiveTotal(incomes);
    const expenseCash = sumActiveTotal(expenses);
    const gross = incomeBase - expenseBase;
    const operating = gross;
    const net = gross;
    const cashFlow = incomeCash - expenseCash;
    const pendingIncome = incomes
        .filter((r) => r.status === 'pending')
        .reduce((acc, r) => acc + Number(r.amount || 0) + Number(r.tax_amount || 0), 0);
    const pendingExpense = expenses
        .filter((r) => r.status === 'pending')
        .reduce((acc, r) => acc + Number(r.amount || 0) + Number(r.tax_amount || 0), 0);

    const accounts = await listFinanceAccounts();
    const opening = accounts.reduce((acc, a) => acc + Number(a.opening_balance || 0), 0);
    const available = opening + cashFlow;
    const profitability = incomeBase > 0 ? (net / incomeBase) * 100 : null;
    const margin = incomeBase > 0 ? (gross / incomeBase) * 100 : null;

    const prevKey = shiftMonth(monthKey, -1);
    const prevIncomes = await listIncomes({ monthKey: prevKey });
    const prevExpenses = await listExpenses({ monthKey: prevKey });
    const prevIncomeBase = sumActive(prevIncomes, 'amount');
    const prevExpenseBase = sumActive(prevExpenses, 'amount');
    const prevGross = prevIncomeBase - prevExpenseBase;
    const prevCash = sumActiveTotal(prevIncomes) - sumActiveTotal(prevExpenses);

    const pct = (curr, prev) => {
        if (prev === 0) return curr === 0 ? 0 : null;
        return ((curr - prev) / Math.abs(prev)) * 100;
    };

    return {
        values: {
            income_month: incomeBase,
            expense_month: expenseBase,
            gross_profit: gross,
            operating_profit: operating,
            net_profit: net,
            cash_flow: cashFlow,
            available_balance: available,
            receivables: pendingIncome,
            payables: pendingExpense,
            profitability,
            margin
        },
        variations: {
            income_month: pct(incomeBase, prevIncomeBase),
            expense_month: pct(expenseBase, prevExpenseBase),
            gross_profit: pct(gross, prevGross),
            operating_profit: pct(operating, prevGross),
            net_profit: pct(net, prevGross),
            cash_flow: pct(cashFlow, prevCash),
            available_balance: null,
            receivables: null,
            payables: null,
            profitability: null,
            margin: null
        },
        meta: {
            incomeCount: incomes.length,
            expenseCount: expenses.length,
            incomeTax: sumActive(incomes, 'tax_amount'),
            expenseTax: sumActive(expenses, 'tax_amount')
        }
    };
}

/** Datos para gráficas dinámicas. */
export async function getFinanceChartData(monthKey) {
    const { year } = parseMonthKey(monthKey);
    const incomes = await listIncomes({
        from: `${year}-01-01`,
        to: `${year}-12-31`
    });
    const expenses = await listExpenses({
        from: `${year}-01-01`,
        to: `${year}-12-31`
    });

    const monthIncomes = incomes.filter((r) => r.entry_date?.startsWith(monthKey));
    const monthExpenses = expenses.filter((r) => r.entry_date?.startsWith(monthKey));

    const byCategory = (rows) => {
        const map = new Map();
        rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).forEach((r) => {
            const name = r.finance_categories?.name || 'Sin categoría';
            map.set(name, (map.get(name) || 0) + Number(r.amount || 0));
        });
        return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };

    const byProject = (rows) => {
        const map = new Map();
        rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).forEach((r) => {
            const name = r.projects?.name || 'Sin proyecto';
            map.set(name, (map.get(name) || 0) + Number(r.amount || 0));
        });
        return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };

    const byClient = (rows) => {
        const map = new Map();
        rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).forEach((r) => {
            const name = r.workspaces?.name
                || r.workspaces?.profiles?.full_name
                || 'Sin cliente';
            map.set(name, (map.get(name) || 0) + Number(r.amount || 0));
        });
        return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };

    const monthly = [];
    for (let m = 1; m <= 12; m += 1) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        const i = sumActive(incomes.filter((r) => r.entry_date?.startsWith(key)), 'amount');
        const e = sumActive(expenses.filter((r) => r.entry_date?.startsWith(key)), 'amount');
        monthly.push({ label: key, income: i, expense: e });
    }

    const prevYear = year - 1;
    const prevIncomes = await listIncomes({ from: `${prevYear}-01-01`, to: `${prevYear}-12-31` });
    const prevExpenses = await listExpenses({ from: `${prevYear}-01-01`, to: `${prevYear}-12-31` });
    const yearly = [
        {
            label: String(prevYear),
            income: sumActive(prevIncomes, 'amount'),
            expense: sumActive(prevExpenses, 'amount')
        },
        {
            label: String(year),
            income: sumActive(incomes, 'amount'),
            expense: sumActive(expenses, 'amount')
        }
    ];

    return {
        incomeVsExpense: {
            income: sumActive(monthIncomes, 'amount'),
            expense: sumActive(monthExpenses, 'amount')
        },
        incomeByCategory: byCategory(monthIncomes),
        expenseByCategory: byCategory(monthExpenses),
        incomeByProject: byProject(monthIncomes),
        incomeByClient: byClient(monthIncomes),
        monthlyCompare: monthly,
        yearlyCompare: yearly
    };
}

/** Buscador global Contabilidad. */
export async function searchFinance(queryText) {
    const q = String(queryText || '').trim();
    if (!q) return { incomes: [], expenses: [], categories: [], clients: [] };

    const [incomes, expenses, categories] = await Promise.all([
        listIncomes({ search: q }),
        listExpenses({ search: q }),
        listFinanceCategories()
    ]);

    const qLower = q.toLowerCase();
    const matchedCategories = categories.filter((c) => c.name.toLowerCase().includes(qLower));

    let clients = [];
    try {
        const { listClients } = await import('../admin/services/clientService.js');
        const all = await listClients();
        clients = all.filter((c) =>
            (c.company || '').toLowerCase().includes(qLower)
            || (c.contact || '').toLowerCase().includes(qLower)
            || (c.email || '').toLowerCase().includes(qLower)
        );
    } catch (_) {
        clients = [];
    }

    return {
        incomes: incomes.slice(0, 20),
        expenses: expenses.slice(0, 20),
        categories: matchedCategories.slice(0, 10),
        clients: clients.slice(0, 10)
    };
}

export async function listAttachments(entryType, entryId) {
    const { data, error } = await supabase
        .from('finance_attachments')
        .select('*')
        .eq('entry_type', entryType)
        .eq('entry_id', entryId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function uploadFinanceAttachment({ entryType, entryId, file }) {
    const adminId = await requireAdminId();
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (file.type && !allowed.includes(file.type)) {
        throw new Error('Solo se permiten PDF o imágenes (JPG, PNG, WEBP, GIF).');
    }
    if (file.size > 10 * 1024 * 1024) {
        throw new Error('El archivo no puede superar 10 MB.');
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${adminId}/${entryType}/${entryId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage.from(ATTACH_BUCKET).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
    });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
        .from('finance_attachments')
        .insert({
            admin_id: adminId,
            entry_type: entryType,
            entry_id: entryId,
            file_name: file.name,
            storage_path: storagePath,
            mime_type: file.type || null,
            size_bytes: file.size || null,
            created_by: adminId
        })
        .select()
        .single();
    if (error) throw error;
    await logFinanceAudit({
        entity_type: 'attachment',
        entity_id: data.id,
        action: 'upload',
        payload: { entryType, entryId, file_name: file.name }
    });
    return data;
}

export async function getAttachmentSignedUrl(storagePath, expiresInSeconds = 3600) {
    const { data, error } = await supabase.storage.from(ATTACH_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
}

export async function deleteFinanceAttachment(id) {
    const { error } = await supabase
        .from('finance_attachments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
    await logFinanceAudit({ entity_type: 'attachment', entity_id: id, action: 'soft_delete' });
}

export async function createCategory(payload) {
    const adminId = await requireAdminId();
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('El nombre de la categoría es obligatorio.');
    const { data, error } = await supabase
        .from('finance_categories')
        .insert({
            admin_id: adminId,
            name,
            kind: payload.kind || 'both',
            color_hex: payload.color_hex || '#2D8CFF'
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function createPaymentMethod(payload) {
    const adminId = await requireAdminId();
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('El nombre del método es obligatorio.');
    const { data, error } = await supabase
        .from('finance_payment_methods')
        .insert({ admin_id: adminId, name })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function createTag(payload) {
    const adminId = await requireAdminId();
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('El nombre de la etiqueta es obligatorio.');
    const { data, error } = await supabase
        .from('finance_tags')
        .insert({ admin_id: adminId, name, color_hex: payload.color_hex || '#8C52FF' })
        .select()
        .single();
    if (error) throw error;
    return data;
}
