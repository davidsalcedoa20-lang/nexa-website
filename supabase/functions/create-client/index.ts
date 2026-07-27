// ==========================================================
// NEXA HUB — Edge Function: create-client
// ==========================================================
// Por qué existe esta función (y por qué NO se hace desde el
// navegador):
//
// Crear un "Cliente" implica crear (o reutilizar) una cuenta
// real en Supabase Auth para esa persona, incluyendo asignarle
// una CONTRASEÑA TEMPORAL. Eso solo se puede hacer con la
// Admin API de Supabase (auth.admin.createUser / updateUserById),
// que requiere la SERVICE_ROLE KEY.
//
// Esa llave da acceso total a la base de datos, por lo que
// JAMÁS debe vivir en el navegador (js/admin/services/clientService.js
// solo tiene la clave pública "anon"). Esta Edge Function corre
// en el servidor de Supabase, lee la service_role key desde una
// variable de entorno del propio runtime de Supabase (nunca en
// el repositorio ni en el frontend) y expone un endpoint HTTP
// seguro que el panel administrativo llama con la sesión del
// admin autenticado.
//
// Flujo:
//   1. Verifica que quien llama tiene una sesión válida y
//      role = 'admin' en profiles (usando la propia llave anon
//      + el token del que llama, NO se confía en el body).
//   2. Busca si el correo ya existe en Auth:
//        - Si NO existe: lo crea con auth.admin.createUser(),
//          asignándole DIRECTAMENTE la contraseña temporal que
//          escribió el administrador (email_confirm:true, para
//          que pueda iniciar sesión de inmediato sin tener que
//          confirmar su correo).
//        - Si YA existe (ej. se está reintentando tras un error,
//          o el correo ya tenía una cuenta): reutiliza esa
//          cuenta y le ACTUALIZA la contraseña con
//          auth.admin.updateUserById().
//      En ambos casos queda marcado en su metadata de Auth:
//        must_change_password: true
//      (para forzar el cambio de contraseña en su primer login;
//      ver js/portal.js y portal/change-password.html).
//   3. Si el trigger on_auth_user_created no llegó a crear/
//      actualizar su perfil, lo hace aquí con role = 'client'.
//   4. Crea su "workspace" (Empresa, Ciudad, Observaciones), si
//      todavía no tiene uno.
//   5. NO crea ningún proyecto todavía.
//
// La contraseña temporal NUNCA se guarda en ninguna tabla propia
// (profiles/workspaces/etc.): vive únicamente dentro de Supabase
// Auth (auth.users), que es quien gestiona las credenciales. Esta
// función tampoco la reenvía por correo (Supabase Auth no permite
// incluir una contraseña arbitraria en sus plantillas de email de
// forma segura): la devuelve tal cual en texto plano SOLO en la
// respuesta HTTP de esta misma llamada (el admin que la escribió
// ya la conoce), para que el panel se la muestre una única vez y
// el administrador pueda copiarla y enviársela manualmente.
//
// ---------------------------------------------------------
// DESPLIEGUE (requiere Supabase CLI logueado y el proyecto
// linkeado — ver supabase/migrations/README.md):
//
//   npx supabase functions deploy create-client
//
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY ya
// están disponibles automáticamente dentro de toda Edge Function
// de Supabase (no hace falta configurarlas a mano). Si tu
// proyecto no las expone automáticamente, puedes forzarlas con:
//
//   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
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
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
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
        const password = String(body.password || '');

        if (!company || !contact || !email) {
            return json({ error: 'Empresa, contacto y correo son obligatorios.' }, 400);
        }

        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            return json({ error: `La contraseña temporal debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }, 400);
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

        // 2) Si el correo ya tiene una cuenta, verificar ANTES de tocar su
        //    contraseña que no pertenezca a otro administrador (para no
        //    convertir por accidente una cuenta admin en cliente) ni a un
        //    cliente que ya tiene un workspace asignado (para no resetear
        //    por accidente la contraseña de un cliente ya activo solo por
        //    escribir un correo duplicado en el formulario "Nuevo Cliente").
        if (authUser) {
            const { data: existingRoleProfile } = await adminClient
                .from('profiles')
                .select('role')
                .eq('id', authUser.id)
                .maybeSingle();

            if (existingRoleProfile && existingRoleProfile.role === 'admin') {
                return json({ error: 'Ese correo ya pertenece a una cuenta de administrador de NEXA Hub.' }, 409);
            }

            const { data: conflictingWorkspace } = await adminClient
                .from('workspaces')
                .select('id')
                .eq('client_id', authUser.id)
                .maybeSingle();

            if (conflictingWorkspace) {
                return json({ error: 'Este correo ya tiene un espacio de trabajo asignado.' }, 409);
            }
        }

        // 3) Crear (o reutilizar) la cuenta de Auth y asignarle la
        //    contraseña temporal + must_change_password = true.
        const clientMetadata = {
            role: 'client',
            full_name: contact,
            must_change_password: true
        };

        if (!authUser) {
            const { data: created, error: createError } = await adminClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { ...clientMetadata, created_by: caller.id }
            });

            if (createError) {
                return json({ error: `No se pudo crear la cuenta del cliente: ${createError.message}` }, 400);
            }

            authUser = created.user;
        } else {
            const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(authUser.id, {
                password,
                user_metadata: { ...(authUser.user_metadata || {}), ...clientMetadata }
            });

            if (updateError) {
                return json({ error: `No se pudo actualizar la cuenta del cliente: ${updateError.message}` }, 400);
            }

            authUser = updated.user;
        }

        if (!authUser) {
            return json({ error: 'No se pudo obtener el usuario de Auth.' }, 500);
        }

        // 4) Asegurar que su perfil quede como "client" con los datos actuales
        //    (por si el trigger no llegó a crearlo, o si reutilizamos una
        //    cuenta que ya existía con datos distintos).
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
        } else {
            const { error: profileUpdateError } = await adminClient
                .from('profiles')
                .update({ full_name: contact, phone: phone || null, role: 'client', is_active: true })
                .eq('id', authUser.id);

            if (profileUpdateError) {
                return json({ error: `No se pudo actualizar el perfil del cliente: ${profileUpdateError.message}` }, 400);
            }
        }

        // 5) Crear el workspace. NO se crea ningún proyecto todavía (ya se
        //    verificó arriba, antes de tocar la contraseña, que no existía
        //    uno previo para esta cuenta).
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

        // La contraseña se devuelve tal cual porque el propio admin la
        // escribió en el formulario: esto NO es una fuga de secretos,
        // es simplemente confirmarle lo que ya sabe para que el panel
        // se lo muestre una última vez y pueda copiarlo/enviarlo. Nunca
        // se persiste en ninguna tabla ni en logs.
        return json({ success: true, workspace, userId: authUser.id, temporaryPassword: password }, 200);
    } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
    }
});
