/* ==========================================================
   NEXA HUB — Servicio: ERP Financiero
   ========================================================== */
import { supabase } from './supabaseClient.js';
import { DEFAULT_DASHBOARD_LAYOUT } from '../components/finance/financeCatalog.js';
import { monthDateRange } from '../components/finance/financeFormat.js';

async function requireAdminId() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) throw new Error('Sesión no válida.');
    return uid;
}

/** Crea settings + catálogos por defecto si no existen. */
export async function ensureFinanceSettings() {
    const adminId = await requireAdminId();
    const { data: existing, error: readError } = await supabase
        .from('finance_settings')
        .select('*')
        .eq('admin_id', adminId)
        .maybeSingle();
    if (readError) throw readError;

    if (existing) {
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
        .order('position', { ascending: true });
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
        .order('position', { ascending: true });
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

export async function listIncomes({ monthKey = null, from = null, to = null } = {}) {
    await ensureFinanceSettings();
    let start = from;
    let end = to;
    if (monthKey) {
        const range = monthDateRange(monthKey);
        start = range.start;
        end = range.end;
    }
    let query = supabase
        .from('finance_incomes')
        .select('*, finance_categories(name, color_hex), finance_payment_methods(name), projects(name), workspaces(name)')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
    if (start) query = query.gte('entry_date', start);
    if (end) query = query.lte('entry_date', end);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function createIncome(payload) {
    const adminId = await requireAdminId();
    const { data, error } = await supabase
        .from('finance_incomes')
        .insert({ ...payload, admin_id: adminId })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateIncome(id, payload) {
    const { data, error } = await supabase
        .from('finance_incomes')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteIncome(id) {
    const { error } = await supabase.from('finance_incomes').delete().eq('id', id);
    if (error) throw error;
}

export async function listExpenses({ monthKey = null, from = null, to = null } = {}) {
    await ensureFinanceSettings();
    let start = from;
    let end = to;
    if (monthKey) {
        const range = monthDateRange(monthKey);
        start = range.start;
        end = range.end;
    }
    let query = supabase
        .from('finance_expenses')
        .select('*, finance_categories(name, color_hex), finance_payment_methods(name)')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
    if (start) query = query.gte('entry_date', start);
    if (end) query = query.lte('entry_date', end);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function createExpense(payload) {
    const adminId = await requireAdminId();
    const { data, error } = await supabase
        .from('finance_expenses')
        .insert({ ...payload, admin_id: adminId })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateExpense(id, payload) {
    const { data, error } = await supabase
        .from('finance_expenses')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteExpense(id) {
    const { error } = await supabase.from('finance_expenses').delete().eq('id', id);
    if (error) throw error;
}

/**
 * Resumen Fase 1: totales simples del mes (sin impuestos ni ajustes complejos).
 * Variación vs mes anterior cuando hay datos.
 */
export async function getMonthSummary(monthKey) {
    const incomes = await listIncomes({ monthKey });
    const expenses = await listExpenses({ monthKey });

    const sumActive = (rows) => rows
        .filter((r) => r.status === 'confirmed' || r.status === 'paid')
        .reduce((acc, r) => acc + Number(r.amount || 0), 0);

    const incomeTotal = sumActive(incomes);
    const expenseTotal = sumActive(expenses);
    const gross = incomeTotal - expenseTotal;
    const pendingIncome = incomes
        .filter((r) => r.status === 'pending')
        .reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const pendingExpense = expenses
        .filter((r) => r.status === 'pending')
        .reduce((acc, r) => acc + Number(r.amount || 0), 0);

    const accounts = await listFinanceAccounts();
    const available = accounts.reduce((acc, a) => acc + Number(a.opening_balance || 0), 0)
        + incomeTotal - expenseTotal;

    const profitability = incomeTotal > 0 ? (gross / incomeTotal) * 100 : null;

    // Mes anterior para variación (ingresos / gastos)
    const { shiftMonth } = await import('../components/finance/financeFormat.js');
    const prevKey = shiftMonth(monthKey, -1);
    const prevIncomes = await listIncomes({ monthKey: prevKey });
    const prevExpenses = await listExpenses({ monthKey: prevKey });
    const prevIncomeTotal = sumActive(prevIncomes);
    const prevExpenseTotal = sumActive(prevExpenses);
    const prevGross = prevIncomeTotal - prevExpenseTotal;

    const pct = (curr, prev) => {
        if (prev === 0) return curr === 0 ? 0 : null;
        return ((curr - prev) / Math.abs(prev)) * 100;
    };

    return {
        values: {
            income_month: incomeTotal,
            expense_month: expenseTotal,
            gross_profit: gross,
            operating_profit: gross,
            net_profit: gross,
            cash_flow: incomeTotal - expenseTotal,
            available_balance: available,
            receivables: pendingIncome,
            payables: pendingExpense,
            profitability
        },
        variations: {
            income_month: pct(incomeTotal, prevIncomeTotal),
            expense_month: pct(expenseTotal, prevExpenseTotal),
            gross_profit: pct(gross, prevGross),
            operating_profit: pct(gross, prevGross),
            net_profit: pct(gross, prevGross),
            cash_flow: pct(incomeTotal - expenseTotal, prevIncomeTotal - prevExpenseTotal),
            available_balance: null,
            receivables: null,
            payables: null,
            profitability: null
        }
    };
}

export async function createCategory(payload) {
    const adminId = await requireAdminId();
    const { data, error } = await supabase
        .from('finance_categories')
        .insert({ ...payload, admin_id: adminId })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function createPaymentMethod(payload) {
    const adminId = await requireAdminId();
    const { data, error } = await supabase
        .from('finance_payment_methods')
        .insert({ ...payload, admin_id: adminId })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function createTag(payload) {
    const adminId = await requireAdminId();
    const { data, error } = await supabase
        .from('finance_tags')
        .insert({ ...payload, admin_id: adminId })
        .select()
        .single();
    if (error) throw error;
    return data;
}
