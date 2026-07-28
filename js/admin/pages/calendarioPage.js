/* ==========================================================
   NEXA HUB — Página: Calendario (admin/calendario.html)
   ==========================================================
   Vista mensual + CRUD de calendar_events. El evento siempre
   se asocia a un proyecto (y por tanto a su workspace/cliente).
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';
import {
    listAllCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent
} from '../../services/calendarService.js';
import { listProjects } from '../../services/projectService.js';
import {
    CALENDAR_EVENT_TYPE_LABELS,
    escapeHtml
} from '../../components/projectUi.js';
import {
    getMonthLabel,
    renderMonthGrid,
    getVisibleRangeIso,
    localInputToIso,
    isoToLocalInput,
    dateKeyToStartIso,
    dateKeyToEndIso,
    formatEventTime
} from '../../components/calendarUi.js';

function el(id) { return document.getElementById(id); }

let currentUserId = null;
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let events = [];
let projects = [];
let editingEventId = null;

async function init() {
    const { data: authData } = await supabase.auth.getUser();
    currentUserId = authData?.user?.id || null;

    try {
        projects = await listProjects();
        populateProjectSelect();
        await loadMonth();
        subscribeRealtime();
    } catch (error) {
        console.error('[calendarioPage] Error inicializando:', error.message);
        if (el('calLoadingState')) el('calLoadingState').textContent = `No se pudo cargar el calendario: ${error.message}`;
    }
}

function populateProjectSelect() {
    const select = el('eventProject');
    if (!select) return;
    select.innerHTML = '<option value="">Selecciona un proyecto...</option>' +
        projects.map((p) => {
            const client = p.workspaces?.profiles?.full_name || p.workspaces?.name || '';
            const label = client ? `${p.name} — ${client}` : p.name;
            return `<option value="${p.id}" data-workspace="${p.workspace_id}">${escapeHtml(label)}</option>`;
        }).join('');
}

async function loadMonth() {
    if (el('calMonthLabel')) el('calMonthLabel').textContent = getMonthLabel(viewYear, viewMonth);
    if (el('calLoadingState')) el('calLoadingState').style.display = 'block';

    const range = getVisibleRangeIso(viewYear, viewMonth);
    try {
        events = await listAllCalendarEvents({ from: range.from, to: range.to });
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
        events: events.filter((e) => e.status !== 'cancelled'),
        onDayClick: (dateKey) => openEventModal(null, dateKey),
        onEventClick: (eventId) => {
            const event = events.find((e) => e.id === eventId);
            if (event) openEventModal(event);
        }
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
        btn.addEventListener('click', () => {
            const event = events.find((e) => e.id === btn.getAttribute('data-side-event'));
            if (event) openEventModal(event);
        });
    });
}

function openEventModal(event, dateKey) {
    editingEventId = event?.id || null;
    el('eventModalTitle').textContent = event ? 'Editar Evento' : 'Nuevo Evento';
    el('eventFormSubmitBtn').textContent = event ? 'Guardar cambios' : 'Crear Evento';
    el('eventDeleteBtn').style.display = event ? 'inline-flex' : 'none';
    el('eventFormError').textContent = '';
    el('eventFormError').classList.remove('active');

    el('eventTitle').value = event?.title || '';
    el('eventDescription').value = event?.description || '';
    el('eventType').value = event?.type || 'meeting';
    el('eventStatus').value = event?.status || 'scheduled';
    el('eventProject').value = event?.project_id || '';
    el('eventAllDay').checked = !!event?.all_day;
    el('eventLocation').value = event?.location || '';
    el('eventMeetingUrl').value = event?.meeting_url || '';

    if (event) {
        el('eventStart').value = isoToLocalInput(event.start_date);
        el('eventEnd').value = isoToLocalInput(event.end_date);
    } else if (dateKey) {
        el('eventStart').value = isoToLocalInput(dateKeyToStartIso(dateKey));
        el('eventEnd').value = isoToLocalInput(dateKeyToEndIso(dateKey));
    } else {
        const now = new Date();
        now.setMinutes(0, 0, 0);
        now.setHours(now.getHours() + 1);
        const end = new Date(now.getTime() + 60 * 60 * 1000);
        el('eventStart').value = isoToLocalInput(now.toISOString());
        el('eventEnd').value = isoToLocalInput(end.toISOString());
    }

    toggleAllDayFields();
    el('eventModalOverlay')?.classList.add('active');
}

function closeEventModal() {
    el('eventModalOverlay')?.classList.remove('active');
    editingEventId = null;
}

function toggleAllDayFields() {
    const allDay = el('eventAllDay')?.checked;
    if (el('eventStart')) el('eventStart').type = allDay ? 'date' : 'datetime-local';
    if (el('eventEnd')) el('eventEnd').type = allDay ? 'date' : 'datetime-local';

    // Al cambiar a date, recorta la parte de hora si venía de datetime-local.
    if (allDay) {
        if (el('eventStart').value.includes('T')) el('eventStart').value = el('eventStart').value.slice(0, 10);
        if (el('eventEnd').value.includes('T')) el('eventEnd').value = el('eventEnd').value.slice(0, 10);
    }
}

el('eventAllDay')?.addEventListener('change', toggleAllDayFields);

el('eventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = el('eventFormError');
    errorEl.classList.remove('active');

    const title = el('eventTitle').value.trim();
    const projectId = el('eventProject').value;
    const allDay = el('eventAllDay').checked;
    let startValue = el('eventStart').value;
    let endValue = el('eventEnd').value;

    if (!title) {
        errorEl.textContent = 'El título es obligatorio.';
        errorEl.classList.add('active');
        return;
    }
    if (!projectId) {
        errorEl.textContent = 'Selecciona un proyecto (y con él, el cliente asociado).';
        errorEl.classList.add('active');
        return;
    }
    if (!startValue) {
        errorEl.textContent = 'La fecha de inicio es obligatoria.';
        errorEl.classList.add('active');
        return;
    }

    if (allDay) {
        startValue = `${startValue}T00:00:00`;
        if (endValue) endValue = `${endValue}T23:59:59`;
    }

    const projectOption = el('eventProject').selectedOptions[0];
    const workspaceId = projectOption?.getAttribute('data-workspace') || null;

    const payload = {
        title,
        description: el('eventDescription').value.trim() || null,
        type: el('eventType').value,
        status: el('eventStatus').value,
        project_id: projectId,
        workspace_id: workspaceId,
        start_date: localInputToIso(startValue),
        end_date: endValue ? localInputToIso(endValue) : null,
        all_day: allDay,
        location: el('eventLocation').value.trim() || null,
        meeting_url: el('eventMeetingUrl').value.trim() || null,
        created_by: currentUserId
    };

    try {
        if (editingEventId) {
            await updateCalendarEvent(editingEventId, payload);
        } else {
            await createCalendarEvent(payload);
        }
        closeEventModal();
        await loadMonth();
    } catch (error) {
        errorEl.textContent = error.message || 'No se pudo guardar el evento.';
        errorEl.classList.add('active');
    }
});

el('eventDeleteBtn')?.addEventListener('click', async () => {
    if (!editingEventId) return;
    if (!window.confirm('¿Eliminar este evento? Esta acción no se puede deshacer.')) return;
    try {
        await deleteCalendarEvent(editingEventId);
        closeEventModal();
        await loadMonth();
    } catch (error) {
        alert(`No se pudo eliminar: ${error.message}`);
    }
});

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

el('newEventBtn')?.addEventListener('click', () => openEventModal(null));

document.querySelectorAll('[data-close-modal="eventModalOverlay"]').forEach((btn) => {
    btn.addEventListener('click', closeEventModal);
});
el('eventModalOverlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeEventModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el('eventModalOverlay')?.classList.contains('active')) closeEventModal();
});

function subscribeRealtime() {
    supabase
        .channel('admin-calendario-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
            loadMonth();
        })
        .subscribe();
}

init();
