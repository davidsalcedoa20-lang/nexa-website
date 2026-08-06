import { listEmployees, getEmployeeStats } from '../../services/employeeService.js';
import { escapeHtml } from '../../components/projectUi.js';

const grid = document.getElementById('empRendGrid');

async function load() {
    if (!grid) return;
    const employees = await listEmployees();
    if (!employees.length) {
        grid.innerHTML = '<div class="emp-empty">Sin empleados aún.</div>';
        return;
    }

    const cards = await Promise.all(employees.map(async (emp) => {
        const stats = await getEmployeeStats(emp.id);
        const name = `${emp.first_name} ${emp.last_name}`;
        return `
            <a class="emp-card" href="empleado.html?id=${emp.id}" style="--emp-color:${escapeHtml(emp.color_hex || '#2D8CFF')}">
                <h3 class="emp-card-name">${escapeHtml(name)}</h3>
                <p class="emp-card-role">${escapeHtml(emp.employee_roles?.label || emp.role_key)}</p>
                <div class="emp-stats" style="grid-template-columns:1fr 1fr;margin-top:8px">
                    <div class="emp-stat"><span>Productividad</span><strong>${stats.productivity}%</strong></div>
                    <div class="emp-stat"><span>Entregados</span><strong>${stats.delivered}</strong></div>
                    <div class="emp-stat"><span>Pendientes</span><strong>${stats.pending}</strong></div>
                </div>
            </a>
        `;
    }));
    grid.innerHTML = cards.join('');
}

load().catch((e) => {
    if (grid) grid.innerHTML = `<div class="emp-empty">${escapeHtml(e.message)}</div>`;
});
