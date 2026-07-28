/* ==========================================================
   NEXA HUB — Helpers UI del Calendario (compartidos)
   ==========================================================
   Lógica pura de calendario mensual + render de celdas.
   No habla con Supabase: eso vive en calendarService.js.
   ========================================================== */
import { CALENDAR_EVENT_TYPE_COLORS, escapeHtml, formatDateTime } from './projectUi.js';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function getMonthLabel(year, monthIndex) {
    return `${MONTH_LABELS[monthIndex]} ${year}`;
}

export function getWeekdayLabels() {
    return WEEKDAY_LABELS.slice();
}

/** Genera las celdas del mes (incluye días del mes anterior/siguiente para completar la grilla). */
export function buildMonthCells(year, monthIndex) {
    const firstOfMonth = new Date(year, monthIndex, 1);
    // Lunes = 0 ... Domingo = 6
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i += 1) {
        const day = daysInPrevMonth - startWeekday + i + 1;
        cells.push({
            date: new Date(year, monthIndex - 1, day),
            day,
            inCurrentMonth: false
        });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push({
            date: new Date(year, monthIndex, day),
            day,
            inCurrentMonth: true
        });
    }
    while (cells.length % 7 !== 0) {
        const day = cells.length - (startWeekday + daysInMonth) + 1;
        cells.push({
            date: new Date(year, monthIndex + 1, day),
            day,
            inCurrentMonth: false
        });
    }
    return cells;
}

export function toDateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function groupEventsByDate(events) {
    const map = new Map();
    (events || []).forEach((event) => {
        const key = toDateKey(event.start_date);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(event);
    });
    return map;
}

export function isSameDay(a, b) {
    return toDateKey(a) === toDateKey(b);
}

export function formatEventTime(event) {
    if (event.all_day) return 'Todo el día';
    const start = new Date(event.start_date);
    if (Number.isNaN(start.getTime())) return '';
    return start.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export function formatEventRange(event) {
    if (event.all_day) {
        return `Todo el día · ${formatDateTime(event.start_date).split(',').slice(0, 1).join('') || formatDateTime(event.start_date)}`;
    }
    const start = formatDateTime(event.start_date);
    if (!event.end_date) return start;
    return `${start} → ${formatDateTime(event.end_date)}`;
}

/**
 * Renderiza la grilla mensual dentro de un contenedor.
 * @param {HTMLElement} container
 * @param {{year:number, monthIndex:number, events:Array, onDayClick?:Function, onEventClick?:Function, editable?:boolean}} options
 */
export function renderMonthGrid(container, options) {
    if (!container) return;

    const { year, monthIndex, events, onDayClick, onEventClick } = options;
    const cells = buildMonthCells(year, monthIndex);
    const byDate = groupEventsByDate(events);
    const todayKey = toDateKey(new Date());

    const weekdaysHtml = WEEKDAY_LABELS
        .map((label) => `<div class="cal-weekday">${label}</div>`)
        .join('');

    const cellsHtml = cells.map((cell) => {
        const key = toDateKey(cell.date);
        const dayEvents = byDate.get(key) || [];
        const isToday = key === todayKey;
        const classes = [
            'cal-day',
            cell.inCurrentMonth ? 'is-current' : 'is-outside',
            isToday ? 'is-today' : '',
            dayEvents.length ? 'has-events' : ''
        ].filter(Boolean).join(' ');

        const chips = dayEvents.slice(0, 3).map((event) => {
            const color = CALENDAR_EVENT_TYPE_COLORS[event.type] || '#2D8CFF';
            return `<button type="button" class="cal-event-chip" data-event-id="${event.id}" style="--event-color:${color}" title="${escapeHtml(event.title)}">${escapeHtml(event.title)}</button>`;
        }).join('');

        const more = dayEvents.length > 3
            ? `<span class="cal-event-more">+${dayEvents.length - 3}</span>`
            : '';

        return `
            <div class="${classes}" data-date="${key}">
                <button type="button" class="cal-day-number" data-day-btn="${key}">${cell.day}</button>
                <div class="cal-day-events">${chips}${more}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="cal-weekdays">${weekdaysHtml}</div>
        <div class="cal-days">${cellsHtml}</div>
    `;

    if (onDayClick) {
        container.querySelectorAll('[data-day-btn]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                onDayClick(btn.getAttribute('data-day-btn'));
            });
        });
        container.querySelectorAll('.cal-day').forEach((dayEl) => {
            dayEl.addEventListener('click', (e) => {
                if (e.target.closest('[data-event-id]')) return;
                onDayClick(dayEl.getAttribute('data-date'));
            });
        });
    }

    if (onEventClick) {
        container.querySelectorAll('[data-event-id]').forEach((chip) => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                onEventClick(chip.getAttribute('data-event-id'));
            });
        });
    }
}

/** Rango ISO [inicio, fin] del mes visible (incluye celdas fuera del mes). */
export function getVisibleRangeIso(year, monthIndex) {
    const cells = buildMonthCells(year, monthIndex);
    const first = cells[0].date;
    const last = cells[cells.length - 1].date;
    const from = new Date(first);
    from.setHours(0, 0, 0, 0);
    const to = new Date(last);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
}

/** Convierte datetime-local value a ISO. */
export function localInputToIso(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

/** Convierte ISO a valor datetime-local (YYYY-MM-DDTHH:mm). */
export function isoToLocalInput(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Valor date (YYYY-MM-DD) a inicio/fin del día en ISO. */
export function dateKeyToStartIso(dateKey) {
    const date = new Date(`${dateKey}T09:00:00`);
    return date.toISOString();
}

export function dateKeyToEndIso(dateKey) {
    const date = new Date(`${dateKey}T10:00:00`);
    return date.toISOString();
}
