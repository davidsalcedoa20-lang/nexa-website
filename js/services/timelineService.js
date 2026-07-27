/* ==========================================================
   NEXA HUB — Servicio: Cronología del proyecto (solo lectura)
   ==========================================================
   Los eventos se insertan automáticamente desde triggers de
   base de datos (ver migración create_projects_engine_functions_
   and_triggers.sql). El frontend nunca inserta aquí directamente.
   ========================================================== */
import { supabase } from './supabaseClient.js';

export async function listTimelineEvents(projectId) {
    const { data, error } = await supabase
        .from('project_timeline_events')
        .select('*, profiles:actor_id ( id, full_name )')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

/**
 * Actividad reciente de TODOS los proyectos (uso exclusivo del
 * Dashboard administrativo). RLS (project_timeline_events_admin_all)
 * ya garantiza que solo un admin puede ver eventos de cualquier
 * proyecto sin restricción.
 */
export async function listRecentActivityForAdmin(limit = 8) {
    const { data, error } = await supabase
        .from('project_timeline_events')
        .select('*, profiles:actor_id ( id, full_name ), projects:project_id ( id, name )')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data;
}
