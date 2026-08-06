import { listEmployees, listDeliveriesCalendar, getEmployeeStats } from '../../services/employeeService.js';
import { escapeHtml } from '../../components/projectUi.js';

const root = document.getElementById('empGlobalCalendar');

function ymd(d) { return d.toISOString().slice(0, 10); }

function nextDays(n = 21) {
    const out = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < n; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        out.push(d);
    }
    return out;
}

async function load() {
    if (!root) return;
    root.innerHTML = '<p class="fin-loading" style="color:#8a8a8a">Cargando calendario…</p>';
    const days = nextDays(21);
    const from = ymd(days[0]);
    const to = ymd(days[days.length - 1]);
    const tasks = await listDeliveriesCalendar({ from, to });

    root.innerHTML = days.map((d) => {
        const key = ymd(d);
        const dayTasks = tasks.filter((t) => t.delivery_date === key);
        const label = d.toLocaleDateString('es-CO', { weekday: 'short' });
        return `
            <div class="emp-day">
                <div class="emp-day-label">${escapeHtml(label)}<strong>${d.getDate()}</strong></div>
                ${dayTasks.map((t) => {
                    const emp = t.employee_projects?.employees;
                    const color = emp?.color_hex || '#8C52FF';
                    const who = emp ? `${emp.first_name} ${emp.last_name}` : '';
                    return `<div class="emp-day-task" style="--emp-color:${escapeHtml(color)}">
                        <strong>${escapeHtml(t.name)}</strong><br>
                        <span style="opacity:.75">${escapeHtml(who)}</span>
                    </div>`;
                }).join('') || '<span style="color:#555;font-size:11px">—</span>'}
            </div>
        `;
    }).join('');
}

load().catch((e) => {
    if (root) root.innerHTML = `<p class="emp-empty">${escapeHtml(e.message)}</p>`;
});
