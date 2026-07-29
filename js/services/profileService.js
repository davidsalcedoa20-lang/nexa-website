/* ==========================================================
   NEXA HUB — Servicio: Perfiles (solo lecturas auxiliares)
   ========================================================== */
import { supabase } from './supabaseClient.js';

/** Lista los administradores de NEXA (para asignar "responsable"). */
export async function listAdmins() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, job_title')
        .eq('role', 'admin')
        .order('full_name', { ascending: true });
    if (error) throw error;
    return data;
}

/** Lista clientes activos con su workspace (para el selector de "cliente" al crear un proyecto). */
export async function listClientWorkspaces() {
    const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, client_id, profiles:client_id ( id, full_name, email )')
        .eq('status', 'active')
        .order('name', { ascending: true });
    if (error) throw error;
    return data;
}
