/* ==========================================================
   NEXA HUB — UI helpers: Mi Agenda
   ========================================================== */
import { escapeHtml, getInitials } from './projectUi.js';

export const AGENDA_PRIORITY_LABELS = {
    critical: 'Urgente',
    high: 'Importante',
    medium: 'Programada',
    low: 'Programada'
};

export const AGENDA_PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

export const AGENDA_STATUS_LABELS = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    blocked: 'Bloqueada',
    completed: 'Completada'
};

/** Etiqueta visual de tarjeta: Completada gana sobre prioridad. */
export function getAgendaCardTone(task) {
    if (task.status === 'completed') {
        return { key: 'done', label: 'Completada' };
    }
    if (task.priority === 'critical') return { key: 'urgent', label: 'Urgente' };
    if (task.priority === 'high') return { key: 'important', label: 'Importante' };
    return { key: 'scheduled', label: 'Programada' };
}

/** Semana completa Lunes–Domingo (Workspace). */
export const WEEKDAY_LABELS = [
    'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
];

/** @deprecated Usar WEEKDAY_LABELS (7 días). Conservado por compatibilidad. */
export const WORKWEEK_LABELS = WEEKDAY_LABELS;

/** Lunes de la semana que contiene `date` (local). */
export function startOfWeek(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Dom
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

export function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

export function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function parseISODate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function isSameDay(a, b) {
    return toISODate(a) === toISODate(b);
}

export function formatAgendaTime(timeStr) {
    if (!timeStr) return '';
    return String(timeStr).slice(0, 5);
}

export function formatMinutes(minutes) {
    if (!minutes || minutes <= 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return `${m}m`;
    if (!m) return `${h}h`;
    return `${h}h ${m}m`;
}

export function formatRemainingMinutes(totalMinutes) {
    if (!totalMinutes || totalMinutes <= 0) return '0m';
    return formatMinutes(totalMinutes);
}

export function sortAgendaTasks(tasks) {
    const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...tasks].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (b.status === 'completed' && a.status !== 'completed') return -1;
        const pr = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
        if (pr !== 0) return pr;
        return (a.position ?? 0) - (b.position ?? 0);
    });
}

export function computeAgendaStats(tasks) {
    const today = toISODate(new Date());
    const todayTasks = tasks.filter((t) => t.task_date === today);
    const open = tasks.filter((t) => t.status !== 'completed');
    const urgent = open.filter((t) => t.priority === 'critical');
    const important = open.filter((t) => t.priority === 'high');
    const scheduled = open.filter((t) => t.priority === 'medium' || t.priority === 'low');
    const completed = tasks.filter((t) => t.status === 'completed');
    const remainingMinutes = todayTasks
        .filter((t) => t.status !== 'completed')
        .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

    const focusDone = todayTasks.filter((t) => t.status === 'completed').length;
    const focusTotal = todayTasks.length;
    const focusPercent = focusTotal ? Math.round((focusDone / focusTotal) * 100) : 0;

    return {
        todayCount: todayTasks.length,
        urgentCount: urgent.length,
        importantCount: important.length,
        scheduledCount: scheduled.length,
        completedCount: completed.length,
        remainingMinutes,
        focusDone,
        focusTotal,
        focusPercent
    };
}

export function computeDayProgress(tasks) {
    if (!tasks.length) return { percent: 0, remainingMinutes: 0, total: 0, done: 0 };
    const done = tasks.filter((t) => t.status === 'completed').length;
    const remainingMinutes = tasks
        .filter((t) => t.status !== 'completed')
        .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
    const percent = Math.round((done / tasks.length) * 100);
    return { percent, remainingMinutes, total: tasks.length, done };
}

/* ---------------------------------------------------------
   Toast ligero (estilo NEXA)
--------------------------------------------------------- */
let toastTimer = null;

export function showAgendaToast(message, type = 'success') {
    let el = document.getElementById('agendaToast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'agendaToast';
        el.className = 'agenda-toast';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
    }
    el.className = `agenda-toast agenda-toast--${type} is-visible`;
    el.textContent = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.classList.remove('is-visible');
    }, 2600);
}

export { escapeHtml, getInitials };
