/* ==========================================================
   NEXA HUB — Contabilidad V2: catálogo simple
   ========================================================== */

export const FINANCE_SECTIONS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'ingresos', label: 'Ingresos' },
    { id: 'egresos', label: 'Egresos' },
    { id: 'fijos', label: 'Gastos Fijos' },
    { id: 'empleados', label: 'Empleados' },
    { id: 'socios', label: 'Socios' },
    { id: 'prestamos', label: 'Préstamos' },
    { id: 'resumen', label: 'Resumen' }
];

export const FINANCE_WIDGETS = [
    { key: 'available', name: 'Caja disponible', color: '#4ADE80', size: 'lg', icon: 'wallet' },
    { key: 'income_total', name: 'Dinero ingresado', color: '#2D8CFF', size: 'md', icon: 'income' },
    { key: 'expense_total', name: 'Dinero gastado', color: '#FF6B81', size: 'md', icon: 'expense' },
    { key: 'fixed_total', name: 'Presupuesto fijo del mes', color: '#8C52FF', size: 'md', icon: 'ops' },
    { key: 'distributed', name: 'Reparto a socios', color: '#C9A8FF', size: 'md', icon: 'pct' },
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
        meaning: 'Toda salida real de dinero del mes. Solo los egresos disminuyen la Caja.',
        how: 'Se suman todos los egresos del mes.',
        example: 'Software $200.000 + transporte $150.000 = $350.000.',
        tip: 'Cuando pagues un gasto fijo o un sueldo, regístralo aquí como egreso.'
    },
    fixed_total: {
        title: 'Presupuesto fijo del mes',
        meaning: 'Cuánto cuesta mantener la empresa cada mes (arriendo, internet, sueldos, software…). Es informativo: no descuenta la Caja.',
        how: 'Se suman gastos fijos activos + sueldos de empleados activos.',
        example: 'Arriendo + Internet + Sueldos = presupuesto mensual.',
        tip: 'Al pagar alguno de estos ítems, crea un Egreso para que sí baje la Caja.'
    },
    available: {
        title: 'Caja disponible',
        meaning: 'Lo que queda después de restar solo los egresos reales a los ingresos.',
        how: 'Ingresos − Egresos.',
        example: 'Entran $32M y gastas $8.3M → disponible $23.7M.',
        tip: 'Los gastos fijos no se restan solos: solo informan el presupuesto.'
    },
    distributed: {
        title: 'Reparto a socios',
        meaning: 'Cómo se reparte el disponible entre los socios según su porcentaje.',
        how: 'Disponible × porcentaje de cada socio activo.',
        example: 'Disponible $10M · 50% = $5M para ese socio.',
        tip: 'La suma de porcentajes debería acercarse a 100%. Los empleados no entran aquí: ellos tienen sueldo fijo.'
    },
    pending_loans: {
        title: 'Préstamos activos',
        meaning: 'Cuántos préstamos siguen pendientes (recibidos u otorgados).',
        how: 'Se cuentan los préstamos que no están marcados como Pagado.',
        example: 'Tienes 2 préstamos pendientes → aquí verás 2.',
        tip: 'Actualiza lo abonado para ver el progreso de cuotas.'
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
