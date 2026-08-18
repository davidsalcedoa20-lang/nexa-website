/* ==========================================================
   NEXA HUB — Servicio: Tipos de Proyecto (project_types)
   ========================================================== */
import { supabase } from './supabaseClient.js';

export async function listProjectTypes({ onlyActive = true } = {}) {
    if (!supabase) throw new Error('Supabase no está disponible.');
    let query = supabase.from('project_types').select('*').order('name', { ascending: true });
    if (onlyActive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}
