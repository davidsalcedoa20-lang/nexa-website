/* ==========================================================
   NEXA HUB — Finanzas: Asistente Financiero (por sección)
   ========================================================== */
import { escapeHtml } from '../projectUi.js';

export const FINANCE_ASSISTANT = {
    dashboard: {
        title: 'Tu panorama del mes',
        intro: 'Aquí ves lo importante de un vistazo: cuánto entró, cuánto salió y cuánto te queda.',
        tips: [
            'La Caja Disponible solo resta egresos reales: Ingresos − Egresos.',
            'Los gastos fijos son presupuesto: te dicen cuánto cuesta mantener la empresa, sin tocar la Caja.',
            'Personaliza las tarjetas para dejar solo lo que usas cada día.'
        ],
        examples: [
            'Entraron $32M y salieron $8.3M → disponible $23.7M. El presupuesto fijo se muestra aparte.'
        ],
        mistakes: [
            'Olvidar registrar un egreso cuando pagas un gasto fijo o un sueldo.',
            'Mezclar sueldos de empleados con el reparto porcentual de socios.'
        ]
    },
    ingresos: {
        title: '¿Qué es un ingreso?',
        intro: 'Un ingreso es dinero que entra: un cobro, una venta o un pago que recibiste.',
        tips: [
            'Regístralo el mismo día que lo recibes.',
            'Usa categorías simples (Ventas, Servicios, Otros).',
            'Si el cobro es de un proyecto, enlázalo para verlo después.'
        ],
        examples: [
            '“Pago cliente — sitio web” · $4.500.000',
            '“Anticipo proyecto X” · $2.000.000'
        ],
        mistakes: [
            'Registrar un préstamo recibido como ingreso (usa Préstamos).',
            'Poner el valor sin IVA o con IVA mezclado sin criterio: sé consistente.'
        ]
    },
    egresos: {
        title: '¿Qué es un egreso?',
        intro: 'Un egreso es una salida real de dinero. Solo aquí baja la Caja.',
        tips: [
            'Anota también los gastos pequeños.',
            'Cuando pagues un gasto fijo, un sueldo o una liquidación a socio, regístralo como egreso.',
            'Usa una categoría clara para entender en qué se va el dinero.'
        ],
        examples: [
            '“Pago arriendo marzo” · $2.500.000',
            '“Sueldo — Ana López” · $3.200.000'
        ],
        mistakes: [
            'Creer que los gastos fijos ya descontaron la Caja solos.',
            'Olvidar la fecha real del gasto.'
        ]
    },
    fijos: {
        title: 'Presupuesto mensual',
        intro: 'Son cuentas recurrentes para saber cuánto cuesta mantener NEXA: arriendo, internet, software… No descuentan la Caja.',
        tips: [
            'Úsalos como presupuesto informativo del mes.',
            'Si cancelas una suscripción, pásala a Inactivo.',
            'Al pagar el ítem, registra un Egreso para que sí baje la Caja.'
        ],
        examples: [
            'Arriendo $2.500.000 · día 5',
            'Internet $120.000 · día 1'
        ],
        mistakes: [
            'Pensar que al crear un gasto fijo ya salió el dinero de la Caja.',
            'Dejar activos pagos que ya no usas.'
        ]
    },
    empleados: {
        title: 'Sueldos fijos',
        intro: 'Los empleados reciben un sueldo mensual fijo. No hay porcentaje aquí.',
        tips: [
            'El sueldo forma parte del presupuesto fijo del mes (informativo).',
            'Cuando pagues el sueldo, regístralo como Egreso para descontar la Caja.',
            'Los socios (porcentaje) viven en su propia sección.'
        ],
        examples: [
            'Ana · Editora · $3.200.000 · día 30 · Activo'
        ],
        mistakes: [
            'Ponerle porcentaje a un empleado (eso es de Socios).',
            'Olvidar registrar el egreso al pagar el sueldo.'
        ]
    },
    socios: {
        title: 'Reparto por porcentaje',
        intro: 'Los socios reciben un porcentaje del dinero disponible. No tienen sueldo fijo aquí.',
        tips: [
            'Disponible = Ingresos − Egresos.',
            'Luego: Disponible × porcentaje de cada socio.',
            'Al liquidar, registra el pago: se crea un egreso y queda en el historial.'
        ],
        examples: [
            'Disponible $20M · David 50% = $10M · Diego 30% = $6M'
        ],
        mistakes: [
            'Mezclar empleados (sueldo) con socios (porcentaje).',
            'Dejar socios inactivos como Activos.'
        ]
    },
    prestamos: {
        title: 'Préstamos, sin enredos',
        intro: 'Separan lo que NEXA recibió y lo que NEXA prestó. El progreso de cuotas va de 0/N a N/N.',
        tips: [
            'Actualiza el Abonado cada vez que pagas o te pagan una cuota.',
            'La barra muestra cuántas cuotas ya se pagaron (nunca hacia atrás).',
            'Si ya no debes nada, márcalo como Pagado.'
        ],
        examples: [
            'Recibido $20M · 8 cuotas · abonado 1 cuota → 1/8',
            'Otorgado $5M · 10 cuotas de $500.000'
        ],
        mistakes: [
            'Registrar un préstamo como ingreso o egreso normal.',
            'No actualizar el abonado: el progreso quedará en 0/N.'
        ]
    },
    resumen: {
        title: 'Solo lo esencial',
        intro: 'El Resumen muestra los números clave del mes, sin tecnicismos.',
        tips: [
            'Úsalo para una revisión rápida al cierre del mes.',
            'Si algo no cuadra, vuelve a Ingresos o Egresos.',
            'El presupuesto fijo es informativo; la Caja solo mira egresos.'
        ],
        examples: [
            'Ingresos, egresos, presupuesto fijo, disponible, socios y préstamos.'
        ],
        mistakes: [
            'Comparar meses distintos sin cambiar el selector de mes.'
        ]
    }
};

export function renderAssistantPanel(sectionId) {
    const a = FINANCE_ASSISTANT[sectionId] || FINANCE_ASSISTANT.dashboard;
    return `
        <aside class="fin-assistant" aria-label="Asistente Financiero">
            <div class="fin-assistant-head">
                <span class="fin-assistant-emoji" aria-hidden="true">💡</span>
                <div>
                    <span class="fin-kicker">Asistente Financiero</span>
                    <h2>${escapeHtml(a.title)}</h2>
                </div>
            </div>
            <p class="fin-assistant-intro">${escapeHtml(a.intro)}</p>
            ${a.examples?.length ? `
                <section class="fin-assistant-block">
                    <h3>Ejemplos</h3>
                    <ul>${a.examples.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
                </section>
            ` : ''}
            ${a.tips?.length ? `
                <section class="fin-assistant-block">
                    <h3>Consejos</h3>
                    <ul>${a.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
                </section>
            ` : ''}
            ${a.mistakes?.length ? `
                <section class="fin-assistant-block">
                    <h3>Errores comunes</h3>
                    <ul>${a.mistakes.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
                </section>
            ` : ''}
        </aside>
    `;
}

export function tipOfTheMonth(values = {}) {
    const available = Number(values.available || 0);
    const fixed = Number(values.fixed_total || 0);
    const income = Number(values.income_total || 0);

    if (income <= 0) {
        return 'Empieza registrando tus primeros ingresos del mes. Con eso el resto del tablero cobra sentido.';
    }
    if (available < 0) {
        return 'Este mes estás en rojo. Revisa los egresos antes de repartir o gastar más.';
    }
    if (fixed > 0 && available < fixed) {
        return 'Tu Caja es menor que el presupuesto fijo del mes. Prioriza cubrir arriendo, servicios y sueldos con egresos reales.';
    }
    if (available > 0) {
        return 'Tienes dinero disponible. Revisa Socios para el reparto por porcentaje, o Empleados para los sueldos fijos.';
    }
    return 'Mantén tus registros al día: unos minutos ahora te ahorran confusiones a fin de mes.';
}
