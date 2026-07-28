// ==========================================================
// NEXA HUB — Edge Function: reset-client-password
// ==========================================================
// Acción "Regenerar contraseña temporal" del panel administrativo
// de Clientes. Se separó de "create-client" porque es una
// operación distinta (actúa sobre un cliente YA existente, no
// crea workspace ni perfil), pero comparte exactamente el mismo
// modelo de seguridad:
//
//   1. Verifica que quien llama tiene sesión válida y
//      role = 'admin' (igual que create-client).
//   2. Verifica que el perfil objetivo exista y sea role = 'client'
//      (un admin NUNCA puede resetear la contraseña de otro admin
//      desde este endpoint).
//   3. Establece la nueva contraseña temporal con
//      auth.admin.updateUserById() (Admin API — requiere
//      SERVICE_ROLE KEY, que solo vive aquí, nunca en el frontend).
//   4. Marca user_metadata.must_change_password = true, para que
//      la próxima vez que el cliente inicie sesión sea obligado
//      a definir una contraseña nueva (ver js/portal.js y
//      portal/change-password.html).
//
// La contraseña temporal NUNCA se guarda en ninguna tabla propia:
// se devuelve tal cual en la respuesta (el admin ya la escribió
// en el formulario) para que el panel se la muestre una única vez.
//
// ---------------------------------------------------------
// DESPLIEGUE:
//   npx supabase functions deploy reset-client-password
//
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY ya
// están disponibles automáticamente dentro de toda Edge Function
// de Supabase.
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
            return json({ error: 'Solo un administrador puede regenerar contraseñas de clientes.' }, 403);
        }

        const body = await req.json().catch(() => ({}));
        const profileId = (body.profileId || '').trim();
        // .trim() por la misma razón que en create-client: el formulario de
        // login del Portal recorta espacios (ver js/portal.js), así que la
        // contraseña que se guarda en Auth debe quedar recortada igual.
        const password = String(body.password || '').trim();

        if (!profileId) {
            return json({ error: 'Falta el identificador del cliente.' }, 400);
        }

        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            return json({ error: `La contraseña temporal debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }, 400);
        }

        // Un admin solo puede regenerar contraseñas de perfiles con role = 'client'.
        const { data: targetProfile } = await adminClient
            .from('profiles')
            .select('id, role, full_name, email')
            .eq('id', profileId)
            .maybeSingle();

        if (!targetProfile || targetProfile.role !== 'client') {
            return json({ error: 'No se encontró un cliente con ese identificador.' }, 404);
        }

        const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(profileId);

        if (getUserError || !targetUser?.user) {
            return json({ error: 'No se encontró la cuenta de Auth de este cliente.' }, 404);
        }

        const { error: updateError } = await adminClient.auth.admin.updateUserById(profileId, {
            password,
            // Por si esta cuenta hubiera quedado sin confirmar (p. ej. creada
            // originalmente con auth.admin.inviteUserByEmail()): sin esto
            // seguiría sin poder iniciar sesión con contraseña aunque ya
            // tenga una contraseña válida.
            email_confirm: true,
            user_metadata: { ...(targetUser.user.user_metadata || {}), must_change_password: true }
        });

        if (updateError) {
            return json({ error: `No se pudo actualizar la contraseña: ${updateError.message}` }, 400);
        }

        // Igual que en create-client: se devuelve tal cual porque el
        // propio admin la escribió en el formulario, nunca se guarda.
        return json({ success: true, temporaryPassword: password }, 200);
    } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
    }
});
