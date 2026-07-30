/* ==========================================================
   NEXA HUB — Contabilidad V2: catálogo simple
   ========================================================== */

export const FINANCE_SECTIONS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'ingresos', label: 'Ingresos' },
    { id: 'egresos', label: 'Egresos' },
    { id: 'fijos', label: 'Pagos Fijos' },
    { id: 'empleados', label: 'Empleados' },
    { id: 'prestamos', label: 'Préstamos' },
    { id: 'resumen', label: 'Resumen' }
];

export const FINANCE_WIDGETS = [
    { key: 'available', name: 'Caja disponible', color: '#4ADE80', size: 'lg', icon: 'wallet' },
    { key: 'income_total', name: 'Dinero ingresado', color: '#2D8CFF', size: 'md', icon: 'income' },
    { key: 'expense_total', name: 'Dinero gastado', color: '#FF6B81', size: 'md', icon: 'expense' },
    { key: 'fixed_total', name: 'Pagos fijos del mes', color: '#8C52FF', size: 'md', icon: 'ops' },
    { key: 'distributed', name: 'Dinero repartido', color: '#C9A8FF', size: 'md', icon: 'pct' },
    { key: 'pending_loan_balance', name: 'Dinero pendiente', color: '#FF8A3D', size: 'md', icon: 'payable' },
    { key: 'pending_loans', name: 'Préstamos activos', color: '#FFC15F', size: 'md', icon: 'receivable', format: 'count' }
];

export const DEFAULT_DASHBOARD_LAYOUT = FINANCE_WIDGETS.map((w, i) => ({
    key: w.key,
    visible: true,
    order: i,
    size: w.size
}));

export const FINANCE_HELP = {
    income_total: {
        title: 'Dinero ingresado',
        meaning: 'Todo el dinero que entró en esta contabilidad en el mes que estás viendo.',
        how: 'Se suman todos los ingresos del mes.',
        example: 'Si cobraste $5.000.000 y $3.000.000, aquí verás $8.000.000.',
        tip: 'Registra cada cobro el mismo día para no olvidarlo.'
    },
    expense_total: {
        title: 'Dinero gastado',
        meaning: 'Todo lo que salió en gastos del mes (sin contar todavía los pagos fijos como ítem aparte en el resumen).',
        how: 'Se suman todos los egresos del mes.',
        example: 'Software $200.000 + transporte $150.000 = $350.000.',
        tip: 'Anota también los gastos pequeños: al final del mes sí se notan.'
    },
    fixed_total: {
        title: 'Pagos fijos del mes',
        meaning: 'Lo que necesitas cada mes para cubrir suscripciones y cuentas que se repiten.',
        how: 'Se suman todos los pagos fijos marcados como Activos.',
        example: 'Hosting + Internet + Adobe = total fijo del mes.',
        tip: 'Si cancelas una suscripción, márcala como Inactiva.'
    },
    available: {
        title: 'Caja disponible',
        meaning: 'Lo que queda después de restar egresos y pagos fijos a los ingresos. Es el dinero que realmente puedes usar o repartir.',
        how: 'Ingresos − Egresos − Pagos fijos.',
        example: 'Entran $32M, gastas $8.3M y fijos $4.2M → disponible $19.5M.',
        tip: 'Este es el número más importante del mes.'
    },
    distributed: {
        title: 'Dinero repartido',
        meaning: 'Cómo se reparte el disponible entre las personas según su porcentaje.',
        how: 'Disponible × porcentaje de cada empleado activo.',
        example: 'Disponible $10M · 50% = $5M para esa persona.',
        tip: 'La suma de porcentajes debería acercarse a 100%.'
    },
    pending_loans: {
        title: 'Préstamos activos',
        meaning: 'Cuántos préstamos siguen pendientes (por pagar o por cobrar).',
        how: 'Se cuentan los préstamos que no están marcados como Pagado.',
        example: 'Tienes 2 préstamos pendientes → aquí verás 2.',
        tip: 'Actualiza lo abonado para ver cuánto falta.'
    },
    pending_loan_balance: {
        title: 'Dinero pendiente',
        meaning: 'Cuánto falta por pagar o por cobrar en tus préstamos activos.',
        how: 'Suma de (valor total − lo ya abonado) de cada préstamo que aún no está pagado.',
        example: 'Préstamo de $5M con $2M abonados → pendiente $3M.',
        tip: 'Cada vez que abonas, actualiza el campo Abonado.'
    }
};

export const LOAN_TYPE_LABELS = {
    received: 'Préstamo recibido',
    granted: 'Préstamo otorgado'
};

export const LOAN_STATUS_LABELS = {
    pending: 'Pendiente',
    paid: 'Pagado',
    overdue: 'Vencido'
};

export const BOOK_COLORS = [
    '#8C52FF', '#2D8CFF', '#4ADE80', '#FF8A3D', '#FF6B81', '#FFC15F', '#5FA8FF', '#C9A8FF'
];
