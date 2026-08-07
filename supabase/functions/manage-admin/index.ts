// ==========================================================
 // NEXA HUB — Edge Function: manage-admin
 // ==========================================================
 // Alta / edición / reset / desactivar / eliminar administradores.
 // Requiere SERVICE_ROLE (Auth Admin API). Tokens nunca en frontend.
 //
 // Acciones (body.action):
 //   create | update | resetPassword | setActive | delete
 //
 // Despliegue:
 //   npx supabase functions deploy manage-admin
 // ==========================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MIN_PASSWORD_LENGTH = 8;

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

async function assertOwner(
    db: ReturnType<typeof adminDb>,
    userId: string
) {
    const { data: profile } = await db
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    if (!profile || profile.role !== 'owner') {
        return { error: 'Solo el CEO puede gestionar administradores.', status: 403 as const };
    }
    return { profile };
}

function normalizePermissionKeys(keys: unknown): string[] {
    if (!Array.isArray(keys)) return [];
    const allowed = new Set([
        'projects.view_all',
        'projects.view_assigned',
        'projects.view_own',
        'employees.manage'
    ]);
    return [...new Set(keys.map((k) => String(k).trim()).filter((k) => allowed.has(k)))];
}

async function replacePermissions(
    db: ReturnType<typeof adminDb>,
    userId: string,
    permissionKeys: string[],
    grantedBy: string | null
) {
    let keys = normalizePermissionKeys(permissionKeys);

    // Exactamente una key de proyectos
    const projectKeys = keys.filter((k) => k.startsWith('projects.'));
    if (projectKeys.includes('projects.view_all')) {
        keys = keys.filter((k) => !k.startsWith('projects.')).concat(['projects.view_all']);
    } else if (projectKeys.includes('projects.view_assigned')) {
        keys = keys.filter((k) => !k.startsWith('projects.')).concat(['projects.view_assigned']);
    } else if (projectKeys.includes('projects.view_own')) {
        keys = keys.filter((k) => !k.startsWith('projects.')).concat(['projects.view_own']);
    } else {
        keys = keys.filter((k) => !k.startsWith('projects.')).concat(['projects.view_own']);
    }

    await db.from('user_permissions').delete().eq('user_id', userId);
    if (keys.length) {
        const { error } = await db.from('user_permissions').insert(
            keys.map((permission_key) => ({
                user_id: userId,
                permission_key,
                granted_by: grantedBy
            }))
        );
        if (error) throw error;
    }
    return keys;
}

async function replaceProjectAccess(
    db: ReturnType<typeof adminDb>,
    userId: string,
    mode: string,
    projectIds: unknown
) {
    const accessMode = mode === 'selected' ? 'selected' : (mode === 'own' ? 'own' : 'all');
    const { error: modeError } = await db
        .from('profiles')
        .update({ project_access_mode: accessMode })
        .eq('id', userId);
    if (modeError) throw modeError;

    await db.from('admin_project_access').delete().eq('user_id', userId);

    if (accessMode === 'selected' && Array.isArray(projectIds) && projectIds.length) {
        const rows = [...new Set(projectIds.map((id) => String(id)))].map((project_id) => ({
            user_id: userId,
            project_id
        }));
        const { error } = await db.from('admin_project_access').insert(rows);
        if (error) throw error;
    }
    return accessMode;
}

async function findAuthUserByEmail(db: ReturnType<typeof adminDb>, email: string) {
    let page = 1;
    const perPage = 200;
    while (page <= 50) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const match = data.users.find((u) => (u.email || '').toLowerCase() === email);
        if (match) return match;
        if (data.users.length < perPage) break;
        page += 1;
    }
    return null;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return json({ error: 'No autorizado.' }, 401);

        const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } }
        });
        const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
        if (callerError || !caller) return json({ error: 'Sesión inválida.' }, 401);

        const db = adminDb();
        const body = await req.json().catch(() => ({}));
        const action = String(body.action || '');

        if (action === 'create') {
            const gate = await assertOwner(db, caller.id);
            if ('error' in gate && gate.error) return json({ error: gate.error }, gate.status);

            const fullName = String(body.full_name || '').trim();
            const email = String(body.email || '').trim().toLowerCase();
            const password = String(body.password || '').trim();
            const jobTitle = String(body.job_title || '').trim() || null;
            const avatarUrl = body.avatar_url ? String(body.avatar_url) : null;
            let permissionKeys = normalizePermissionKeys(body.permission_keys);
            const rawMode = String(body.project_access_mode || 'own');
            const projectAccessMode = rawMode === 'selected' ? 'selected' : (rawMode === 'own' ? 'own' : 'all');
            const projectIds = body.project_ids || [];

            if (!fullName || !email) return json({ error: 'Nombre y correo son obligatorios.' }, 400);
            if (!password || password.length < MIN_PASSWORD_LENGTH) {
                return json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }, 400);
            }

            // Alinear key de proyectos con el modo
            permissionKeys = permissionKeys.filter((k) => !k.startsWith('projects.'));
            if (projectAccessMode === 'all') permissionKeys.push('projects.view_all');
            else if (projectAccessMode === 'selected') permissionKeys.push('projects.view_assigned');
            else permissionKeys.push('projects.view_own');

            const existing = await findAuthUserByEmail(db, email);
            if (existing) {
                return json({ error: 'Ya existe una cuenta con ese correo.' }, 409);
            }

            const { data: created, error: createError } = await db.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    role: 'admin',
                    full_name: fullName,
                    job_title: jobTitle,
                    must_change_password: true,
                    created_by: caller.id
                }
            });
            if (createError || !created?.user) {
                return json({ error: createError?.message || 'No se pudo crear el usuario.' }, 400);
            }

            const userId = created.user.id;

            const { data: existingProfile } = await db
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .maybeSingle();

            const profilePayload = {
                email,
                full_name: fullName,
                role: 'admin' as const,
                job_title: jobTitle,
                avatar_url: avatarUrl,
                is_active: true,
                project_access_mode: projectAccessMode,
                created_by: caller.id
            };

            if (!existingProfile) {
                const { error: profileInsertError } = await db.from('profiles').insert({
                    id: userId,
                    ...profilePayload
                });
                if (profileInsertError) {
                    return json({
                        error: `Usuario Auth creado pero falló el perfil: ${profileInsertError.message}`
                    }, 400);
                }
            } else {
                const { error: profileUpdateError } = await db
                    .from('profiles')
                    .update(profilePayload)
                    .eq('id', userId);
                if (profileUpdateError) {
                    return json({
                        error: `Usuario Auth creado pero falló el perfil: ${profileUpdateError.message}`
                    }, 400);
                }
            }

            try {
                await replacePermissions(db, userId, permissionKeys, caller.id);
                await replaceProjectAccess(db, userId, projectAccessMode, projectIds);
            } catch (permError) {
                const msg = permError instanceof Error ? permError.message : String(permError);
                return json({
                    error: `Administrador creado, pero falló al asignar permisos/acceso: ${msg}`
                }, 400);
            }

            return json({
                ok: true,
                userId,
                email,
                temporaryPassword: password,
                inviteSent: false,
                message: 'Administrador creado. Comparte la contraseña temporal de forma segura.'
            });
        }

        if (action === 'update') {
            const gate = await assertOwner(db, caller.id);
            if ('error' in gate && gate.error) return json({ error: gate.error }, gate.status);

            const userId = String(body.user_id || '').trim();
            if (!userId) return json({ error: 'Falta user_id.' }, 400);

            const { data: target } = await db
                .from('profiles')
                .select('id, role, email')
                .eq('id', userId)
                .maybeSingle();
            if (!target) return json({ error: 'Usuario no encontrado.' }, 404);
            if (target.role === 'owner') {
                return json({ error: 'El propietario no puede editarse desde aquí.' }, 403);
            }
            if (target.role !== 'admin') {
                return json({ error: 'Solo se pueden editar administradores.' }, 400);
            }

            const fullName = body.full_name !== undefined ? String(body.full_name).trim() : null;
            const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : null;
            const jobTitle = body.job_title !== undefined ? (String(body.job_title).trim() || null) : undefined;
            const avatarUrl = body.avatar_url !== undefined ? (body.avatar_url || null) : undefined;
            const isActive = body.is_active !== undefined ? !!body.is_active : undefined;

            if (fullName !== null && !fullName) return json({ error: 'El nombre no puede quedar vacío.' }, 400);
            if (email !== null && !email) return json({ error: 'El correo no puede quedar vacío.' }, 400);

            const profileUpdate: Record<string, unknown> = {};
            if (fullName !== null) profileUpdate.full_name = fullName;
            if (email !== null) profileUpdate.email = email;
            if (jobTitle !== undefined) profileUpdate.job_title = jobTitle;
            if (avatarUrl !== undefined) profileUpdate.avatar_url = avatarUrl;
            if (isActive !== undefined) profileUpdate.is_active = isActive;

            if (Object.keys(profileUpdate).length) {
                const { error } = await db.from('profiles').update(profileUpdate).eq('id', userId);
                if (error) return json({ error: error.message }, 400);
            }

            const authUpdate: Record<string, unknown> = {};
            if (email !== null && email !== target.email) authUpdate.email = email;
            if (fullName !== null) {
                authUpdate.user_metadata = { full_name: fullName, role: 'admin' };
            }
            if (Object.keys(authUpdate).length) {
                const { error: authError } = await db.auth.admin.updateUserById(userId, authUpdate);
                if (authError) return json({ error: authError.message }, 400);
            }

            if (Array.isArray(body.permission_keys)) {
                let keys = normalizePermissionKeys(body.permission_keys);
                const rawMode = String(body.project_access_mode || 'own');
                const mode = rawMode === 'selected' ? 'selected' : (rawMode === 'own' ? 'own' : 'all');
                keys = keys.filter((k) => !k.startsWith('projects.'));
                if (mode === 'all') keys.push('projects.view_all');
                else if (mode === 'selected') keys.push('projects.view_assigned');
                else keys.push('projects.view_own');
                await replacePermissions(db, userId, keys, caller.id);
                await replaceProjectAccess(db, userId, mode, body.project_ids || []);
            } else if (body.project_access_mode) {
                await replaceProjectAccess(db, userId, body.project_access_mode, body.project_ids || []);
            }

            return json({ ok: true });
        }

        if (action === 'resetPassword') {
            const gate = await assertOwner(db, caller.id);
            if ('error' in gate && gate.error) return json({ error: gate.error }, gate.status);

            const userId = String(body.user_id || '').trim();
            const password = String(body.password || '').trim();
            if (!userId) return json({ error: 'Falta user_id.' }, 400);
            if (!password || password.length < MIN_PASSWORD_LENGTH) {
                return json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }, 400);
            }

            const { data: target } = await db.from('profiles').select('role').eq('id', userId).maybeSingle();
            if (!target || target.role === 'owner') {
                return json({ error: 'No se puede restablecer la contraseña de este usuario.' }, 403);
            }

            const { error } = await db.auth.admin.updateUserById(userId, {
                password,
                user_metadata: { must_change_password: true }
            });
            if (error) return json({ error: error.message }, 400);

            return json({ ok: true, temporaryPassword: password });
        }

        if (action === 'setActive') {
            const gate = await assertOwner(db, caller.id);
            if ('error' in gate && gate.error) return json({ error: gate.error }, gate.status);

            const userId = String(body.user_id || '').trim();
            const isActive = !!body.is_active;
            if (!userId) return json({ error: 'Falta user_id.' }, 400);

            const { data: target } = await db.from('profiles').select('role').eq('id', userId).maybeSingle();
            if (!target || target.role === 'owner') {
                return json({ error: 'No se puede desactivar al propietario.' }, 403);
            }

            const { error } = await db.from('profiles').update({ is_active: isActive }).eq('id', userId);
            if (error) return json({ error: error.message }, 400);
            return json({ ok: true, is_active: isActive });
        }

        if (action === 'delete') {
            const gate = await assertOwner(db, caller.id);
            if ('error' in gate && gate.error) return json({ error: gate.error }, gate.status);

            const userId = String(body.user_id || '').trim();
            if (!userId) return json({ error: 'Falta user_id.' }, 400);
            if (userId === caller.id) return json({ error: 'No puedes eliminar tu propia cuenta.' }, 400);

            const { data: target } = await db.from('profiles').select('role').eq('id', userId).maybeSingle();
            if (!target) return json({ error: 'Usuario no encontrado.' }, 404);
            if (target.role === 'owner') return json({ error: 'El propietario no puede eliminarse.' }, 403);

            const { error } = await db.auth.admin.deleteUser(userId);
            if (error) return json({ error: error.message }, 400);
            return json({ ok: true });
        }

        return json({ error: `Acción desconocida: ${action}` }, 400);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error interno.';
        console.error('[manage-admin]', message);
        return json({ error: message }, 500);
    }
});
