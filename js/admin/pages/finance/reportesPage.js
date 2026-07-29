import { mountFinancePlaceholderPage } from './placeholdersPage.js';

mountFinancePlaceholderPage({
    activeId: 'reportes',
    title: 'Reportes',
    subtitle: 'Exportaciones y comparativas',
    bodyHtml: `
        <div class="fin-coming-soon">
            <h3>Preparado para la siguiente fase</h3>
            <div class="fin-report-grid">
                <article class="fin-report-card"><strong>Exportar PDF</strong><span>Pronto</span></article>
                <article class="fin-report-card"><strong>Exportar Excel</strong><span>Pronto</span></article>
                <article class="fin-report-card"><strong>Comparar meses</strong><span>Pronto</span></article>
                <article class="fin-report-card"><strong>Comparar años</strong><span>Pronto</span></article>
            </div>
            <p>La estructura de datos ya está normalizada por administrador y por mes para habilitar estos reportes sin rehacer el ERP.</p>
        </div>
    `
});
