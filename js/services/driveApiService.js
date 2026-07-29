/* ==========================================================
   NEXA HUB — DriveApiService
   ==========================================================
   Único punto del frontend que habla con la Edge Function
   "google-drive". No expone tokens; solo acciones de alto nivel.
   ========================================================== */
import { supabase } from './supabaseClient.js';

async function invokeDrive(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke('google-drive', {
        body: { action, ...payload }
    });

    if (error) {
        let message = error.message || 'Error al contactar Google Drive.';
        try {
            const ctx = error.context;
            if (ctx && typeof ctx.json === 'function') {
                const body = await ctx.json();
                if (body?.error) message = body.error;
            }
        } catch (_) { /* ignore */ }
        throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);
    return data;
}

export async function getDriveConfigStatus() {
    return invokeDrive('configStatus');
}

export async function getDriveConnectionStatus() {
    return invokeDrive('connectionStatus');
}

export async function getGoogleAuthUrl({ projectId = null, returnUrl = null } = {}) {
    return invokeDrive('getAuthUrl', { projectId, returnUrl });
}

export async function exchangeGoogleOAuthCode({ code, state }) {
    return invokeDrive('oauthExchange', { code, state });
}

export async function disconnectGoogleAccount() {
    return invokeDrive('disconnectAccount');
}

export async function listDriveFolders(folderId = 'root') {
    return invokeDrive('listFolders', { folderId });
}

export async function linkProjectDriveFolder(projectId, folderId) {
    return invokeDrive('linkFolder', { projectId, folderId });
}

export async function unlinkProjectDriveFolder(projectId) {
    return invokeDrive('unlinkFolder', { projectId });
}

export async function refreshProjectDriveStats(projectId) {
    return invokeDrive('refreshStats', { projectId });
}

export async function listProjectDriveFiles({
    projectId,
    folderId = null,
    search = '',
    filter = 'all',
    pageSize = 100
} = {}) {
    return invokeDrive('listFiles', { projectId, folderId, search, filter, pageSize });
}

/** Inicia el flujo OAuth (redirect completo). */
export async function startGoogleDriveOAuth({ projectId, returnUrl } = {}) {
    const { url } = await getGoogleAuthUrl({ projectId, returnUrl });
    if (!url) throw new Error('No se pudo obtener la URL de autorización de Google.');
    window.location.href = url;
}
