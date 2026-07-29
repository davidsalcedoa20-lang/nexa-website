/* ==========================================================
   NEXA HUB — Página: Contabilidad · Configuración
   ========================================================== */
import {
    ensureFinanceSettings,
    updateFinanceSettings,
    listFinanceCategories,
    listPaymentMethods,
    listFinanceTags,
    createCategory,
    createPaymentMethod,
    createTag
} from '../../../services/financeService.js';
import {
    getSelectedMonth,
    renderFinanceSubnav,
    renderFinancePageHeader,
    ensureHelpDrawer
} from '../../../components/finance/financeShell.js';
import { escapeHtml } from '../../../components/projectUi.js';

const root = document.getElementById('finRoot');

async function init() {
    if (!root) return;
    ensureHelpDrawer();
    root.innerHTML = '<p class="fin-loading">Cargando configuración…</p>';
    try {
        const [settings, categories, methods, tags] = await Promise.all([
            ensureFinanceSettings(),
            listFinanceCategories(),
            listPaymentMethods(),
            listFinanceTags()
        ]);
        render(settings, categories, methods, tags);
    } catch (error) {
        root.innerHTML = `<p class="fin-error">${escapeHtml(error.message)}</p>`;
    }
}

function render(settings, categories, methods, tags) {
    const monthKey = getSelectedMonth();
    root.innerHTML = `
        ${renderFinanceSubnav('config')}
        ${renderFinancePageHeader({
            title: 'Configuración',
            subtitle: 'Preferencias de tu contabilidad privada',
            monthKey,
            showMonth: false
        })}

        <form id="finSettingsForm" class="fin-config-grid admin-form">
            <section class="fin-panel">
                <h3>Preferencias generales</h3>
                <div class="admin-field">
                    <label for="finCurrency">Moneda</label>
                    <select id="finCurrency">
                        <option value="COP" ${settings.currency === 'COP' ? 'selected' : ''}>COP — Peso colombiano</option>
                        <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD — Dólar</option>
                        <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>EUR — Euro</option>
                    </select>
                </div>
                <div class="admin-field">
                    <label for="finLocale">Idioma / región</label>
                    <select id="finLocale">
                        <option value="es-CO" ${settings.locale === 'es-CO' ? 'selected' : ''}>Español (Colombia)</option>
                        <option value="es-ES" ${settings.locale === 'es-ES' ? 'selected' : ''}>Español (España)</option>
                        <option value="en-US" ${settings.locale === 'en-US' ? 'selected' : ''}>English (US)</option>
                    </select>
                </div>
                <div class="admin-field">
                    <label for="finNumberFormat">Formato numérico</label>
                    <select id="finNumberFormat">
                        <option value="es-CO" ${settings.number_format === 'es-CO' ? 'selected' : ''}>1.234.567 (es-CO)</option>
                        <option value="en-US" ${settings.number_format === 'en-US' ? 'selected' : ''}>1,234,567 (en-US)</option>
                    </select>
                </div>
                <div class="admin-field">
                    <label for="finFiscalStart">Inicio del año fiscal</label>
                    <select id="finFiscalStart">
                        ${Array.from({ length: 12 }, (_, i) => {
                            const m = i + 1;
                            const labels = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
                            return `<option value="${m}" ${Number(settings.fiscal_year_start_month) === m ? 'selected' : ''}>${labels[i]}</option>`;
                        }).join('')}
                    </select>
                </div>
                <button type="submit" class="admin-btn-primary">Guardar preferencias</button>
                <span class="admin-form-error" id="finSettingsError"></span>
                <span class="fin-success" id="finSettingsOk" hidden>Guardado</span>
            </section>

            <section class="fin-panel">
                <h3>Categorías</h3>
                <ul class="fin-chip-list">
                    ${categories.map((c) => `<li><span class="fin-chip" style="--c:${escapeHtml(c.color_hex)}">${escapeHtml(c.name)} <small>${c.kind}</small></span></li>`).join('') || '<li class="fin-muted">Sin categorías</li>'}
                </ul>
                <div class="fin-inline-form">
                    <input type="text" id="finNewCategory" placeholder="Nueva categoría">
                    <select id="finNewCategoryKind">
                        <option value="income">Ingreso</option>
                        <option value="expense">Gasto</option>
                        <option value="both">Ambos</option>
                    </select>
                    <button type="button" class="admin-btn-secondary" id="finAddCategory">Agregar</button>
                </div>
            </section>

            <section class="fin-panel">
                <h3>Métodos de pago</h3>
                <ul class="fin-chip-list">
                    ${methods.map((m) => `<li><span class="fin-chip">${escapeHtml(m.name)}</span></li>`).join('') || '<li class="fin-muted">Sin métodos</li>'}
                </ul>
                <div class="fin-inline-form">
                    <input type="text" id="finNewMethod" placeholder="Nuevo método">
                    <button type="button" class="admin-btn-secondary" id="finAddMethod">Agregar</button>
                </div>
            </section>

            <section class="fin-panel">
                <h3>Etiquetas</h3>
                <ul class="fin-chip-list">
                    ${tags.map((t) => `<li><span class="fin-chip" style="--c:${escapeHtml(t.color_hex)}">${escapeHtml(t.name)}</span></li>`).join('') || '<li class="fin-muted">Sin etiquetas</li>'}
                </ul>
                <div class="fin-inline-form">
                    <input type="text" id="finNewTag" placeholder="Nueva etiqueta">
                    <button type="button" class="admin-btn-secondary" id="finAddTag">Agregar</button>
                </div>
            </section>
        </form>
    `;

    document.getElementById('finSettingsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = document.getElementById('finSettingsError');
        const okEl = document.getElementById('finSettingsOk');
        errorEl.classList.remove('active');
        okEl.hidden = true;
        try {
            await updateFinanceSettings({
                currency: document.getElementById('finCurrency').value,
                locale: document.getElementById('finLocale').value,
                number_format: document.getElementById('finNumberFormat').value,
                fiscal_year_start_month: Number(document.getElementById('finFiscalStart').value)
            });
            okEl.hidden = false;
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.classList.add('active');
        }
    });

    document.getElementById('finAddCategory')?.addEventListener('click', async () => {
        const name = document.getElementById('finNewCategory').value.trim();
        if (!name) return;
        await createCategory({
            name,
            kind: document.getElementById('finNewCategoryKind').value
        });
        init();
    });

    document.getElementById('finAddMethod')?.addEventListener('click', async () => {
        const name = document.getElementById('finNewMethod').value.trim();
        if (!name) return;
        await createPaymentMethod({ name });
        init();
    });

    document.getElementById('finAddTag')?.addEventListener('click', async () => {
        const name = document.getElementById('finNewTag').value.trim();
        if (!name) return;
        await createTag({ name });
        init();
    });
}

init();
