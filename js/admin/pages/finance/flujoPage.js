import { mountFinancePlaceholderPage } from './placeholdersPage.js';

mountFinancePlaceholderPage({
    activeId: 'flujo',
    title: 'Flujo de Caja',
    subtitle: 'Movimiento de efectivo del periodo',
    bodyHtml: `
        <div class="fin-coming-soon">
            <h3>Arquitectura lista</h3>
            <p>En esta fase queda el espacio del módulo. Próximamente: entradas/salidas diarias, proyección semanal y conciliación con cuentas.</p>
            <ul>
                <li>Flujo operativo</li>
                <li>Flujo de inversión</li>
                <li>Flujo de financiamiento</li>
                <li>Integración bancaria (fase futura)</li>
            </ul>
        </div>
    `
});
