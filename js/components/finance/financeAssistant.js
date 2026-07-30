/* ==========================================================
   NEXA HUB — Finanzas: Asistente Financiero (por sección)
   ========================================================== */
import { escapeHtml } from '../projectUi.js';

export const FINANCE_ASSISTANT = {
    dashboard: {
        title: 'Tu panorama del mes',
        intro: 'Aquí ves lo importante de un vistazo: cuánto entró, cuánto salió y cuánto te queda.',
        tips: [
            'La Caja Disponible es tu número estrella: es lo que realmente puedes usar o repartir.',
            'Si el disponible baja mucho, revisa primero los pagos fijos y los egresos del mes.',
            'Personaliza las tarjetas para dejar solo lo que usas cada día.'
        ],
        examples: [
            'Entraron $32M, salieron $8.3M y fijos $4.2M → disponible $19.5M.'
        ],
        mistakes: [
            'Olvidar registrar un gasto chico: al final del mes sí se nota.',
            'Tener empleados activos con porcentajes que no suman cerca de 100%.'
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
        intro: 'Un egreso es dinero que sale: compras, herramientas, transporte o gastos del mes.',
        tips: [
            'Anota también los gastos pequeños.',
            'Si es un gasto que se repite todos los meses, mejor va en Pagos Fijos.',
            'Usa una categoría clara para entender en qué se va el dinero.'
        ],
        examples: [
            '“Materiales de oficina” · $180.000',
            '“Publicidad Meta Ads” · $650.000'
        ],
        mistakes: [
            'Duplicar un pago fijo también como egreso (elige un solo lugar).',
            'Olvidar la fecha real del gasto.'
        ]
    },
    fijos: {
        title: 'Pagos que se repiten',
        intro: 'Son cuentas que pagas casi todos los meses: hosting, internet, Adobe, arriendo…',
        tips: [
            'Márcalos Activos solo si realmente los pagas este mes.',
            'Si cancelas una suscripción, pásala a Inactivo.',
            'El Dashboard suma automáticamente los activos para decirte cuánto necesitas.'
        ],
        examples: [
            'Hosting $120.000 · día 5',
            'Google Workspace $280.000 · día 1'
        ],
        mistakes: [
            'Dejar activos pagos que ya no usas.',
            'Registrar el mismo ítem otra vez en Egresos cada mes.'
        ]
    },
    empleados: {
        title: 'Reparto por porcentaje',
        intro: 'En NEXA no usamos salario fijo aquí. Cada persona tiene un % de la utilidad disponible.',
        tips: [
            'Disponible = Ingresos − Egresos − Pagos fijos.',
            'Luego: Disponible × porcentaje de cada persona.',
            'La suma de porcentajes debería acercarse a 100%.'
        ],
        examples: [
            'Disponible $20M · David 50% = $10M · Diego 30% = $6M · Andrés 20% = $4M'
        ],
        mistakes: [
            'Dejar personas inactivas como Activas (siguen recibiendo cálculo).',
            'Cambiar porcentajes a mitad de mes sin avisar al equipo.'
        ]
    },
    prestamos: {
        title: 'Préstamos, sin enredos',
        intro: 'Aquí registras lo que te prestaron o lo que tú prestaste. El sistema calcula lo que falta.',
        tips: [
            'Actualiza el Abonado cada vez que pagas o te pagan una cuota.',
            'Revisa la próxima cuota para no olvidar fechas.',
            'Si ya no debes nada, márcalo como Pagado.'
        ],
        examples: [
            'Recibido $20M · abonado $5M → pendiente $15M',
            'Otorgado $5M · 10 cuotas de $500.000'
        ],
        mistakes: [
            'Registrar un préstamo como ingreso o egreso normal.',
            'No actualizar el abonado: el saldo quedará mal.'
        ]
    },
    resumen: {
        title: 'Solo lo esencial',
        intro: 'El Resumen muestra los números clave del mes, sin tecnicismos.',
        tips: [
            'Úsalo para una revisión rápida al cierre del mes.',
            'Si algo no cuadra, vuelve a Ingresos, Egresos o Pagos Fijos.',
            'Pendiente suele referirse a lo que aún falta en préstamos.'
        ],
        examples: [
            'Ingresos, egresos, fijos, disponible, repartido, pendiente y préstamos activos.'
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
        return 'Este mes estás en rojo. Revisa egresos y pagos fijos antes de repartir o gastar más.';
    }
    if (fixed > 0 && available < fixed) {
        return 'Tu disponible es menor que tus pagos fijos. Prioriza cubrir suscripciones y cuentas recurrentes.';
    }
    if (available > 0) {
        return 'Tienes dinero disponible para repartir. Revisa Empleados para ver cuánto le toca a cada persona.';
    }
    return 'Mantén tus registros al día: unos minutos ahora te ahorran confusiones a fin de mes.';
}
