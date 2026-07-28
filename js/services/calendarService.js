/* ==========================================================
   NEXA HUB — Servicio: Calendario
   ==========================================================
   ÚNICO archivo que habla con la tabla public.calendar_events.
   Admin y cliente importan desde aquí. RLS filtra:
     - admin: todos los eventos
     - client: solo los de su workspace
   google_event_id se acepta/persiste pero NUNCA se sincroniza
   todavía con Google Calendar (preparado para el futuro).
   ========================================================== */
import { supabase } from './supabaseClient.js';

const EVENT_SELECT = `
    id, workspace_id, project_id, title, description, type,
    start_date, end_date, all_day, location, meeting_url,
    google_event_id, status, created_by, created_at, updated_at,
    projects:project_id ( id, name, color_hex ),
    workspaces:workspace_id (
        id, name, client_id,
        profiles:client_id ( id, full_name, email )
    )
`;

/**
 * Lista eventos. Opcionalmente filtra por rango de fechas
 * (útil para la vista mensual) y/o por project_id.
 * @param {{from?:string, to?:string, projectId?:string}} [filters]
 */
export async function listCalendarEvents(filters = {}) {
    let query = supabase
        .from('calendar_events')
        .select(EVENT_SELECT)
        .neq('status', 'cancelled')
        .order('start_date', { ascending: true });

    if (filters.from) query = query.gte('start_date', filters.from);
    if (filters.to) query = query.lte('start_date', filters.to);
    if (filters.projectId) query = query.eq('project_id', filters.projectId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/** Incluye cancelados (para edición admin). */
export async function listAllCalendarEvents(filters = {}) {
    let query = supabase
        .from('calendar_events')
        .select(EVENT_SELECT)
        .order('start_date', { ascending: true });

    if (filters.from) query = query.gte('start_date', filters.from);
    if (filters.to) query = query.lte('start_date', filters.to);
    if (filters.projectId) query = query.eq('project_id', filters.projectId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function getCalendarEvent(eventId) {
    const { data, error } = await supabase
        .from('calendar_events')
        .select(EVENT_SELECT)
        .eq('id', eventId)
        .single();
    if (error) throw error;
    return data;
}

/**
 * Crea un evento. workspace_id + project_id son obligatorios
 * (el cliente se deriva del workspace). Si solo se pasa project_id,
 * se resuelve el workspace automáticamente.
 *
 * @param {{
 *   workspace_id?:string, project_id:string, title:string,
 *   description?:string, type?:string, start_date:string,
 *   end_date?:string, all_day?:boolean, location?:string,
 *   meeting_url?:string, status?:string, created_by:string
 * }} payload
 */
export async function createCalendarEvent(payload) {
    let workspaceId = payload.workspace_id || null;

    if (!workspaceId && payload.project_id) {
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('workspace_id')
            .eq('id', payload.project_id)
            .single();
        if (projectError) throw projectError;
        workspaceId = project.workspace_id;
    }

    if (!workspaceId || !payload.project_id) {
        throw new Error('El evento debe asociarse a un cliente (workspace) y a un proyecto.');
    }

    const { data, error } = await supabase
        .from('calendar_events')
        .insert({
            workspace_id: workspaceId,
            project_id: payload.project_id,
            title: payload.title,
            description: payload.description || null,
            type: payload.type || 'meeting',
            start_date: payload.start_date,
            end_date: payload.end_date || null,
            all_day: !!payload.all_day,
            location: payload.location || null,
            meeting_url: payload.meeting_url || null,
            google_event_id: null,
            status: payload.status || 'scheduled',
            created_by: payload.created_by
        })
        .select(EVENT_SELECT)
        .single();
    if (error) throw error;
    return data;
}

export async function updateCalendarEvent(eventId, payload) {
    const allowed = {
        title: payload.title,
        description: payload.description,
        type: payload.type,
        start_date: payload.start_date,
        end_date: payload.end_date,
        all_day: payload.all_day,
        location: payload.location,
        meeting_url: payload.meeting_url,
        status: payload.status,
        project_id: payload.project_id,
        workspace_id: payload.workspace_id
    };

    // Si cambia el proyecto, sincroniza el workspace.
    if (payload.project_id && !payload.workspace_id) {
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('workspace_id')
            .eq('id', payload.project_id)
            .single();
        if (projectError) throw projectError;
        allowed.workspace_id = project.workspace_id;
    }

    Object.keys(allowed).forEach((key) => {
        if (allowed[key] === undefined) delete allowed[key];
    });

    const { data, error } = await supabase
        .from('calendar_events')
        .update(allowed)
        .eq('id', eventId)
        .select(EVENT_SELECT)
        .single();
    if (error) throw error;
    return data;
}

export async function deleteCalendarEvent(eventId) {
    const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);
    if (error) throw error;
}

/**
 * Próximo evento futuro (status = scheduled) desde ahora.
 * Admin: el más cercano de todos. Cliente: el más cercano de los suyos (RLS).
 */
export async function getNextCalendarEvent() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('calendar_events')
        .select(EVENT_SELECT)
        .eq('status', 'scheduled')
        .gte('start_date', now)
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data;
}
