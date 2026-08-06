// ==========================================================
// NEXA HUB — Edge Function: update-client
// ==========================================================
// Edición de un cliente ya existente desde el panel Admin.
// Incluye cambio de correo: Auth + profiles deben quedar
// sincronizados (la Admin API solo vive aquí con service_role).
//
// Seguridad (igual que create-client / reset-client-password):
//   1. Sesión válida + role admin|owner
//   2. Permiso clients.edit (si no es owner)
//   3. El perfil objetivo debe ser role = 'client'
//
// DESPLIEGUE:
//   npx supabase functions deploy update-client
// ==========================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

async function findAuthUserByEmail(
    adminClient: ReturnType<typeof createClient>,
    email: string
) {
    let page = 1;
    const perPage = 200;

    while (page <= 50) {
        const { data: pageData, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (listError) {
            throw new Error(`Error verificando el correo: ${listError.message}`);
        }

        const match = pageData.users.find((u) => (u.email || '').toLowerCase() === email);
        if (match) return match;

        if (pageData.users.length < perPage) break;
        page += 1;
    }

    return null;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
        return json({ error: 'Método no permitido.' }, 405);
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return json({ error: 'No autorizado: falta la sesión.' }, 401);
        }

        const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();

        if (callerError || !caller) {
            return json({ error: 'Sesión inválida o expirada.' }, 401);
        }

        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: callerProfile } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .maybeSingle();

        if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role)) {
            return json({ error: 'Solo un administrador puede editar clientes.' }, 403);
        }

        if (callerProfile.role !== 'owner') {
            const { data: perm } = await adminClient
                .from('user_permissions')
                .select('permission_key')
                .eq('user_id', caller.id)
                .eq('permission_key', 'clients.edit')
                .maybeSingle();
            if (!perm) {
                return json({ error: 'No tienes permiso para editar clientes.' }, 403);
            }
        }

        const body = await req.json().catch(() => ({}));
        const profileId = String(body.profileId || '').trim();
        const workspaceId = String(body.workspaceId || '').trim();
        const company = String(body.company || '').trim();
        const contact = String(body.contact || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const phone = String(body.phone || '').trim();
        const city = String(body.city || '').trim();
        const notes = String(body.notes || '').trim();

        if (!profileId || !workspaceId) {
            return json({ error: 'Faltan identificadores del cliente.' }, 400);
        }

        if (!company || !contact || !email) {
            return json({ error: 'Empresa, contacto y correo son obligatorios.' }, 400);
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json({ error: 'El correo no tiene un formato válido.' }, 400);
        }

        const { data: targetProfile } = await adminClient
            .from('profiles')
            .select('id, role, email, full_name')
            .eq('id', profileId)
            .maybeSingle();

        if (!targetProfile || targetProfile.role !== 'client') {
            return json({ error: 'No se encontró un cliente con ese identificador.' }, 404);
        }

        const { data: workspace } = await adminClient
            .from('workspaces')
            .select('id, client_id')
            .eq('id', workspaceId)
            .maybeSingle();

        if (!workspace || workspace.client_id !== profileId) {
            return json({ error: 'El espacio de trabajo no corresponde a este cliente.' }, 400);
        }

        const currentEmail = (targetProfile.email || '').toLowerCase();
        const emailChanged = email !== currentEmail;

        if (emailChanged) {
            const existing = await findAuthUserByEmail(adminClient, email);
            if (existing && existing.id !== profileId) {
                return json({ error: 'Ese correo ya está en uso por otra cuenta.' }, 409);
            }

            const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(profileId);
            if (getUserError || !targetUser?.user) {
                return json({ error: 'No se encontró la cuenta de Auth de este cliente.' }, 404);
            }

            const { error: authError } = await adminClient.auth.admin.updateUserById(profileId, {
                email,
                email_confirm: true,
                user_metadata: {
                    ...(targetUser.user.user_metadata || {}),
                    role: 'client',
                    full_name: contact
                }
            });

            if (authError) {
                return json({ error: `No se pudo actualizar el correo de acceso: ${authError.message}` }, 400);
            }
        } else {
            const { data: targetUser } = await adminClient.auth.admin.getUserById(profileId);
            if (targetUser?.user) {
                await adminClient.auth.admin.updateUserById(profileId, {
                    user_metadata: {
                        ...(targetUser.user.user_metadata || {}),
                        role: 'client',
                        full_name: contact
                    }
                });
            }
        }

        const { error: profileError } = await adminClient
            .from('profiles')
            .update({
                full_name: contact,
                email,
                phone: phone || null
            })
            .eq('id', profileId);

        if (profileError) {
            return json({ error: `No se pudo actualizar el perfil: ${profileError.message}` }, 400);
        }

        const { error: workspaceError } = await adminClient
            .from('workspaces')
            .update({
                name: company,
                city: city || null,
                notes: notes || null
            })
            .eq('id', workspaceId);

        if (workspaceError) {
            return json({ error: `No se pudo actualizar el espacio de trabajo: ${workspaceError.message}` }, 400);
        }

        return json({
            success: true,
            emailChanged,
            email
        });
    } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
    }
});
