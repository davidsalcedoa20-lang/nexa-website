// ==========================================================
// NEXA HUB — Edge Function: google-drive
// ==========================================================
// Proxy seguro de OAuth + Google Drive API.
// - Tokens viven en google_drive_connections (service_role).
// - Admin: conectar cuenta, vincular/cambiar/desconectar carpeta.
// - Cliente: solo listar/abrir dentro de la carpeta de SU proyecto.
//
// Secrets requeridos:
//   npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REDIRECT_URI=...
//
// GOOGLE_REDIRECT_URI ejemplo (página estática del admin):
//   https://tu-dominio.com/admin/drive-oauth-callback.html
//
// Despliegue:
//   npx supabase functions deploy google-drive
// ==========================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || '';

const DRIVE_SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
}

function adminDb() {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

async function getCaller(req: Request) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return { error: 'No autorizado: falta la sesión.', status: 401 as const };

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error } = await callerClient.auth.getUser();
    if (error || !user) return { error: 'Sesión inválida o expirada.', status: 401 as const };

    const db = adminDb();
    const { data: profile } = await db
        .from('profiles')
        .select('id, role, full_name, email')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile) return { error: 'Perfil no encontrado.', status: 403 as const };
    return { user, profile, db };
}

function requireGoogleConfig() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        return 'Google Drive no está configurado. Define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI en los secrets de Supabase.';
    }
    return null;
}

function randomState() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function exchangeCode(code: string) {
    const body = new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.error || 'No se pudo intercambiar el código OAuth.');
    return data as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope?: string;
    };
}

async function refreshAccessToken(refreshToken: string) {
    const body = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.error || 'No se pudo renovar el token de Google.');
    return data as { access_token: string; expires_in: number; scope?: string };
}

async function getGoogleEmail(accessToken: string) {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return { email: null, id: null };
    const data = await res.json();
    return { email: data.email || null, id: data.id || null };
}

async function getValidAccessToken(db: ReturnType<typeof adminDb>, userId: string) {
    const { data: conn, error } = await db
        .from('google_drive_connections')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    if (!conn) return null;

    const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
    const stillValid = conn.access_token && expiresAt > Date.now() + 60_000;
    if (stillValid) {
        return { accessToken: conn.access_token as string, connection: conn, tokenOwnerId: userId };
    }

    const refreshed = await refreshAccessToken(conn.refresh_token);
    const tokenExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
    await db.from('google_drive_connections').update({
        access_token: refreshed.access_token,
        token_expires_at: tokenExpiresAt,
        scopes: refreshed.scope || conn.scopes,
        updated_at: new Date().toISOString()
    }).eq('user_id', userId);

    return {
        accessToken: refreshed.access_token,
        connection: { ...conn, access_token: refreshed.access_token },
        tokenOwnerId: userId
    };
}

/**
 * Misma regla para listar / vincular / ver archivos:
 * 1) tokens del admin actual
 * 2) si hay projectId, tokens de projects.drive_connected_by
 */
async function resolveDriveAccessForAdmin(
    db: ReturnType<typeof adminDb>,
    profileId: string,
    projectId?: string | null
) {
    const own = await getValidAccessToken(db, profileId);
    if (own) {
        return {
            ...own,
            project: projectId ? await getProject(db, projectId) : null
        };
    }

    if (!projectId) return null;

    const project = await getProject(db, projectId);
    const linkerId = project?.drive_connected_by as string | null | undefined;
    if (!linkerId || linkerId === profileId) return null;

    const linker = await getValidAccessToken(db, linkerId);
    if (!linker) return null;
    return { ...linker, project };
}

async function driveFetch(accessToken: string, path: string, params: Record<string, string> = {}) {
    const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Error de Google Drive API.');
    return data;
}

async function getProject(db: ReturnType<typeof adminDb>, projectId: string) {
    const { data, error } = await db.from('projects').select('*').eq('id', projectId).maybeSingle();
    if (error) throw error;
    return data;
}

async function assertClientOwnsProject(db: ReturnType<typeof adminDb>, projectId: string, userId: string) {
    const { data, error } = await db
        .from('projects')
        .select('id, workspaces!inner(client_id)')
        .eq('id', projectId)
        .eq('workspaces.client_id', userId)
        .maybeSingle();
    if (error) throw error;
    if (!data) throw Object.assign(new Error('No tienes acceso a este proyecto.'), { status: 403 });
    return data;
}

/** Verifica que folderId sea la raíz del proyecto o un descendiente. */
async function assertFolderInProjectTree(accessToken: string, projectRootId: string, folderId: string) {
    if (!projectRootId) throw Object.assign(new Error('El proyecto no tiene carpeta vinculada.'), { status: 400 });
    if (folderId === projectRootId) return true;

    let current = folderId;
    for (let i = 0; i < 30; i += 1) {
        const meta = await driveFetch(accessToken, `files/${current}`, {
            fields: 'id,parents,mimeType',
            supportsAllDrives: 'true'
        });
        const parents: string[] = meta.parents || [];
        if (parents.includes(projectRootId)) return true;
        if (!parents.length) break;
        current = parents[0];
        if (current === projectRootId) return true;
    }
    throw Object.assign(new Error('Carpeta fuera del alcance del proyecto.'), { status: 403 });
}

function mapDriveFile(file: Record<string, unknown>) {
    const mime = String(file.mimeType || '');
    const isFolder = mime === 'application/vnd.google-apps.folder';
    let kind: 'folder' | 'image' | 'video' | 'pdf' | 'document' | 'other' = 'other';
    if (isFolder) kind = 'folder';
    else if (mime.startsWith('image/')) kind = 'image';
    else if (mime.startsWith('video/')) kind = 'video';
    else if (mime === 'application/pdf') kind = 'pdf';
    else if (
        mime.includes('document') ||
        mime.includes('msword') ||
        mime.includes('spreadsheet') ||
        mime.includes('presentation') ||
        mime.includes('text/')
    ) kind = 'document';

    return {
        id: file.id,
        name: file.name,
        mimeType: mime,
        kind,
        isFolder,
        size: file.size ? Number(file.size) : null,
        modifiedTime: file.modifiedTime || null,
        owners: (file.owners as Array<{ displayName?: string; emailAddress?: string }> | undefined)?.map((o) => ({
            name: o.displayName || o.emailAddress || 'Usuario',
            email: o.emailAddress || null
        })) || [],
        webViewLink: file.webViewLink || null,
        webContentLink: file.webContentLink || null,
        iconLink: file.iconLink || null,
        thumbnailLink: file.thumbnailLink || null
    };
}

async function countChildren(accessToken: string, folderId: string) {
    let pageToken: string | undefined;
    let files = 0;
    let folders = 0;
    do {
        const params: Record<string, string> = {
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'nextPageToken, files(id, mimeType)',
            pageSize: '1000',
            supportsAllDrives: 'true',
            includeItemsFromAllDrives: 'true'
        };
        if (pageToken) params.pageToken = pageToken;
        const data = await driveFetch(accessToken, 'files', params);
        for (const f of data.files || []) {
            if (f.mimeType === 'application/vnd.google-apps.folder') folders += 1;
            else files += 1;
        }
        pageToken = data.nextPageToken;
    } while (pageToken);
    return { files, folders };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }

    try {
        const url = new URL(req.url);

        // Callback GET opcional (si redirect_uri apunta a la function).
        if (req.method === 'GET' && (url.searchParams.get('action') === 'oauth-callback' || url.searchParams.has('code'))) {
            const cfgError = requireGoogleConfig();
            if (cfgError) return json({ error: cfgError }, 500);
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            if (!code || !state) return json({ error: 'Callback OAuth incompleto.' }, 400);

            const db = adminDb();
            const { data: stateRow } = await db.from('google_drive_oauth_states').select('*').eq('state', state).maybeSingle();
            if (!stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
                return json({ error: 'Estado OAuth inválido o expirado.' }, 400);
            }
            await db.from('google_drive_oauth_states').delete().eq('state', state);

            const tokens = await exchangeCode(code);
            if (!tokens.refresh_token) {
                // Re-consent puede omitir refresh_token si ya existía.
                const { data: existing } = await db.from('google_drive_connections').select('refresh_token').eq('user_id', stateRow.user_id).maybeSingle();
                if (!existing?.refresh_token) {
                    return json({ error: 'Google no devolvió refresh_token. Revoca el acceso de la app y vuelve a conectar.' }, 400);
                }
                tokens.refresh_token = existing.refresh_token;
            }

            const emailInfo = await getGoogleEmail(tokens.access_token);
            await db.from('google_drive_connections').upsert({
                user_id: stateRow.user_id,
                google_email: emailInfo.email,
                google_account_id: emailInfo.id,
                refresh_token: tokens.refresh_token,
                access_token: tokens.access_token,
                token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
                scopes: tokens.scope || DRIVE_SCOPES,
                updated_at: new Date().toISOString()
            });

            const returnUrl = stateRow.return_url || '/admin/proyectos.html';
            const redirect = new URL(returnUrl, GOOGLE_REDIRECT_URI);
            redirect.searchParams.set('drive', 'connected');
            if (stateRow.project_id) redirect.searchParams.set('id', stateRow.project_id);

            return new Response(null, {
                status: 302,
                headers: { Location: redirect.toString(), ...CORS_HEADERS }
            });
        }

        if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

        const payload = await req.json().catch(() => ({}));
        const action = String(payload.action || '');
        const caller = await getCaller(req);
        if ('error' in caller && caller.error) return json({ error: caller.error }, caller.status || 401);

        const { profile, db } = caller as {
            profile: { id: string; role: string; full_name: string; email: string };
            db: ReturnType<typeof adminDb>;
        };
        const isAdmin = profile.role === 'admin' || profile.role === 'owner';

        if (action === 'configStatus') {
            return json({
                configured: !requireGoogleConfig(),
                redirectUri: GOOGLE_REDIRECT_URI || null
            });
        }

        if (action === 'getAuthUrl') {
            if (!isAdmin) return json({ error: 'Solo un administrador puede conectar Google Drive.' }, 403);
            const cfgError = requireGoogleConfig();
            if (cfgError) return json({ error: cfgError }, 500);

            const state = randomState();
            await db.from('google_drive_oauth_states').insert({
                state,
                user_id: profile.id,
                project_id: payload.projectId || null,
                return_url: payload.returnUrl || null
            });

            const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
            authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('scope', DRIVE_SCOPES);
            authUrl.searchParams.set('access_type', 'offline');
            authUrl.searchParams.set('prompt', 'consent');
            authUrl.searchParams.set('state', state);
            return json({ url: authUrl.toString() });
        }

        if (action === 'oauthExchange') {
            if (!isAdmin) return json({ error: 'Solo un administrador puede conectar Google Drive.' }, 403);
            const cfgError = requireGoogleConfig();
            if (cfgError) return json({ error: cfgError }, 500);
            const { code, state } = payload;
            if (!code || !state) return json({ error: 'Faltan code/state.' }, 400);

            const { data: stateRow } = await db.from('google_drive_oauth_states').select('*').eq('state', state).maybeSingle();
            if (!stateRow || stateRow.user_id !== profile.id) return json({ error: 'Estado OAuth inválido.' }, 400);
            if (new Date(stateRow.expires_at).getTime() < Date.now()) return json({ error: 'Estado OAuth expirado.' }, 400);
            await db.from('google_drive_oauth_states').delete().eq('state', state);

            const tokens = await exchangeCode(code);
            if (!tokens.refresh_token) {
                const { data: existing } = await db.from('google_drive_connections').select('refresh_token').eq('user_id', profile.id).maybeSingle();
                if (!existing?.refresh_token) {
                    return json({ error: 'Google no devolvió refresh_token. Revoca el acceso y vuelve a conectar.' }, 400);
                }
                tokens.refresh_token = existing.refresh_token;
            }
            const emailInfo = await getGoogleEmail(tokens.access_token);
            await db.from('google_drive_connections').upsert({
                user_id: profile.id,
                google_email: emailInfo.email,
                google_account_id: emailInfo.id,
                refresh_token: tokens.refresh_token,
                access_token: tokens.access_token,
                token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
                scopes: tokens.scope || DRIVE_SCOPES,
                updated_at: new Date().toISOString()
            });
            return json({ ok: true, googleEmail: emailInfo.email, projectId: stateRow.project_id, returnUrl: stateRow.return_url });
        }

        if (action === 'connectionStatus') {
            if (!isAdmin) return json({ connected: false, configured: !requireGoogleConfig() });

            const { data: conn } = await db
                .from('google_drive_connections')
                .select('google_email, updated_at')
                .eq('user_id', profile.id)
                .maybeSingle();

            let connected = !!conn;
            let googleEmail = conn?.google_email || null;
            let updatedAt = conn?.updated_at || null;
            let tokenSource: 'self' | 'project_linker' | null = conn ? 'self' : null;

            // Misma regla que listFiles/listFolders: si el proyecto ya fue vinculado
            // por otro admin, esa conexión cuenta como usable para este proyecto.
            const projectId = payload.projectId ? String(payload.projectId) : null;
            if (!connected && projectId) {
                const project = await getProject(db, projectId);
                const linkerId = project?.drive_connected_by as string | null | undefined;
                if (linkerId && linkerId !== profile.id) {
                    const { data: linkerConn } = await db
                        .from('google_drive_connections')
                        .select('google_email, updated_at')
                        .eq('user_id', linkerId)
                        .maybeSingle();
                    if (linkerConn) {
                        connected = true;
                        googleEmail = linkerConn.google_email || null;
                        updatedAt = linkerConn.updated_at || null;
                        tokenSource = 'project_linker';
                    }
                }
            }

            return json({
                connected,
                googleEmail,
                updatedAt,
                tokenSource,
                configured: !requireGoogleConfig()
            });
        }

        if (action === 'disconnectAccount') {
            if (!isAdmin) return json({ error: 'Solo un administrador puede desconectar su cuenta Google.' }, 403);
            await db.from('google_drive_connections').delete().eq('user_id', profile.id);
            return json({ ok: true });
        }

        if (action === 'listFolders') {
            if (!isAdmin) return json({ error: 'Solo un administrador puede explorar carpetas.' }, 403);
            const projectId = payload.projectId ? String(payload.projectId) : null;
            const tokenPack = await resolveDriveAccessForAdmin(db, profile.id, projectId);
            if (!tokenPack?.accessToken) {
                return json({ error: 'Conecta tu cuenta de Google Drive primero.' }, 400);
            }

            const parentId = payload.folderId || 'root';
            const data = await driveFetch(tokenPack.accessToken, 'files', {
                q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name, modifiedTime, webViewLink, owners(displayName,emailAddress))',
                orderBy: 'name',
                pageSize: '100',
                supportsAllDrives: 'true',
                includeItemsFromAllDrives: 'true'
            });
            return json({
                parentId,
                folders: (data.files || []).map(mapDriveFile)
            });
        }

        if (action === 'linkFolder') {
            if (!isAdmin) return json({ error: 'Solo un administrador puede vincular carpetas.' }, 403);
            const projectId = payload.projectId;
            const folderId = payload.folderId;
            if (!projectId || !folderId) return json({ error: 'Faltan projectId/folderId.' }, 400);

            const tokenPack = await resolveDriveAccessForAdmin(db, profile.id, projectId);
            if (!tokenPack?.accessToken) {
                return json({ error: 'Conecta tu cuenta de Google Drive primero.' }, 400);
            }

            const meta = await driveFetch(tokenPack.accessToken, `files/${folderId}`, {
                fields: 'id,name,webViewLink,mimeType',
                supportsAllDrives: 'true'
            });
            if (meta.mimeType !== 'application/vnd.google-apps.folder') {
                return json({ error: 'Debes seleccionar una carpeta.' }, 400);
            }

            const counts = await countChildren(tokenPack.accessToken, folderId);
            const now = new Date().toISOString();
            // Preferir al admin actual si tiene tokens propios; si no, conservar el linker.
            const connectedBy = tokenPack.tokenOwnerId || profile.id;
            const { data: project, error } = await db.from('projects').update({
                drive_folder_id: meta.id,
                drive_folder_name: meta.name,
                drive_folder_url: meta.webViewLink || `https://drive.google.com/drive/folders/${meta.id}`,
                drive_connected: true,
                drive_connected_by: connectedBy,
                drive_connected_at: now,
                drive_files_count: counts.files,
                drive_folders_count: counts.folders,
                drive_last_synced_at: now
            }).eq('id', projectId).select('*').single();
            if (error) throw error;
            return json({ project });
        }

        if (action === 'unlinkFolder') {
            if (!isAdmin) return json({ error: 'Solo un administrador puede desconectar la carpeta.' }, 403);
            const projectId = payload.projectId;
            if (!projectId) return json({ error: 'Falta projectId.' }, 400);
            const { data: project, error } = await db.from('projects').update({
                drive_folder_id: null,
                drive_folder_name: null,
                drive_folder_url: null,
                drive_connected: false,
                drive_connected_by: null,
                drive_connected_at: null,
                drive_files_count: null,
                drive_folders_count: null,
                drive_last_synced_at: null
            }).eq('id', projectId).select('*').single();
            if (error) throw error;
            return json({ project });
        }

        if (action === 'refreshStats') {
            const projectId = payload.projectId;
            if (!projectId) return json({ error: 'Falta projectId.' }, 400);
            const project = await getProject(db, projectId);
            if (!project?.drive_folder_id || !project.drive_connected) {
                return json({ error: 'El proyecto no tiene carpeta vinculada.' }, 400);
            }

            if (!isAdmin) await assertClientOwnsProject(db, projectId, profile.id);

            const tokenPack = isAdmin
                ? await resolveDriveAccessForAdmin(db, profile.id, projectId)
                : await (async () => {
                    const tokenOwnerId = project.drive_connected_by;
                    if (!tokenOwnerId) return null;
                    return getValidAccessToken(db, tokenOwnerId);
                })();
            if (!tokenPack?.accessToken) {
                return json({ error: 'La cuenta Google del administrador ya no está conectada.' }, 400);
            }

            const counts = await countChildren(tokenPack.accessToken, project.drive_folder_id);
            const now = new Date().toISOString();
            const { data: updated, error } = await db.from('projects').update({
                drive_files_count: counts.files,
                drive_folders_count: counts.folders,
                drive_last_synced_at: now
            }).eq('id', projectId).select('*').single();
            if (error) throw error;
            return json({ project: updated, counts });
        }

        if (action === 'listFiles') {
            const projectId = payload.projectId;
            if (!projectId) return json({ error: 'Falta projectId.' }, 400);
            const project = await getProject(db, projectId);
            if (!project?.drive_folder_id || !project.drive_connected) {
                return json({ error: 'El proyecto no tiene carpeta vinculada.' }, 400);
            }
            if (!isAdmin) await assertClientOwnsProject(db, projectId, profile.id);

            const tokenPack = isAdmin
                ? await resolveDriveAccessForAdmin(db, profile.id, projectId)
                : await (async () => {
                    const tokenOwnerId = project.drive_connected_by;
                    if (!tokenOwnerId) return null;
                    return getValidAccessToken(db, tokenOwnerId);
                })();
            if (!tokenPack?.accessToken) {
                return json({ error: 'La cuenta Google del administrador ya no está conectada.' }, 400);
            }

            const folderId = payload.folderId || project.drive_folder_id;
            await assertFolderInProjectTree(tokenPack.accessToken, project.drive_folder_id, folderId);

            const filter = String(payload.filter || 'all');
            const search = String(payload.search || '').trim().replace(/'/g, "\\'");
            let q = `'${folderId}' in parents and trashed = false`;
            if (search) q += ` and name contains '${search}'`;
            if (filter === 'folders') q += ` and mimeType = 'application/vnd.google-apps.folder'`;
            else if (filter === 'images') q += ` and mimeType contains 'image/'`;
            else if (filter === 'videos') q += ` and mimeType contains 'video/'`;
            else if (filter === 'pdf') q += ` and mimeType = 'application/pdf'`;
            else if (filter === 'documents') {
                q += ` and (mimeType contains 'document' or mimeType contains 'msword' or mimeType contains 'text/' or mimeType contains 'spreadsheet' or mimeType contains 'presentation')`;
            }

            const data = await driveFetch(tokenPack.accessToken, 'files', {
                q,
                fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,iconLink,thumbnailLink,owners(displayName,emailAddress))',
                orderBy: 'folder,name',
                pageSize: String(Math.min(Number(payload.pageSize) || 100, 200)),
                supportsAllDrives: 'true',
                includeItemsFromAllDrives: 'true'
            });

            const folderMeta = await driveFetch(tokenPack.accessToken, `files/${folderId}`, {
                fields: 'id,name,parents',
                supportsAllDrives: 'true'
            });

            return json({
                folder: {
                    id: folderMeta.id,
                    name: folderMeta.name,
                    parentId: (folderMeta.parents || [])[0] || null,
                    isRoot: folderId === project.drive_folder_id
                },
                rootFolderId: project.drive_folder_id,
                files: (data.files || []).map(mapDriveFile)
            });
        }

        return json({ error: `Acción desconocida: ${action}` }, 400);
    } catch (error) {
        const status = (error as { status?: number })?.status || 500;
        const message = error instanceof Error ? error.message : 'Error interno de Google Drive.';
        console.error('[google-drive]', message);
        return json({ error: message }, status);
    }
});
