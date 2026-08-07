/* ==========================================================
   NEXA HUB — Servicio Clientes Express (sin Auth / portal)
   ========================================================== */
import { supabase } from '../supabase/client.js';

function requireAdminId() {
    return supabase.auth.getUser().then(({ data, error }) => {
        if (error) throw error;
        if (!data?.user?.id) throw new Error('Sesión no válida.');
        return data.user.id;
    });
}

function mapExpressClient(row) {
    if (!row) return null;
    return {
        kind: 'express',
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
        notes: row.notes || '',
        company: row.company || '',
        city: row.city || '',
        whatsapp: row.whatsapp || '',
        status: row.status || 'active',
        createdAt: row.created_at,
        // Compatibilidad con tabla unificada
        contact: row.full_name,
        email: 'Sin portal',
        workspaceId: null,
        profileId: null
    };
}

export async function listExpressClients() {
    const { data, error } = await supabase
        .from('express_clients')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapExpressClient);
}

export async function getExpressClient(id) {
    const { data, error } = await supabase
        .from('express_clients')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw error;
    return mapExpressClient(data);
}

export async function createExpressClient(payload) {
    const adminId = await requireAdminId();
    const full_name = String(payload.full_name || '').trim();
    if (!full_name) throw new Error('El nombre del cliente es obligatorio.');

    const { data, error } = await supabase
        .from('express_clients')
        .insert({
            full_name,
            phone: String(payload.phone || '').trim(),
            notes: String(payload.notes || '').trim(),
            company: payload.company?.trim() || null,
            city: payload.city?.trim() || null,
            whatsapp: payload.whatsapp?.trim() || null,
            status: 'active',
            created_by: adminId
        })
        .select()
        .single();
    if (error) throw error;
    return mapExpressClient(data);
}

export async function updateExpressClient(id, payload) {
    const full_name = String(payload.full_name || '').trim();
    if (!full_name) throw new Error('El nombre del cliente es obligatorio.');

    const { data, error } = await supabase
        .from('express_clients')
        .update({
            full_name,
            phone: String(payload.phone || '').trim(),
            notes: String(payload.notes || '').trim(),
            company: payload.company?.trim() || null,
            city: payload.city?.trim() || null,
            whatsapp: payload.whatsapp?.trim() || null,
            status: payload.status || 'active'
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return mapExpressClient(data);
}

export async function deleteExpressClient(id) {
    const { error } = await supabase
        .from('express_clients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

export async function countExpressProjects(expressClientId) {
    const { count, error } = await supabase
        .from('express_projects')
        .select('id', { count: 'exact', head: true })
        .eq('express_client_id', expressClientId)
        .is('deleted_at', null)
        .in('status', ['not_started', 'in_progress', 'paused', 'in_review']);
    if (error) {
        console.error('[expressClientService] count:', error.message);
        return 0;
    }
    return count || 0;
}

export async function listExpressProjects(expressClientId) {
    const { data, error } = await supabase
        .from('express_projects')
        .select('*')
        .eq('express_client_id', expressClientId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function createExpressProject(expressClientId, payload) {
    const adminId = await requireAdminId();
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('El nombre del proyecto es obligatorio.');

    const driveId = payload.drive_folder_id || null;
    const driveUrl = payload.drive_folder_url || null;
    const driveName = payload.drive_folder_name || null;

    const { data, error } = await supabase
        .from('express_projects')
        .insert({
            express_client_id: expressClientId,
            name,
            project_type: payload.project_type || 'Otro',
            start_date: payload.start_date || null,
            due_date: payload.due_date || null,
            status: payload.status || 'not_started',
            responsible_name: payload.responsible_name?.trim() || null,
            observations: payload.observations?.trim() || null,
            drive_folder_id: driveId,
            drive_folder_name: driveName,
            drive_folder_url: driveUrl,
            drive_connected: !!(driveId || driveUrl),
            created_by: adminId
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateExpressProject(id, payload) {
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('El nombre del proyecto es obligatorio.');

    const patch = {
        name,
        project_type: payload.project_type || 'Otro',
        start_date: payload.start_date || null,
        due_date: payload.due_date || null,
        status: payload.status || 'not_started',
        responsible_name: payload.responsible_name?.trim() || null,
        observations: payload.observations?.trim() || null
    };

    if (Object.prototype.hasOwnProperty.call(payload, 'drive_folder_id')) {
        patch.drive_folder_id = payload.drive_folder_id || null;
        patch.drive_folder_name = payload.drive_folder_name || null;
        patch.drive_folder_url = payload.drive_folder_url || null;
        patch.drive_connected = !!(payload.drive_folder_id || payload.drive_folder_url);
    }

    const { data, error } = await supabase
        .from('express_projects')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteExpressProject(id) {
    const { error } = await supabase
        .from('express_projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

/** Extrae ID de carpeta desde URL típica de Google Drive */
export function parseDriveFolderFromUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return { id: null, url: null };
    const match = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const id = match?.[1] || null;
    const folderUrl = id
        ? `https://drive.google.com/drive/folders/${id}`
        : (raw.startsWith('http') ? raw : null);
    return { id, url: folderUrl };
}
