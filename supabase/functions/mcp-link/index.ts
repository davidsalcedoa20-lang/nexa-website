// ==========================================================
// NEXA HUB — Edge Function: mcp-link
// ==========================================================
// Vincula NEXA MCP (servidor separado, fuera de este repo) a la
// sesión de un administrador, SIN reutilizar ni consumir el
// refresh_token de su pestaña web y SIN persistir ningún token
// en ninguna tabla.
//
// Flujo:
//   1) action "create"  — el admin, ya autenticado en la web,
//      pide un código. Se valida su JWT con getUser() (igual que
//      el resto de las Edge Functions), se confirma que es
//      admin/owner activo, y se guarda SOLO { code, user_id,
//      expires_at } en mcp_link_codes (10 min de vida). No se
//      genera ningún token todavía.
//   2) action "redeem"  — el MCP (desde Claude) canjea el código.
//      Se borra la fila de forma atómica (DELETE ... RETURNING:
//      garantiza un solo canje aunque lleguen llamadas
//      concurrentes) y, recién en ese momento, dentro del mismo
//      request, se genera una sesión Supabase independiente para
//      ese usuario vía admin.generateLink() + auth.verifyOtp()
//      (el único camino soportado por Supabase para mintear una
//      sesión sin la contraseña del usuario, sin enviar correo).
//      Esa sesión se devuelve UNA sola vez en la respuesta HTTP y
//      nunca se escribe a ninguna tabla.
//
// Nunca se registra en logs ningún access_token, refresh_token,
// hashed_token ni la service_role key.
//
// Despliegue:
//   npx supabase functions deploy mcp-link
// ==========================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const CODE_TTL_SECONDS = 600; // 10 minutos

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

/** Genera un código de 6 dígitos (con ceros a la izquierda si aplica). */
function randomCode(): string {
    const n = Math.floor(Math.random() * 1_000_000);
    return String(n).padStart(6, '0');
}

/**
 * Valida el JWT del llamante contra el servidor de Auth (getUser(),
 * nunca getSession()) y confirma que sea admin/owner activo.
 * Mismo patrón usado por create-employee/manage-admin/google-drive.
 */
async function requireActiveAdmin(authHeader: string | null) {
    if (!authHeader) {
        return { error: 'No autorizado: falta la sesión.', status: 401 as const };
    }

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error } = await callerClient.auth.getUser();
    if (error || !user) {
        return { error: 'Sesión inválida o expirada.', status: 401 as const };
    }

    const db = adminDb();
    const { data: profile } = await db
        .from('profiles')
        .select('id, role, is_active, email')
        .eq('id', user.id)
        .maybeSingle();

    if (!profile || !(profile.role === 'admin' || profile.role === 'owner') || profile.is_active === false) {
        return { error: 'Solo un administrador activo puede realizar esta acción.', status: 403 as const };
    }

    return { profile, db };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }
    if (req.method !== 'POST') {
        return json({ error: 'Método no permitido.' }, 405);
    }

    try {
        const payload = await req.json().catch(() => ({}));
        const action = String(payload?.action || '');

        // ------------------------------------------------------------
        // action: create — genera el código de 6 dígitos.
        // Requiere sesión admin válida. No genera ni guarda tokens.
        // ------------------------------------------------------------
        if (action === 'create') {
            const authHeader = req.headers.get('Authorization');
            const auth = await requireActiveAdmin(authHeader);
            if ('error' in auth) return json({ error: auth.error }, auth.status);

            const db = auth.db;
            let code = '';
            let inserted = false;

            // Reintenta en la muy improbable colisión de código ya existente.
            for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
                code = randomCode();
                const { error: insertError } = await db
                    .from('mcp_link_codes')
                    .insert({ code, user_id: auth.profile.id });
                if (!insertError) inserted = true;
            }

            if (!inserted) {
                return json({ error: 'No se pudo generar el código. Intenta de nuevo.' }, 500);
            }

            return json({ code, expires_in: CODE_TTL_SECONDS });
        }

        // ------------------------------------------------------------
        // action: redeem — canjea el código UNA vez por una sesión
        // independiente. Sin Authorization: el código de un solo uso
        // es la propia credencial de este paso.
        // ------------------------------------------------------------
        if (action === 'redeem') {
            const code = String(payload?.code || '').trim();
            if (!/^\d{6}$/.test(code)) {
                return json({ error: 'Código inválido.' }, 400);
            }

            const db = adminDb();

            // Borrado atómico: si dos requests llegan con el mismo código
            // al mismo tiempo, solo uno obtiene la fila. Un solo uso,
            // garantizado por la base de datos, no por lógica de la función.
            const { data: rows, error: deleteError } = await db
                .from('mcp_link_codes')
                .delete()
                .eq('code', code)
                .gt('expires_at', new Date().toISOString())
                .select('user_id')
                .limit(1);

            if (deleteError) {
                console.error('[mcp-link] Error canjeando código:', deleteError.message);
                return json({ error: 'No se pudo validar el código.' }, 500);
            }
            if (!rows || rows.length === 0) {
                return json({ error: 'Código inválido, vencido o ya utilizado.' }, 400);
            }

            const userId = rows[0].user_id as string;

            // Revalida admin/activo en el momento del canje (no solo al crear
            // el código) — si en esos minutos lo desactivaron, se corta aquí.
            const { data: profile } = await db
                .from('profiles')
                .select('id, role, is_active, email')
                .eq('id', userId)
                .maybeSingle();

            if (!profile || !(profile.role === 'admin' || profile.role === 'owner') || profile.is_active === false) {
                return json({ error: 'La cuenta ya no tiene permisos de administrador activos.' }, 403);
            }
            if (!profile.email) {
                return json({ error: 'No se pudo determinar el correo de la cuenta.' }, 500);
            }

            // Único camino soportado por Supabase para mintear una sesión sin
            // la contraseña del usuario: generar un magic link (NO envía
            // correo) y canjearlo de inmediato, en este mismo request. El
            // hashed_token intermedio nunca se persiste ni sale de esta función.
            const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
                type: 'magiclink',
                email: profile.email
            });

            const hashedToken = linkData?.properties?.hashed_token;
            if (linkError || !hashedToken) {
                console.error('[mcp-link] generateLink falló:', linkError?.message || 'sin hashed_token');
                return json({ error: 'No se pudo generar la sesión del MCP.' }, 500);
            }

            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { autoRefreshToken: false, persistSession: false }
            });
            const { data: sessionData, error: verifyError } = await anonClient.auth.verifyOtp({
                type: 'magiclink',
                token_hash: hashedToken
            });

            if (verifyError || !sessionData?.session) {
                console.error('[mcp-link] verifyOtp falló:', verifyError?.message || 'sin sesión');
                return json({ error: 'No se pudo completar la vinculación.' }, 500);
            }

            // Se devuelve UNA sola vez. No se escribe a ninguna tabla, no se
            // registra en logs.
            return json({
                access_token: sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token,
                expires_in: sessionData.session.expires_in,
                token_type: sessionData.session.token_type
            });
        }

        return json({ error: `Acción desconocida: ${action}` }, 400);
    } catch (error) {
        console.error('[mcp-link] Error interno:', error instanceof Error ? error.message : 'desconocido');
        return json({ error: 'Error interno.' }, 500);
    }
});
