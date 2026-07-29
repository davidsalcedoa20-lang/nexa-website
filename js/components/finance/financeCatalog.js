/* ==========================================================
   NEXA HUB — ERP Financiero: catálogo de widgets + ayuda
   ========================================================== */
export const FINANCE_WIDGETS = [
    {
        key: 'income_month',
        name: 'Ingresos del mes',
        color: '#4ADE80',
        icon: 'income',
        size: 'md'
    },
    {
        key: 'expense_month',
        name: 'Gastos del mes',
        color: '#FF6B81',
        icon: 'expense',
        size: 'md'
    },
    {
        key: 'gross_profit',
        name: 'Utilidad Bruta',
        color: '#2D8CFF',
        icon: 'chart',
        size: 'md'
    },
    {
        key: 'operating_profit',
        name: 'Utilidad Operacional',
        color: '#5FA8FF',
        icon: 'ops',
        size: 'md'
    },
    {
        key: 'net_profit',
        name: 'Utilidad Neta',
        color: '#8C52FF',
        icon: 'net',
        size: 'md'
    },
    {
        key: 'cash_flow',
        name: 'Flujo de Caja',
        color: '#FFC15F',
        icon: 'flow',
        size: 'md'
    },
    {
        key: 'available_balance',
        name: 'Saldo Disponible',
        color: '#4ADE80',
        icon: 'wallet',
        size: 'md'
    },
    {
        key: 'receivables',
        name: 'Cuentas por Cobrar',
        color: '#FF8A3D',
        icon: 'receivable',
        size: 'md'
    },
    {
        key: 'payables',
        name: 'Cuentas por Pagar',
        color: '#FF4D6A',
        icon: 'payable',
        size: 'md'
    },
    {
        key: 'profitability',
        name: 'Rentabilidad',
        color: '#C9A8FF',
        icon: 'pct',
        size: 'md'
    }
];

export const DEFAULT_DASHBOARD_LAYOUT = FINANCE_WIDGETS.map((w, index) => ({
    key: w.key,
    visible: true,
    order: index,
    size: w.size || 'md'
}));

/** Contenido pedagógico del panel ⓘ (lenguaje sencillo). */
export const FINANCE_HELP = {
    income_month: {
        title: 'Ingresos del mes',
        meaning: 'Es todo el dinero que entra a tu negocio en el mes seleccionado: pagos de clientes, proyectos cerrados, servicios facturados, etc.',
        how: 'Suma de todos los ingresos con fecha dentro del mes y estado confirmado o pagado. (Los cálculos automáticos se activarán en fases siguientes.)',
        why: 'Te dice si el mes está generando dinero. Sin ingresos claros, no puedes planear gastos ni crecimiento.',
        example: 'Si cobraste $8.000.000 por un sitio web y $2.000.000 por mantenimiento, tus ingresos del mes son $10.000.000.',
        tips: [
            'Registra cada cobro el día en que realmente entra (o se confirma).',
            'Separa ingresos por proyecto para ver qué clientes son más rentables.',
            'No mezcles préstamos personales con ingresos del negocio.'
        ],
        mistakes: [
            'Contar un presupuesto aceptado como ingreso antes de cobrar.',
            'Olvidar ingresos pequeños (soporte, extras) que sí suman.',
            'Duplicar el mismo pago en dos categorías.'
        ]
    },
    expense_month: {
        title: 'Gastos del mes',
        meaning: 'Es el dinero que sale del negocio en el mes: herramientas, publicidad, proveedores, arriendo, comisiones, etc.',
        how: 'Suma de gastos del mes con estado confirmado o pagado.',
        why: 'Controlar gastos evita sorpresas. Un mes con buenos ingresos puede quedar en rojo si los gastos se disparan.',
        example: 'Software $350.000 + ads $800.000 + freelancer $1.200.000 = $2.350.000 de gastos.',
        tips: [
            'Clasifica cada gasto en una categoría clara.',
            'Revisa gastos recurrentes cada mes (suscripciones).',
            'Pregúntate: ¿este gasto genera ingreso o solo comodidad?'
        ],
        mistakes: [
            'No registrar gastos en efectivo “pequeños”.',
            'Pagar gastos personales con la caja del negocio sin marcarlos.',
            'Dejar facturas sin categoría “porque después lo arreglo”.'
        ]
    },
    gross_profit: {
        title: 'Utilidad Bruta',
        meaning: 'Es lo que queda después de restar a los ingresos los costos directos de entregar el servicio o producto.',
        how: 'Ingresos − costos directos. En agencias suele ser ingresos menos costos variables del proyecto (freelancers, stock, comisiones directas).',
        why: 'Mide si tu trabajo “en bruto” es rentable antes de pagar la operación fija (arriendo, software, admin).',
        example: 'Ingresos $10M − costos directos $3M = utilidad bruta $7M.',
        tips: [
            'Identifica qué gastos son realmente directos del proyecto.',
            'Si la utilidad bruta es baja, revisa precios o costos de entrega.'
        ],
        mistakes: [
            'Meter arriendo o internet como costo directo.',
            'Creer que utilidad bruta = dinero en el bolsillo.'
        ]
    },
    operating_profit: {
        title: 'Utilidad Operacional',
        meaning: 'Es la utilidad después de restar también los gastos de operación (marketing, herramientas, admin, etc.).',
        how: 'Utilidad bruta − gastos operativos del mes.',
        why: 'Responde: ¿el negocio funciona bien en el día a día, sin contar cosas financieras extraordinarias?',
        example: 'Utilidad bruta $7M − operación $2.5M = utilidad operacional $4.5M.',
        tips: [
            'Mantén la operación liviana mientras creces.',
            'Compara este número mes a mes, no solo el total de ingresos.'
        ],
        mistakes: [
            'Ignorar suscripciones que se renuevan solas.',
            'Mezclar gastos personales con operación.'
        ]
    },
    net_profit: {
        title: 'Utilidad Neta',
        meaning: 'Es lo que “realmente queda” al final, después de costos, operación y (en fases futuras) impuestos u otros ajustes.',
        how: 'Utilidad operacional ± otros ingresos/gastos no operativos. Impuestos se integrarán después.',
        why: 'Es el indicador más cercano a la ganancia final del periodo.',
        example: 'Si tras todo queda $3.8M, esa es tu utilidad neta del mes (simplificado).',
        tips: [
            'Úsala para decidir reinversión vs. retiro.',
            'No gastes la utilidad neta el mismo día: deja colchón.'
        ],
        mistakes: [
            'Confundir utilidad neta con saldo en el banco.',
            'Retirar todo y quedarse sin capital de trabajo.'
        ]
    },
    cash_flow: {
        title: 'Flujo de Caja',
        meaning: 'Mide el movimiento real de dinero: entradas menos salidas de efectivo en el periodo.',
        how: 'Entradas de caja del mes − salidas de caja del mes. No es lo mismo que utilidad (puedes ganar en papel y no tener efectivo).',
        why: 'Un negocio rentable puede quebrar por falta de efectivo. El flujo de caja protege tu operación.',
        example: 'Entran $6M y salen $5.2M → flujo positivo $800.000.',
        tips: [
            'Anticipa meses con muchos pagos (nómina, herramientas anuales).',
            'Negocia anticipos en proyectos largos.'
        ],
        mistakes: [
            'Confundir factura emitida con dinero cobrado.',
            'Olvidar pagos programados de la siguiente semana.'
        ]
    },
    available_balance: {
        title: 'Saldo Disponible',
        meaning: 'Es el dinero que tienes disponible ahora en tus cuentas/cajas registradas.',
        how: 'Suma de saldos de cuentas activas (caja, bancos, etc.). Se enriquecerá con conciliación bancaria en fases futuras.',
        why: 'Te dice cuánto puedes gastar o invertir sin ahogarte.',
        example: 'Caja $1.2M + banco $4.5M = saldo disponible $5.7M.',
        tips: [
            'Separa un fondo de emergencia (ej. 1–2 meses de gastos fijos).',
            'No cuentes cheques o transferencias pendientes como disponibles.'
        ],
        mistakes: [
            'Usar el saldo de la app bancaria sin registrar movimientos aquí.',
            'Mezclar dinero personal y empresarial en la misma cuenta.'
        ]
    },
    receivables: {
        title: 'Cuentas por Cobrar',
        meaning: 'Dinero que clientes te deben: trabajos entregados o facturados que aún no has cobrado.',
        how: 'Suma de ingresos en estado pendiente / por cobrar. (Cobranza detallada llega en fases siguientes.)',
        why: 'Si crece mucho, tu negocio “prestó” dinero a clientes. Hay que cobrar con disciplina.',
        example: 'Tres clientes te deben $1.5M, $800.000 y $2M → CxC = $4.3M.',
        tips: [
            'Define plazos claros de pago desde la propuesta.',
            'Haz seguimiento semanal a deudas vencidas.'
        ],
        mistakes: [
            'Seguir trabajando sin abono cuando ya hay mora.',
            'No documentar acuerdos de pago.'
        ]
    },
    payables: {
        title: 'Cuentas por Pagar',
        meaning: 'Dinero que tú debes a proveedores, freelancers o servicios aún no pagados.',
        how: 'Suma de obligaciones pendientes de pago.',
        why: 'Te ayuda a no olvidar pagos y a planear la caja de la semana/mes.',
        example: 'Debes $900.000 a un diseñador y $250.000 de hosting anual prorrateado → CxP visibles según registros.',
        tips: [
            'Agenda fechas de pago junto con cobros esperados.',
            'Prioriza proveedores críticos para tu operación.'
        ],
        mistakes: [
            'Pagar tarde y dañar relaciones clave.',
            'No registrar deudas “porque ya me acuerdo”.'
        ]
    },
    profitability: {
        title: 'Rentabilidad',
        meaning: 'Indica qué tan eficiente es tu negocio para convertir ingresos en ganancia (porcentaje).',
        how: 'Normalmente: (Utilidad neta ÷ Ingresos) × 100. En Fase 1 se muestra la estructura; el cálculo fino llega después.',
        why: 'Un mes puede facturar mucho y ser poco rentable. Este % te dice la calidad del negocio, no solo el volumen.',
        example: 'Utilidad neta $2M e ingresos $10M → rentabilidad 20%.',
        tips: [
            'Compara rentabilidad entre meses y entre tipos de servicio.',
            'Subir precio o bajar costo directo suele mejorar el % más que “hacer más de lo mismo”.'
        ],
        mistakes: [
            'Obsesionarse solo con facturación total.',
            'Comparar rentabilidad sin mirar el flujo de caja.'
        ]
    }
};

export const FINANCE_STATUS_LABELS = {
    draft: 'Borrador',
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    paid: 'Pagado',
    cancelled: 'Anulado'
};

export const FINANCE_SUBNAV = [
    { id: 'dashboard', href: 'contabilidad.html', label: 'Dashboard' },
    { id: 'ingresos', href: 'contabilidad-ingresos.html', label: 'Ingresos' },
    { id: 'gastos', href: 'contabilidad-gastos.html', label: 'Gastos' },
    { id: 'flujo', href: 'contabilidad-flujo.html', label: 'Flujo de Caja' },
    { id: 'indicadores', href: 'contabilidad-indicadores.html', label: 'Indicadores' },
    { id: 'reportes', href: 'contabilidad-reportes.html', label: 'Reportes' },
    { id: 'config', href: 'contabilidad-configuracion.html', label: 'Configuración' }
];
