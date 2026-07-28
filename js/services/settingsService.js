/* ==========================================================
   NEXA HUB — Servicio: Configuración (settings)
   ==========================================================
   ÚNICA vía de comunicación con Supabase para el módulo
   Configuración (admin y cliente). Cubre:
     - Lectura / actualización del perfil (profiles)
     - Empresa del cliente (workspaces.name)
     - Foto de perfil (bucket Storage "avatars" + avatar_url)
     - Cambio de contraseña (Auth)
     - Cierre de sesión (Auth)

   No duplica lógica de portal.js ni de profileService.js
   (ese último sigue siendo solo lecturas auxiliares para
   selectores de proyectos/tareas).
   ========================================================== */
import { supabase } from './supabaseClient.js';

const AVATAR_BUCKET = 'avatars';
const MIN_PASSWORD_LENGTH = 8;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Perfil del usuario autenticado + (si es cliente) su workspace.
 * @returns {Promise<{profile:object, workspace:object|null, user:object}>}
 */
export async function getMySettings() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData?.user) throw new Error('No hay una sesión activa.');

    const userId = authData.user.id;

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, full_name, email, phone, avatar_url, job_title, preference_theme, preference_language, is_active')
        .eq('id', userId)
        .single();
    if (profileError) throw profileError;

    let workspace = null;
    if (profile.role === 'client') {
        const { data: ws, error: wsError } = await supabase
            .from('workspaces')
            .select('id, name, city, notes')
            .eq('client_id', userId)
            .maybeSingle();
        if (wsError) throw wsError;
        workspace = ws;
    }

    return { profile, workspace, user: authData.user };
}

/**
 * Actualiza los campos editables del perfil propio.
 * Admin: full_name, phone, job_title, preferencias.
 * Cliente: full_name, phone (+ empresa vía updateMyCompany).
 *
 * @param {{full_name?:string, phone?:string|null, job_title?:string|null, preference_theme?:string, preference_language?:string, avatar_url?:string|null}} payload
 */
export async function updateMyProfile(payload) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) throw new Error('No hay una sesión activa.');

    const update = {};
    if (payload.full_name !== undefined) update.full_name = payload.full_name;
    if (payload.phone !== undefined) update.phone = payload.phone || null;
    if (payload.job_title !== undefined) update.job_title = payload.job_title || null;
    if (payload.preference_theme !== undefined) update.preference_theme = payload.preference_theme;
    if (payload.preference_language !== undefined) update.preference_language = payload.preference_language;
    if (payload.avatar_url !== undefined) update.avatar_url = payload.avatar_url;

    const { data, error } = await supabase
        .from('profiles')
        .update(update)
        .eq('id', authData.user.id)
        .select('id, role, full_name, email, phone, avatar_url, job_title, preference_theme, preference_language')
        .single();
    if (error) throw error;

    // Mantener user_metadata.full_name alineado (útil en Auth / triggers).
    if (payload.full_name) {
        await supabase.auth.updateUser({ data: { full_name: payload.full_name } });
    }

    return data;
}

/** Actualiza el nombre de la empresa (workspace) del cliente autenticado. */
export async function updateMyCompany(companyName) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) throw new Error('No hay una sesión activa.');

    const name = (companyName || '').trim();
    if (!name) throw new Error('El nombre de la empresa es obligatorio.');

    const { data, error } = await supabase
        .from('workspaces')
        .update({ name })
        .eq('client_id', authData.user.id)
        .select('id, name')
        .single();
    if (error) throw error;
    return data;
}

/**
 * Sube la foto de perfil al bucket "avatars" y guarda la URL
 * pública en profiles.avatar_url. Si Storage no está disponible,
 * lanza un error amigable para que la UI lo muestre.
 *
 * @param {File} file
 * @returns {Promise<{avatar_url:string, profile:object}>}
 */
export async function uploadMyAvatar(file) {
    if (!file) throw new Error('Selecciona una imagen.');
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
        throw new Error('Formato no válido. Usa JPG, PNG, WEBP o GIF.');
    }
    if (file.size > MAX_AVATAR_BYTES) {
        throw new Error('La imagen no puede superar los 2 MB.');
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) throw new Error('No hay una sesión activa.');

    const userId = authData.user.id;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const storagePath = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type
        });

    if (uploadError) {
        throw new Error(
            uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')
                ? 'El almacenamiento de fotos aún no está configurado. Aplica la migración de Configuración en Supabase.'
                : `No se pudo subir la imagen: ${uploadError.message}`
        );
    }

    const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(storagePath);
    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    const profile = await updateMyProfile({ avatar_url: avatarUrl });
    return { avatar_url: avatarUrl, profile };
}

/**
 * Cambia la contraseña del usuario autenticado.
 * Verifica la contraseña actual con un re-login silencioso.
 */
export async function changeMyPassword({ currentPassword, newPassword, confirmPassword }) {
    if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error('Completa todos los campos de contraseña.');
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    if (newPassword !== confirmPassword) {
        throw new Error('Las contraseñas nuevas no coinciden.');
    }
    if (currentPassword === newPassword) {
        throw new Error('La nueva contraseña debe ser distinta a la actual.');
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user?.email) throw new Error('No hay una sesión activa.');

    const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: authData.user.email,
        password: currentPassword
    });
    if (verifyError) {
        throw new Error('La contraseña actual no es correcta.');
    }

    const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false }
    });
    if (updateError) throw updateError;

    return { success: true };
}

/** Cierra la sesión de Supabase Auth. */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export { MIN_PASSWORD_LENGTH, MAX_AVATAR_BYTES, ALLOWED_AVATAR_TYPES };
