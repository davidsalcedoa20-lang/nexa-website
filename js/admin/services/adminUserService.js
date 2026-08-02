/* ==========================================================
   NEXA HUB — Servicio: gestión de administradores
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function extractFunctionsError(error, data) {
    // supabase.functions.invoke a menudo deja solo "non-2xx status";
    // el mensaje real puede venir en data o en error.context (Response).
    if (data && typeof data === 'object' && data.error) return String(data.error);

    const ctx = error?.context;
    if (!ctx) return error?.message || 'Error al gestionar administradores.';

    try {
        if (typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) return String(body.error);
            if (typeof body?.message === 'string' && body.message) return body.message;
        } else if (typeof ctx.text === 'function') {
            const text = await ctx.text();
            if (text) {
                try {
                    const parsed = JSON.parse(text);
                    if (parsed?.error) return String(parsed.error);
                } catch (_) {
                    return text.slice(0, 300);
                }
            }
        }
    } catch (_) { /* ignore */ }

    return error?.message || 'Error al gestionar administradores.';
}

async function invokeManageAdmin(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke('manage-admin', {
        body: { action, ...payload }
    });
    if (error) {
        throw new Error(await extractFunctionsError(error, data));
    }
    if (data?.error) throw new Error(data.error);
    return data;
}

export async function createAdmin(payload) {
    return invokeManageAdmin('create', payload);
}

export async function updateAdmin(payload) {
    return invokeManageAdmin('update', payload);
}

export async function resetAdminPassword(userId, password) {
    return invokeManageAdmin('resetPassword', { user_id: userId, password });
}

export async function setAdminActive(userId, isActive) {
    return invokeManageAdmin('setActive', { user_id: userId, is_active: isActive });
}

export async function deleteAdmin(userId) {
    return invokeManageAdmin('delete', { user_id: userId });
}

/** Sube avatar para un usuario (staff). Devuelve URL pública. */
export async function uploadAdminAvatar(userId, file) {
    if (!file) throw new Error('Selecciona una imagen.');
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
        throw new Error('Formato no permitido. Usa JPG, PNG, WEBP o GIF.');
    }
    if (file.size > MAX_AVATAR_BYTES) {
        throw new Error('La foto no puede superar 2 MB.');
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;

    const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    if (!pub?.publicUrl) throw new Error('No se pudo obtener la URL del avatar.');
    return pub.publicUrl;
}
