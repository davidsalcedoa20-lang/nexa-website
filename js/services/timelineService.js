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
