/* ==========================================================
   NEXA HUB — Página: listado Empleados
   ========================================================== */
import {
    listEmployees, createEmployee, getEmployeeStats
} from '../../services/employeeService.js';
import { generateTemporaryPassword } from '../../utils/passwordGenerator.js';
import { escapeHtml } from '../../components/projectUi.js';

const COLORS = ['#2D8CFF', '#8C52FF', '#FF2D95', '#4ADE80', '#FF8A3D', '#FFC15F', '#5FA8FF', '#C9A8FF'];

const grid = document.getElementById('empGrid');
const empty = document.getElementById('empEmpty');
const loading = document.getElementById('empLoading');
const newBtn = document.getElementById('empNewBtn');
const overlay = document.getElementById('empModalOverlay');
const form = document.getElementById('empForm');
const errorEl = document.getElementById('empFormError');
const colorRow = document.getElementById('empColorRow');
const photoInput = document.getElementById('empPhoto');
const photoPreview = document.getElementById('empPhotoPreview');
const passGen = document.getElementById('empPassGenerate');
const passField = document.getElementById('empPassword');

let selectedColor = COLORS[0];
let photoDataUrl = null;

function initials(first, last) {
    return `${(first || '?')[0]}${(last || '?')[0]}`.toUpperCase();
}

function openModal() {
    form?.reset();
    errorEl.textContent = '';
    errorEl.classList.remove('active');
    selectedColor = COLORS[0];
    photoDataUrl = null;
    if (photoPreview) {
        photoPreview.innerHTML = '';
        photoPreview.style.background = selectedColor + '33';
    }
    renderColors();
    if (passField) passField.value = generateTemporaryPassword();
    overlay?.classList.add('active');
}

function closeModal() {
    overlay?.classList.remove('active');
}

function renderColors() {
    if (!colorRow) return;
    colorRow.innerHTML = COLORS.map((c) =>
        `<button type="button" class="emp-color-swatch${c === selectedColor ? ' is-selected' : ''}" style="--c:${c}" data-color="${c}" aria-label="${c}"></button>`
    ).join('');
    colorRow.querySelectorAll('[data-color]').forEach((btn) => {
        btn.addEventListener('click', () => {
            selectedColor = btn.getAttribute('data-color');
            renderColors();
        });
    });
}

async function load() {
    if (loading) loading.style.display = 'flex';
    if (empty) empty.style.display = 'none';
    if (grid) grid.innerHTML = '';

    try {
        const employees = await listEmployees();
        if (loading) loading.style.display = 'none';

        if (!employees.length) {
            if (empty) empty.style.display = 'block';
            return;
        }

        const cards = await Promise.all(employees.map(async (emp) => {
            const stats = await getEmployeeStats(emp.id).catch(() => ({
                active: 0, delivered: 0, nextDelivery: null, lastActivity: null, productivity: 0
            }));
            const name = `${emp.first_name} ${emp.last_name}`;
            const role = emp.employee_roles?.label || emp.role_key;
            const email = emp.profiles?.email || '';
            const avatar = emp.photo_url
                ? `<img src="${escapeHtml(emp.photo_url)}" alt="">`
                : escapeHtml(initials(emp.first_name, emp.last_name));
            const nextDate = stats.nextDelivery
                ? new Date(`${stats.nextDelivery}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                : '—';
            const lastAct = stats.lastActivity
                ? new Date(stats.lastActivity).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                : '—';

            return `
                <a class="emp-card emp-card--dash" href="empleado.html?id=${emp.id}" style="--emp-color:${escapeHtml(emp.color_hex || '#2D8CFF')}">
                    <div class="emp-card-top">
                        <div class="emp-avatar">${avatar}</div>
                        <div>
                            <h3 class="emp-card-name">${escapeHtml(name)}</h3>
                            <p class="emp-card-role">${escapeHtml(role)}</p>
                        </div>
                    </div>
                    <div class="emp-card-meta">
                        <span class="emp-pill ${emp.status === 'active' ? 'is-active' : 'is-inactive'}">${emp.status === 'active' ? 'Activo' : 'Inactivo'}</span>
                        <span>${escapeHtml(email)}</span>
                    </div>
                    <div class="emp-dash-grid">
                        <div><span>Activos</span><strong>${stats.active ?? stats.pending ?? 0}</strong></div>
                        <div><span>Terminados</span><strong>${stats.delivered ?? 0}</strong></div>
                        <div><span>Próxima entrega</span><strong>${escapeHtml(nextDate)}</strong></div>
                        <div><span>Última actividad</span><strong>${escapeHtml(lastAct)}</strong></div>
                    </div>
                </a>
            `;
        }));

        if (grid) grid.innerHTML = cards.join('');
    } catch (err) {
        console.error('[empleados]', err);
        if (loading) loading.style.display = 'none';
        if (empty) {
            empty.style.display = 'block';
            empty.innerHTML = `<p>No se pudieron cargar los empleados: ${escapeHtml(err.message)}</p>`;
        }
    }
}

newBtn?.addEventListener('click', openModal);
document.getElementById('empModalClose')?.addEventListener('click', closeModal);
document.getElementById('empModalCancel')?.addEventListener('click', closeModal);
overlay?.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

passGen?.addEventListener('click', () => {
    if (passField) {
        passField.type = 'text';
        passField.value = generateTemporaryPassword();
    }
});

photoInput?.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
        errorEl.textContent = 'La foto es muy pesada (máx. 800 KB). Puedes crear el empleado sin foto.';
        errorEl.classList.add('active');
        photoInput.value = '';
        photoDataUrl = null;
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        photoDataUrl = reader.result;
        if (photoPreview) photoPreview.innerHTML = `<img class="emp-photo-preview" src="${photoDataUrl}" alt="">`;
    };
    reader.readAsDataURL(file);
});

form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('active');

    const payload = {
        first_name: form.first_name.value.trim(),
        last_name: form.last_name.value.trim(),
        email: form.email.value.trim().toLowerCase(),
        password: form.password.value.trim(),
        role_key: form.role_key.value,
        status: form.status.value,
        color_hex: selectedColor,
        photo_url: photoDataUrl
    };

    if (!payload.first_name || !payload.last_name || !payload.email || !payload.password) {
        errorEl.textContent = 'Completa los campos obligatorios.';
        errorEl.classList.add('active');
        return;
    }

    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;

    try {
        const result = await createEmployee(payload);
        closeModal();
        await load();
        if (result?.temporaryPassword) {
            window.alert(`Empleado creado.\nCorreo: ${result.email}\nContraseña temporal: ${result.temporaryPassword}\n\nCópiala y envíasela al editor.`);
        }
    } catch (err) {
        console.error('[empleados] create', err);
        errorEl.textContent = err.message || 'No se pudo crear.';
        errorEl.classList.add('active');
    } finally {
        if (submit) submit.disabled = false;
    }
});

if (new URLSearchParams(location.search).get('nuevo') === '1') {
    openModal();
}

load();
