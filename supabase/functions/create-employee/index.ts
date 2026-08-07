// ==========================================================
// NEXA HUB — Edge Function: create-employee
// ==========================================================
// Crea cuenta Auth (role=employee) + fila employees.
// DESPLIEGUE: npx supabase functions deploy create-employee
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

        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: callerProfile } = await adminClient
            .from('profiles').select('role').eq('id', caller.id).maybeSingle();

        if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role)) {
            return json({ error: 'Solo un administrador puede crear empleados.' }, 403);
        }

        const body = await req.json().catch(() => ({}));
        const firstName = String(body.first_name || '').trim();
        const lastName = String(body.last_name || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '').trim();
        const roleKey = String(body.role_key || 'editor').trim();
        const status = String(body.status || 'active').trim() === 'inactive' ? 'inactive' : 'active';
        const colorHex = String(body.color_hex || '#2D8CFF').trim() || '#2D8CFF';
        const photoUrlRaw = body.photo_url ? String(body.photo_url).trim() : null;
        // Evitar payloads enormes (dataURL) que rompen la Edge Function
        const photoUrl = photoUrlRaw && photoUrlRaw.length < 200_000 ? photoUrlRaw : null;

        if (!firstName || !lastName || !email) {
            return json({ error: 'Nombre, apellido y correo son obligatorios.' }, 400);
        }
        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            return json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }, 400);
        }

        const { data: roleRow } = await adminClient
            .from('employee_roles').select('key').eq('key', roleKey).maybeSingle();
        if (!roleRow) return json({ error: 'Cargo no válido.' }, 400);

        // Por ahora solo Director de Edición (key: editor) está habilitado
        if (roleKey !== 'editor') {
            return json({ error: 'Por ahora solo el cargo Director de Edición está disponible.' }, 400);
        }

        let page = 1;
        let existingUser = null;
        while (page <= 50) {
            const { data: pageData, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
            if (listError) return json({ error: listError.message }, 500);
            existingUser = pageData.users.find((u) => (u.email || '').toLowerCase() === email) || null;
            if (existingUser || pageData.users.length < 200) break;
            page += 1;
        }

        if (existingUser) {
            return json({ error: 'Ese correo ya está registrado.' }, 409);
        }

        const fullName = `${firstName} ${lastName}`.trim();
        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                role: 'employee',
                full_name: fullName,
                must_change_password: true,
                created_by: caller.id
            }
        });

        if (createError || !created.user) {
            return json({ error: createError?.message || 'No se pudo crear la cuenta.' }, 400);
        }

        const userId = created.user.id;

        // Asegurar perfil (trigger puede haberlo creado como client)
        const { error: profileError } = await adminClient.from('profiles').upsert({
            id: userId,
            role: 'employee',
            full_name: fullName,
            email,
            is_active: status === 'active',
            created_by: caller.id
        }, { onConflict: 'id' });

        if (profileError) {
            await adminClient.auth.admin.deleteUser(userId);
            return json({ error: `Perfil: ${profileError.message}` }, 400);
        }

        const { data: employee, error: empError } = await adminClient
            .from('employees')
            .insert({
                profile_id: userId,
                first_name: firstName,
                last_name: lastName,
                role_key: roleKey,
                status,
                color_hex: colorHex,
                photo_url: photoUrl,
                created_by: caller.id
            })
            .select('*')
            .single();

        if (empError) {
            await adminClient.auth.admin.deleteUser(userId);
            return json({ error: `Empleado: ${empError.message}` }, 400);
        }

        return json({
            success: true,
            employee,
            temporaryPassword: password,
            email
        });
    } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
    }
});
