// ==========================================================
// NEXA HUB — Edge Function: create-client
// ==========================================================
// Por qué existe esta función (y por qué NO se hace desde el
// navegador):
//
// Crear un "Cliente" implica crear una cuenta real en
// Supabase Auth para esa persona (para que en el futuro pueda
// entrar al Portal del Cliente). Eso solo se puede hacer con
// la Admin API de Supabase (auth.admin.inviteUserByEmail /
// createUser), que requiere la SERVICE_ROLE KEY.
//
// Esa llave da acceso total a la base de datos, por lo que
// JAMÁS debe vivir en el navegador (js/admin/services/clientService.js
// solo tiene la clave pública "anon"). Esta Edge Function corre
// en el servidor de Supabase, guarda la service_role key como
// secreto de la función (nunca en el repositorio ni en el
// frontend) y expone un endpoint HTTP seguro que el panel
// administrativo llama con la sesión del admin autenticado.
//
// Flujo:
//   1. Verifica que quien llama tiene una sesión válida y
//      role = 'admin' en profiles (usando la propia llave anon
//      + el token del que llama, NO se confía en el body).
//   2. Invita (o reutiliza, si ya existe) al usuario en Auth.
//   3. Si el trigger on_auth_user_created no llegó a crear su
//      perfil, lo crea aquí con role = 'client'.
//   4. Crea su "workspace" (Empresa, Ciudad, Observaciones).
//   5. NO crea ningún proyecto todavía.
//
// ---------------------------------------------------------
// DESPLIEGUE (requiere Supabase CLI logueado y el proyecto
// linkeado — ver supabase/migrations/README.md):
//
//   npx supabase functions deploy create-client
//   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
//
// (SUPABASE_URL y SUPABASE_ANON_KEY ya están disponibles
// automáticamente dentro de toda Edge Function de Supabase).
// ==========================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY =
Deno.env.get("SERVICE_ROLE_KEY")!;

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

        // Cliente "del que llama": valida el JWT del admin que hizo la petición.
        const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();

        if (callerError || !caller) {
            return json({ error: 'Sesión inválida o expirada.' }, 401);
        }

        // Cliente con privilegios: SOLO se usa server-side, nunca se envía al navegador.
        const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: callerProfile } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .maybeSingle();

        if (!callerProfile || callerProfile.role !== 'admin') {
            return json({ error: 'Solo un administrador puede crear clientes.' }, 403);
        }

        const body = await req.json().catch(() => ({}));
        const company = (body.company || '').trim();
        const contact = (body.contact || '').trim();
        const email = (body.email || '').trim().toLowerCase();
        const phone = (body.phone || '').trim();
        const city = (body.city || '').trim();
        const notes = (body.notes || '').trim();

        if (!company || !contact || !email) {
            return json({ error: 'Empresa, contacto y correo son obligatorios.' }, 400);
        }

        // 1) Buscar si el correo ya existe en Auth (paginado, igual que scripts/set-admin-passwords.mjs).
        let authUser = null;
        let page = 1;
        const perPage = 200;

        while (page <= 50) {
            const { data: pageData, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage });
            if (listError) {
                return json({ error: `Error verificando el correo: ${listError.message}` }, 500);
            }

            const match = pageData.users.find((u) => (u.email || '').toLowerCase() === email);
            if (match) {
                authUser = match;
                break;
            }

            if (pageData.users.length < perPage) break;
            page += 1;
        }

        // 2) Si no existe, se invita (crea la cuenta y le envía correo para definir contraseña).
        if (!authUser) {
            const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
                data: { role: 'client', full_name: contact }
            });

            if (inviteError) {
                return json({ error: `No se pudo crear la cuenta del cliente: ${inviteError.message}` }, 400);
            }

            authUser = invited.user;
        }

        if (!authUser) {
            return json({ error: 'No se pudo obtener el usuario de Auth.' }, 500);
        }

        // 3) Asegurar que exista su perfil (por si el trigger no llegó a crearlo).
        const { data: existingProfile } = await adminClient
            .from('profiles')
            .select('id, role')
            .eq('id', authUser.id)
            .maybeSingle();

        if (!existingProfile) {
            const { error: profileInsertError } = await adminClient.from('profiles').insert({
                id: authUser.id,
                email,
                full_name: contact,
                phone: phone || null,
                role: 'client',
                created_by: caller.id
            });

            if (profileInsertError) {
                return json({ error: `No se pudo crear el perfil del cliente: ${profileInsertError.message}` }, 400);
            }
        }

        // 4) Verificar que no tenga ya un workspace (client_id es UNIQUE).
        const { data: existingWorkspace } = await adminClient
            .from('workspaces')
            .select('id')
            .eq('client_id', authUser.id)
            .maybeSingle();

        if (existingWorkspace) {
            return json({ error: 'Este correo ya tiene un espacio de trabajo asignado.' }, 409);
        }

        // 5) Crear el workspace. NO se crea ningún proyecto todavía.
        const { data: workspace, error: workspaceError } = await adminClient
            .from('workspaces')
            .insert({
                client_id: authUser.id,
                name: company,
                city: city || null,
                notes: notes || null,
                created_by: caller.id
            })
            .select()
            .single();

        if (workspaceError) {
            return json({ error: `No se pudo crear el espacio de trabajo: ${workspaceError.message}` }, 400);
        }

        return json({ success: true, workspace, userId: authUser.id }, 200);
    } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
    }
});
