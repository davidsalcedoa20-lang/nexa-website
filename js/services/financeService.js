/* ==========================================================
   NEXA HUB — Contabilidad V2 (espacios múltiples, simple)
   ========================================================== */
import { supabase } from './supabaseClient.js';
import { DEFAULT_DASHBOARD_LAYOUT } from '../components/finance/financeCatalog.js';
import { monthDateRange, currentMonthKey, formatMonthLabel } from '../components/finance/financeFormat.js';

async function requireAdminId() {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) throw new Error('Sesión no válida.');
    return uid;
}

async function getStaffRole() {
    const uid = await requireAdminId();
    const { data } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
    return data?.role || null;
}

/** Acceso: dueño, compartido o CEO. */
async function assertBookAccessible(bookId) {
    const { data, error } = await supabase
        .from('finance_books')
        .select('*')
        .eq('id', bookId)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Contabilidad no encontrada.');
    return data;
}

async function assertBookOwned(bookId) {
    const adminId = await requireAdminId();
    const role = await getStaffRole();
    const book = await assertBookAccessible(bookId);
    if (role !== 'owner' && book.admin_id !== adminId) {
        throw new Error('Solo el propietario de la contabilidad puede realizar esta acción.');
    }
    return book;
}

/* ---------------- Libros ---------------- */

export async function listFinanceBooks() {
    const adminId = await requireAdminId();
    const { error: seedError } = await supabase.rpc('seed_finance_simple_categories', {
        p_admin_id: adminId
    });
    if (seedError) console.warn('[finance] seed categories:', seedError.message);

    const { data, error } = await supabase
        .from('finance_books')
        .select('*')
        .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function getFinanceBook(bookId) {
    return assertBookAccessible(bookId);
}

export async function createFinanceBook(payload) {
    const adminId = await requireAdminId();
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('El nombre es obligatorio.');

    const { data, error } = await supabase
        .from('finance_books')
        .insert({
            admin_id: adminId,
            name,
            description: payload.description?.trim() || null,
            currency: payload.currency || 'COP',
            start_date: payload.start_date || new Date().toISOString().slice(0, 10),
            color_hex: payload.color_hex || '#8C52FF',
            dashboard_layout: DEFAULT_DASHBOARD_LAYOUT
        })
        .select()
        .single();
    if (error) throw error;

    await supabase.rpc('seed_finance_simple_categories', { p_admin_id: adminId });
    return data;
}

export async function updateFinanceBook(bookId, payload) {
    await assertBookOwned(bookId);
    const { data, error } = await supabase
        .from('finance_books')
        .update(payload)
        .eq('id', bookId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteFinanceBook(bookId) {
    await assertBookOwned(bookId);
    const { error } = await supabase.from('finance_books').delete().eq('id', bookId);
    if (error) throw error;
}

export async function listBookShares(bookId) {
    await assertBookOwned(bookId);
    const { data, error } = await supabase
        .from('finance_book_shares')
        .select('user_id, created_at, profiles:user_id ( id, full_name, email )')
        .eq('book_id', bookId);
    if (error) throw error;
    return data || [];
}

export async function setBookShares(bookId, userIds = []) {
    const book = await assertBookOwned(bookId);
    const adminId = await requireAdminId();
    const unique = [...new Set(userIds.map(String).filter((id) => id && id !== book.admin_id && id !== adminId))];

    const { error: delError } = await supabase
        .from('finance_book_shares')
        .delete()
        .eq('book_id', bookId);
    if (delError) throw delError;

    if (!unique.length) return [];

    const rows = unique.map((user_id) => ({
        book_id: bookId,
        user_id,
        created_by: adminId
    }));
    const { data, error } = await supabase.from('finance_book_shares').insert(rows).select('*');
    if (error) throw error;
    return data || [];
}

export async function listShareableAdmins() {
    const adminId = await requireAdminId();
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['admin', 'owner'])
        .neq('id', adminId)
        .order('full_name', { ascending: true });
    if (error) throw error;
    return (data || []).filter((p) => p.role !== 'owner');
}

export async function saveBookDashboardLayout(bookId, layout) {
    return updateFinanceBook(bookId, { dashboard_layout: layout });
}

/* ---------------- Categorías ---------------- */

export async function listFinanceCategories(kind = null) {
    const adminId = await requireAdminId();
    await supabase.rpc('seed_finance_simple_categories', { p_admin_id: adminId });

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

export async function createCategory(payload) {
    const adminId = await requireAdminId();
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('El nombre es obligatorio.');
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

/* ---------------- Ingresos / Egresos ---------------- */

export async function listIncomes(bookId, { monthKey = null } = {}) {
    await assertBookOwned(bookId);
    let query = supabase
        .from('finance_incomes')
        .select('*, finance_categories(name, color_hex), projects(name)')
        .eq('book_id', bookId)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false });
    if (monthKey) {
        const { start, end } = monthDateRange(monthKey);
        query = query.gte('entry_date', start).lte('entry_date', end);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function createIncome(bookId, payload) {
    const adminId = await requireAdminId();
    await assertBookOwned(bookId);
    const concept = String(payload.concept || '').trim();
    const amount = Number(payload.amount);
    if (!concept) throw new Error('El concepto es obligatorio.');
    if (!payload.entry_date) throw new Error('La fecha es obligatoria.');
    if (!Number.isFinite(amount) || amount < 0) throw new Error('El valor no puede ser negativo.');

    const { data, error } = await supabase
        .from('finance_incomes')
        .insert({
            admin_id: adminId,
            book_id: bookId,
            entry_date: payload.entry_date,
            concept,
            category_id: payload.category_id || null,
            project_id: payload.project_id || null,
            amount,
            tax_amount: 0,
            notes: payload.notes?.trim() || null,
            status: 'confirmed',
            currency: payload.currency || 'COP',
            created_by: adminId
        })
        .select('*, finance_categories(name), projects(name)')
        .single();
    if (error) throw error;
    await touchBook(bookId);
    return data;
}

export async function updateIncome(bookId, id, payload) {
    await assertBookOwned(bookId);
    const concept = String(payload.concept || '').trim();
    const amount = Number(payload.amount);
    if (!concept) throw new Error('El concepto es obligatorio.');
    if (!Number.isFinite(amount) || amount < 0) throw new Error('El valor no puede ser negativo.');

    const { data, error } = await supabase
        .from('finance_incomes')
        .update({
            entry_date: payload.entry_date,
            concept,
            category_id: payload.category_id || null,
            project_id: payload.project_id || null,
            amount,
            notes: payload.notes?.trim() || null
        })
        .eq('id', id)
        .eq('book_id', bookId)
        .select('*, finance_categories(name), projects(name)')
        .single();
    if (error) throw error;
    await touchBook(bookId);
    return data;
}

export async function deleteIncome(bookId, id) {
    await assertBookOwned(bookId);
    const { error } = await supabase
        .from('finance_incomes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('book_id', bookId);
    if (error) throw error;
    await touchBook(bookId);
}

export async function listExpenses(bookId, { monthKey = null } = {}) {
    await assertBookOwned(bookId);
    let query = supabase
        .from('finance_expenses')
        .select('*, finance_categories(name, color_hex)')
        .eq('book_id', bookId)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false });
    if (monthKey) {
        const { start, end } = monthDateRange(monthKey);
        query = query.gte('entry_date', start).lte('entry_date', end);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function createExpense(bookId, payload) {
    const adminId = await requireAdminId();
    await assertBookOwned(bookId);
    const concept = String(payload.concept || '').trim();
    const amount = Number(payload.amount);
    if (!concept) throw new Error('El concepto es obligatorio.');
    if (!payload.entry_date) throw new Error('La fecha es obligatoria.');
    if (!Number.isFinite(amount) || amount < 0) throw new Error('El valor no puede ser negativo.');

    const { data, error } = await supabase
        .from('finance_expenses')
        .insert({
            admin_id: adminId,
            book_id: bookId,
            entry_date: payload.entry_date,
            concept,
            category_id: payload.category_id || null,
            amount,
            tax_amount: 0,
            notes: payload.notes?.trim() || null,
            status: 'confirmed',
            currency: payload.currency || 'COP',
            created_by: adminId
        })
        .select('*, finance_categories(name)')
        .single();
    if (error) throw error;
    await touchBook(bookId);
    return data;
}

export async function updateExpense(bookId, id, payload) {
    await assertBookOwned(bookId);
    const concept = String(payload.concept || '').trim();
    const amount = Number(payload.amount);
    if (!concept) throw new Error('El concepto es obligatorio.');
    if (!Number.isFinite(amount) || amount < 0) throw new Error('El valor no puede ser negativo.');

    const { data, error } = await supabase
        .from('finance_expenses')
        .update({
            entry_date: payload.entry_date,
            concept,
            category_id: payload.category_id || null,
            amount,
            notes: payload.notes?.trim() || null
        })
        .eq('id', id)
        .eq('book_id', bookId)
        .select('*, finance_categories(name)')
        .single();
    if (error) throw error;
    await touchBook(bookId);
    return data;
}

export async function deleteExpense(bookId, id) {
    await assertBookOwned(bookId);
    const { error } = await supabase
        .from('finance_expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('book_id', bookId);
    if (error) throw error;
    await touchBook(bookId);
}

/* ---------------- Pagos fijos ---------------- */

export async function listFixedPayments(bookId) {
    await assertBookOwned(bookId);
    const { data, error } = await supabase
        .from('finance_fixed_payments')
        .select('*')
        .eq('book_id', bookId)
        .is('deleted_at', null)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createFixedPayment(bookId, payload) {
    const adminId = await requireAdminId();
    await assertBookOwned(bookId);
    const name = String(payload.name || '').trim();
    const amount = Number(payload.amount);
    if (!name) throw new Error('El nombre es obligatorio.');
    if (!Number.isFinite(amount) || amount < 0) throw new Error('El valor no puede ser negativo.');

    const { data, error } = await supabase
        .from('finance_fixed_payments')
        .insert({
            admin_id: adminId,
            book_id: bookId,
            name,
            amount,
            payment_day: Number(payload.payment_day) || 1,
            is_active: payload.is_active !== false,
            notes: payload.notes?.trim() || null
        })
        .select()
        .single();
    if (error) throw error;
    await touchBook(bookId);
    return data;
}

export async function updateFixedPayment(bookId, id, payload) {
    await assertBookOwned(bookId);
    const { data, error } = await supabase
        .from('finance_fixed_payments')
        .update({
            name: String(payload.name || '').trim(),
            amount: Number(payload.amount),
            payment_day: Number(payload.payment_day) || 1,
            is_active: !!payload.is_active,
            notes: payload.notes?.trim() || null
        })
        .eq('id', id)
        .eq('book_id', bookId)
        .select()
        .single();
    if (error) throw error;
    await touchBook(bookId);
    return data;
}

export async function deleteFixedPayment(bookId, id) {
    await assertBookOwned(bookId);
    const { error } = await supabase
        .from('finance_fixed_payments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('book_id', bookId);
    if (error) throw error;
    await touchBook(bookId);
}

/* ---------------- Empleados ---------------- */

export async function listEmployees(bookId) {
    await assertBookOwned(bookId);
    const { data, error } = await supabase
        .from('finance_employees')
        .select('*')
        .eq('book_id', bookId)
        .is('deleted_at', null)
        .order('full_name', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createEmployee(bookId, payload) {
    const adminId = await requireAdminId();
    await assertBookOwned(bookId);
    const full_name = String(payload.full_name || '').trim();
    const percentage = Number(payload.percentage);
    if (!full_name) throw new Error('El nombre es obligatorio.');
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        throw new Error('El porcentaje debe estar entre 0 y 100.');
    }

    const { data, error } = await supabase
        .from('finance_employees')
        .insert({
            admin_id: adminId,
            book_id: bookId,
            full_name,
            job_title: payload.job_title?.trim() || null,
            percentage,
            is_active: payload.is_active !== false
        })
        .select()
        .single();
    if (error) throw error;
    await touchBook(bookId);
    return data;
}

export async function updateEmployee(bookId, id, payload) {
    await assertBookOwned(bookId);
    const { data, error } = await supabase
        .from('finance_employees')
        .update({
            full_name: String(payload.full_name || '').trim(),
            job_title: payload.job_title?.trim() || null,
            percentage: Number(payload.percentage),
            is_active: !!payload.is_active
        })
        .eq('id', id)
        .eq('book_id', bookId)
        .select()
        .single();
    if (error) throw error;
    await touchBook(bookId);
    return data;
}

export async function deleteEmployee(bookId, id) {
    await assertBookOwned(bookId);
    const { error } = await supabase
        .from('finance_employees')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('book_id', bookId);
    if (error) throw error;
    await touchBook(bookId);
}

/* ---------------- Préstamos ---------------- */

export async function listLoans(bookId) {
    await assertBookOwned(bookId);
    const { data, error } = await supabase
        .from('finance_loans')
        .select('*')
        .eq('book_id', bookId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(enrichLoan);
}

function enrichLoan(loan) {
    const principal = Number(loan.principal || 0);
    const paid = Number(loan.paid_amount || 0);
    const remaining = Math.max(0, principal - paid);
    const installment = Number(loan.installment_amount || 0);
    const remainingInstallments = installment > 0
        ? Math.ceil(remaining / installment)
        : (remaining > 0 ? loan.installments : 0);

    let status = loan.status;
    if (remaining <= 0) status = 'paid';
    else if (loan.next_due_date && loan.next_due_date < new Date().toISOString().slice(0, 10) && status !== 'paid') {
        status = 'overdue';
    }

    return {
        ...loan,
        remaining_balance: remaining,
        remaining_installments: remainingInstallments,
        computed_status: status
    };
}

export async function createLoan(bookId, payload) {
    const adminId = await requireAdminId();
    await assertBookOwned(bookId);
    const counterparty = String(payload.counterparty || '').trim();
    const principal = Number(payload.principal);
    if (!counterparty) throw new Error('Indica la persona o entidad.');
    if (!Number.isFinite(principal) || principal < 0) throw new Error('El valor no puede ser negativo.');

    const installments = Math.max(1, Number(payload.installments) || 1);
    const installment_amount = Number(payload.installment_amount) > 0
        ? Number(payload.installment_amount)
        : principal / installments;

    const { data, error } = await supabase
        .from('finance_loans')
        .insert({
            admin_id: adminId,
            book_id: bookId,
            loan_type: payload.loan_type || 'received',
            counterparty,
            principal,
            start_date: payload.start_date || new Date().toISOString().slice(0, 10),
            installments,
            installment_amount,
            next_due_date: payload.next_due_date || null,
            paid_amount: Number(payload.paid_amount) || 0,
            status: payload.status || 'pending',
            notes: payload.notes?.trim() || null
        })
        .select()
        .single();
    if (error) throw error;
    await touchBook(bookId);
    return enrichLoan(data);
}

export async function updateLoan(bookId, id, payload) {
    await assertBookOwned(bookId);
    const { data, error } = await supabase
        .from('finance_loans')
        .update({
            loan_type: payload.loan_type,
            counterparty: String(payload.counterparty || '').trim(),
            principal: Number(payload.principal),
            start_date: payload.start_date,
            installments: Number(payload.installments) || 1,
            installment_amount: Number(payload.installment_amount) || 0,
            next_due_date: payload.next_due_date || null,
            paid_amount: Number(payload.paid_amount) || 0,
            status: payload.status || 'pending',
            notes: payload.notes?.trim() || null
        })
        .eq('id', id)
        .eq('book_id', bookId)
        .select()
        .single();
    if (error) throw error;
    await touchBook(bookId);
    return enrichLoan(data);
}

export async function deleteLoan(bookId, id) {
    await assertBookOwned(bookId);
    const { error } = await supabase
        .from('finance_loans')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('book_id', bookId);
    if (error) throw error;
    await touchBook(bookId);
}

/* ---------------- Cálculos ---------------- */

export async function getBookSummary(bookId, monthKey = currentMonthKey()) {
    const book = await assertBookOwned(bookId);
    const [incomes, expenses, fixed, employees, loans] = await Promise.all([
        listIncomes(bookId, { monthKey }),
        listExpenses(bookId, { monthKey }),
        listFixedPayments(bookId),
        listEmployees(bookId),
        listLoans(bookId)
    ]);

    const incomeTotal = incomes.reduce((s, r) => s + Number(r.amount || 0), 0);
    const expenseTotal = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
    const fixedActive = fixed.filter((f) => f.is_active);
    const fixedTotal = fixedActive.reduce((s, r) => s + Number(r.amount || 0), 0);
    const available = incomeTotal - expenseTotal - fixedTotal;

    const activeEmployees = employees.filter((e) => e.is_active);
    const shares = activeEmployees.map((e) => ({
        id: e.id,
        name: e.full_name,
        job_title: e.job_title,
        percentage: Number(e.percentage || 0),
        amount: Math.max(0, available) * (Number(e.percentage || 0) / 100)
    }));
    const distributed = shares.reduce((s, r) => s + r.amount, 0);
    const activeLoans = loans.filter((l) => l.computed_status !== 'paid');
    const pendingLoanBalance = activeLoans.reduce((s, l) => s + Number(l.remaining_balance || 0), 0);

    return {
        book,
        monthKey,
        monthLabel: formatMonthLabel(monthKey),
        values: {
            income_total: incomeTotal,
            expense_total: expenseTotal,
            fixed_total: fixedTotal,
            available,
            distributed,
            pending_loans: activeLoans.length,
            pending_loan_balance: pendingLoanBalance
        },
        shares,
        fixedItems: fixedActive.slice(0, 6),
        activeLoans: activeLoans.slice(0, 4),
        counts: {
            incomes: incomes.length,
            expenses: expenses.length,
            fixed: fixedActive.length,
            employees: activeEmployees.length,
            loans: activeLoans.length
        }
    };
}

export async function getBooksCardStats(books) {
    const monthKey = currentMonthKey();
    const results = [];
    for (const book of books) {
        try {
            const summary = await getBookSummary(book.id, monthKey);
            results.push({
                ...book,
                balance: summary.values.available,
                monthLabel: summary.monthLabel,
                monthKey
            });
        } catch (_) {
            results.push({
                ...book,
                balance: 0,
                monthLabel: formatMonthLabel(monthKey),
                monthKey
            });
        }
    }
    return results;
}

async function touchBook(bookId) {
    await supabase
        .from('finance_books')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', bookId);
}

/* Compat: stubs para imports viejos que puedan quedar */
export async function ensureFinanceSettings() {
    return { currency: 'COP', locale: 'es-CO' };
}
