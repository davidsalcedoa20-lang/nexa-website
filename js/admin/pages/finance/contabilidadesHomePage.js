/* ==========================================================
   NEXA HUB — Finanzas: Mis Finanzas (home de libros)
   ========================================================== */
import {
    listFinanceBooks,
    getBooksCardStats,
    createFinanceBook,
    deleteFinanceBook,
    listBookShares,
    setBookShares,
    listShareableAdmins
} from '../../../services/financeService.js';
import { BOOK_COLORS } from '../../../components/finance/financeCatalog.js';
import { formatMoney } from '../../../components/finance/financeFormat.js';
import { escapeHtml } from '../../../components/projectUi.js';
import { supabase } from '../../../services/supabaseClient.js';

const root = document.getElementById('finRoot');
let books = [];
let selectedColor = BOOK_COLORS[0];
let currentUserId = null;
let currentRole = null;

function relativeTime(iso) {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `Hace ${days} día${days === 1 ? '' : 's'}`;
    return new Date(iso).toLocaleDateString('es-CO');
}

async function init() {
    if (!root) return;
    root.innerHTML = '<p class="fin-loading">Cargando tus finanzas…</p>';
    try {
        const { data: auth } = await supabase.auth.getUser();
        currentUserId = auth?.user?.id || null;
        if (currentUserId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', currentUserId)
                .maybeSingle();
            currentRole = profile?.role || null;
        }
        const list = await listFinanceBooks();
        books = await getBooksCardStats(list);
        render();
    } catch (error) {
        console.error('[finanzasHome]', error);
        root.innerHTML = `<p class="fin-error">No se pudo cargar Finanzas: ${escapeHtml(error.message)}</p>`;
    }
}

function isBookOwner(book) {
    return currentRole === 'owner' || book.admin_id === currentUserId;
}

function render() {
    root.innerHTML = `
        <div class="fin-page-header">
            <div class="fin-page-heading">
                <span class="fin-kicker">Finanzas</span>
                <h1>Mis Finanzas</h1>
                <p>Tu contabilidad privada. Compártela solo si lo necesitas. El Administrador Principal siempre tiene acceso.</p>
            </div>
            <button type="button" class="admin-btn-primary" id="finNewBookBtn">+ Nueva Contabilidad</button>
        </div>

        ${books.length ? `
            <div class="fin-books-grid" id="finBooksGrid">
                ${books.map(renderBookCard).join('')}
            </div>
        ` : `
            <div class="fin-books-empty">
                <h2>Aún no tienes contabilidades</h2>
                <p>Crea la primera. Solo pedimos nombre, descripción, color, moneda y fecha de inicio.</p>
                <button type="button" class="admin-btn-primary" id="finNewBookEmpty">+ Nueva Contabilidad</button>
            </div>
        `}

        <div class="admin-modal-overlay" id="finBookModal">
            <div class="admin-modal fin-entry-modal">
                <div class="admin-modal-header">
                    <h3>Nueva Contabilidad</h3>
                    <button type="button" class="admin-modal-close" id="finBookModalClose" aria-label="Cerrar">✕</button>
                </div>
                <form id="finBookForm" class="admin-form">
                    <div class="fin-form-grid">
                        <div class="admin-field fin-span-2">
                            <label>Nombre *</label>
                            <input name="name" required maxlength="80" placeholder="Ej. NEXA, Viaje Europa">
                        </div>
                        <div class="admin-field fin-span-2">
                            <label>Descripción</label>
                            <textarea name="description" rows="2" maxlength="240" placeholder="Breve (opcional)"></textarea>
                        </div>
                        <div class="admin-field">
                            <label>Moneda</label>
                            <select name="currency" class="admin-select">
                                <option value="COP">COP — Peso colombiano</option>
                                <option value="USD">USD — Dólar</option>
                                <option value="EUR">EUR — Euro</option>
                                <option value="MXN">MXN — Peso mexicano</option>
                            </select>
                        </div>
                        <div class="admin-field">
                            <label>Fecha de inicio</label>
                            <input type="date" name="start_date" required value="${new Date().toISOString().slice(0, 10)}">
                        </div>
                        <div class="admin-field fin-span-2">
                            <label>Color</label>
                            <div class="fin-color-picker" id="finColorPicker">
                                ${BOOK_COLORS.map((c) => `
                                    <button type="button" class="fin-color-swatch${c === selectedColor ? ' is-selected' : ''}"
                                        data-color="${c}" style="--swatch:${c}" aria-label="Color ${c}"></button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="admin-modal-actions">
                        <button type="button" class="admin-btn-secondary" id="finBookCancel">Cancelar</button>
                        <button type="submit" class="admin-btn-primary">Crear</button>
                    </div>
                </form>
            </div>
        </div>

        <div class="admin-modal-overlay" id="finShareModal">
            <div class="admin-modal fin-entry-modal">
                <div class="admin-modal-header">
                    <h3>Compartir con</h3>
                    <button type="button" class="admin-modal-close" id="finShareClose" aria-label="Cerrar">✕</button>
                </div>
                <p style="color:rgba(255,255,255,.55);font-size:13px;line-height:1.6;margin:0 0 14px">
                    Selecciona administradores que podrán ver esta contabilidad.
                    Si no compartes, solo tú y el Administrador Principal la verán.
                </p>
                <div id="finShareList" class="perm-project-checks"></div>
                <div class="admin-modal-actions">
                    <button type="button" class="admin-btn-secondary" id="finShareCancel">Cancelar</button>
                    <button type="button" class="admin-btn-primary" id="finShareSave">Guardar</button>
                </div>
            </div>
        </div>
    `;

    wireHome();
}

function renderBookCard(book) {
    const color = book.color_hex || '#8C52FF';
    const currency = book.currency || 'COP';
    const owned = isBookOwner(book);
    const sharedBadge = !owned
        ? '<span class="perm-role-badge" style="margin-bottom:8px">Compartida contigo</span>'
        : '';
    return `
        <article class="fin-book-card" style="--book-color:${escapeHtml(color)}">
            <div class="fin-book-card-top">
                <span class="fin-book-dot" aria-hidden="true"></span>
                <div style="display:flex;gap:6px">
                    ${owned ? `<button type="button" class="fin-icon-mini" data-share-book="${book.id}" title="Compartir">⇪</button>` : ''}
                    ${owned ? `<button type="button" class="fin-icon-mini" data-delete-book="${book.id}" title="Eliminar">✕</button>` : ''}
                </div>
            </div>
            ${sharedBadge}
            <h2>${escapeHtml(book.name)}</h2>
            <p class="fin-book-desc">${escapeHtml(book.description || 'Sin descripción')}</p>
            <div class="fin-book-meta">
                <div>
                    <span>Caja disponible</span>
                    <strong class="${Number(book.balance) < 0 ? 'is-neg' : ''}">${formatMoney(book.balance || 0, { currency })}</strong>
                </div>
                <div>
                    <span>Mes activo</span>
                    <strong>${escapeHtml(book.monthLabel || '—')}</strong>
                </div>
                <div>
                    <span>Última modificación</span>
                    <strong>${escapeHtml(relativeTime(book.updated_at))}</strong>
                </div>
            </div>
            <a class="admin-btn-primary fin-book-enter" href="contabilidad-libro.html?id=${encodeURIComponent(book.id)}">Entrar</a>
        </article>
    `;
}

function openModal() {
    selectedColor = BOOK_COLORS[0];
    document.getElementById('finBookModal')?.classList.add('active');
    document.querySelectorAll('.fin-color-swatch').forEach((btn) => {
        btn.classList.toggle('is-selected', btn.dataset.color === selectedColor);
    });
}

function closeModal() {
    document.getElementById('finBookModal')?.classList.remove('active');
    document.getElementById('finBookForm')?.reset();
}

let shareBookId = null;

async function openShareModal(bookId) {
    shareBookId = bookId;
    const listEl = document.getElementById('finShareList');
    const modal = document.getElementById('finShareModal');
    if (!listEl || !modal) return;
    listEl.innerHTML = '<p class="perm-empty">Cargando…</p>';
    modal.classList.add('active');
    try {
        const [admins, shares] = await Promise.all([
            listShareableAdmins(),
            listBookShares(bookId)
        ]);
        const selected = new Set(shares.map((s) => s.user_id));
        listEl.innerHTML = admins.length
            ? admins.map((a) => `
                <label class="perm-check">
                    <input type="checkbox" name="shareUser" value="${escapeHtml(a.id)}" ${selected.has(a.id) ? 'checked' : ''}>
                    <span>${escapeHtml(a.full_name || a.email || 'Admin')}</span>
                </label>
            `).join('')
            : '<p class="perm-empty">No hay otros administradores para compartir.</p>';
    } catch (error) {
        listEl.innerHTML = `<p class="fin-error">${escapeHtml(error.message)}</p>`;
    }
}

function closeShareModal() {
    shareBookId = null;
    document.getElementById('finShareModal')?.classList.remove('active');
}

function wireHome() {
    document.getElementById('finNewBookBtn')?.addEventListener('click', openModal);
    document.getElementById('finNewBookEmpty')?.addEventListener('click', openModal);
    document.getElementById('finBookModalClose')?.addEventListener('click', closeModal);
    document.getElementById('finBookCancel')?.addEventListener('click', closeModal);
    document.getElementById('finBookModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'finBookModal') closeModal();
    });

    document.getElementById('finShareClose')?.addEventListener('click', closeShareModal);
    document.getElementById('finShareCancel')?.addEventListener('click', closeShareModal);
    document.getElementById('finShareModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'finShareModal') closeShareModal();
    });
    document.getElementById('finShareSave')?.addEventListener('click', async () => {
        if (!shareBookId) return;
        const ids = [...document.querySelectorAll('input[name="shareUser"]:checked')].map((el) => el.value);
        try {
            await setBookShares(shareBookId, ids);
            closeShareModal();
        } catch (error) {
            alert(error.message || 'No se pudo guardar el compartir.');
        }
    });

    document.getElementById('finColorPicker')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-color]');
        if (!btn) return;
        selectedColor = btn.dataset.color;
        document.querySelectorAll('.fin-color-swatch').forEach((el) => {
            el.classList.toggle('is-selected', el.dataset.color === selectedColor);
        });
    });

    document.getElementById('finBookForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
            const book = await createFinanceBook({
                name: fd.get('name'),
                description: fd.get('description'),
                currency: fd.get('currency'),
                start_date: fd.get('start_date'),
                color_hex: selectedColor
            });
            window.location.href = `contabilidad-libro.html?id=${encodeURIComponent(book.id)}`;
        } catch (error) {
            alert(error.message || 'No se pudo crear la contabilidad.');
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    document.querySelectorAll('[data-delete-book]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-delete-book');
            const book = books.find((b) => b.id === id);
            if (!window.confirm(`¿Eliminar “${book?.name || 'esta contabilidad'}”? Se borrarán sus registros.`)) return;
            try {
                await deleteFinanceBook(id);
                books = books.filter((b) => b.id !== id);
                render();
            } catch (error) {
                alert(error.message || 'No se pudo eliminar.');
            }
        });
    });

    document.querySelectorAll('[data-share-book]').forEach((btn) => {
        btn.addEventListener('click', () => openShareModal(btn.getAttribute('data-share-book')));
    });
}

init();
