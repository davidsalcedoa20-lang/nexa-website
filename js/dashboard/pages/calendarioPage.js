/* ==========================================================
   NEXA HUB — Página: Calendario (cliente)
   dashboard/calendario.html
   ==========================================================
   Solo lectura: el cliente ve los eventos de sus proyectos
   (RLS calendar_events_select_own). No puede crear/editar/
   eliminar — eso es exclusivo del admin.
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import { listCalendarEvents } from '../../services/calendarService.js';
import {
    CALENDAR_EVENT_TYPE_LABELS,
    CALENDAR_EVENT_TYPE_COLORS,
    escapeHtml,
    formatDateTime
} from '../../components/projectUi.js';
import {
    getMonthLabel,
    renderMonthGrid,
    getVisibleRangeIso,
    formatEventTime,
    formatEventRange
} from '../../components/calendarUi.js';

function el(id) { return document.getElementById(id); }

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let events = [];

async function init() {
    try {
        await loadMonth();
        subscribeRealtime();
    } catch (error) {
        console.error('[calendarioPage] Error inicializando:', error.message);
        if (el('calLoadingState')) el('calLoadingState').textContent = `No se pudo cargar el calendario: ${error.message}`;
    }
}

async function loadMonth() {
    if (el('calMonthLabel')) el('calMonthLabel').textContent = getMonthLabel(viewYear, viewMonth);
    if (el('calLoadingState')) el('calLoadingState').style.display = 'block';

    const range = getVisibleRangeIso(viewYear, viewMonth);
    try {
        events = await listCalendarEvents({ from: range.from, to: range.to });
        renderGrid();
        renderSideList();
    } catch (error) {
        console.error('[calendarioPage] Error cargando eventos:', error.message);
    } finally {
        if (el('calLoadingState')) el('calLoadingState').style.display = 'none';
    }
}

function renderGrid() {
    renderMonthGrid(el('calGrid'), {
        year: viewYear,
        monthIndex: viewMonth,
        events,
        onEventClick: (eventId) => openDetail(eventId)
    });
}

function renderSideList() {
    const list = el('calUpcomingList');
    const empty = el('calUpcomingEmpty');
    if (!list) return;

    const now = Date.now();
    const upcoming = events
        .filter((e) => e.status === 'scheduled' && new Date(e.start_date).getTime() >= now)
        .slice(0, 8);

    if (!upcoming.length) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    list.innerHTML = upcoming.map((event) => `
        <button type="button" class="cal-side-item" data-side-event="${event.id}">
            <span class="cal-side-time">${formatEventTime(event)}</span>
            <span class="cal-side-title">${escapeHtml(event.title)}</span>
            <span class="cal-side-meta">${escapeHtml(event.projects?.name || 'Proyecto')} · ${CALENDAR_EVENT_TYPE_LABELS[event.type] || event.type}</span>
        </button>
    `).join('');

    list.querySelectorAll('[data-side-event]').forEach((btn) => {
        btn.addEventListener('click', () => openDetail(btn.getAttribute('data-side-event')));
    });
}

function openDetail(eventId) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;

    el('eventDetailTitle').textContent = event.title;
    el('eventDetailType').textContent = CALENDAR_EVENT_TYPE_LABELS[event.type] || event.type;
    el('eventDetailType').style.color = CALENDAR_EVENT_TYPE_COLORS[event.type] || '#5FA8FF';
    el('eventDetailWhen').textContent = formatEventRange(event);
    el('eventDetailProject').textContent = event.projects?.name || '—';
    el('eventDetailLocation').textContent = event.location || '—';
    el('eventDetailDescription').textContent = event.description || 'Sin descripción.';

    const linkWrap = el('eventDetailLinkWrap');
    const link = el('eventDetailLink');
    if (event.meeting_url) {
        linkWrap.style.display = 'block';
        link.href = event.meeting_url;
        link.textContent = 'Abrir enlace de reunión';
    } else {
        linkWrap.style.display = 'none';
    }

    el('eventDetailModalOverlay')?.classList.add('active');
}

function closeDetail() {
    el('eventDetailModalOverlay')?.classList.remove('active');
}

el('calPrevBtn')?.addEventListener('click', async () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    await loadMonth();
});

el('calNextBtn')?.addEventListener('click', async () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    await loadMonth();
});

el('calTodayBtn')?.addEventListener('click', async () => {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    await loadMonth();
});

el('eventDetailModalClose')?.addEventListener('click', closeDetail);
el('eventDetailModalOverlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeDetail();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el('eventDetailModalOverlay')?.classList.contains('active')) closeDetail();
});

function subscribeRealtime() {
    supabase
        .channel('client-calendario-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
            loadMonth();
        })
        .subscribe();
}

init();
