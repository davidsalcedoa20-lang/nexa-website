// ==========================================================
// NEXA HUB — Edge Function: delete-employee
// ==========================================================
// Elimina Auth + profile + fila employees.
// Conserva proyectos, videos, comentarios e historial.
// DESPLIEGUE: npx supabase functions deploy delete-employee
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
            .from('profiles')
            .select('role')
            .eq('id', caller.id)
            .maybeSingle();

        if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role)) {
            return json({ error: 'Solo un administrador puede eliminar empleados.' }, 403);
        }

        const body = await req.json().catch(() => ({}));
        const employeeId = String(body.employee_id || '').trim();
        if (!employeeId) return json({ error: 'Falta employee_id.' }, 400);

        const { data: employee, error: empError } = await adminClient
            .from('employees')
            .select('id, profile_id, first_name, last_name')
            .eq('id', employeeId)
            .maybeSingle();

        if (empError) return json({ error: empError.message }, 400);
        if (!employee) return json({ error: 'Empleado no encontrado.' }, 404);

        const profileId = employee.profile_id;

        // Desvincular trabajo antes de borrar la cuenta (por si el FK aún no es SET NULL)
        await adminClient
            .from('employee_projects')
            .update({ employee_id: null })
            .eq('employee_id', employeeId);

        await adminClient
            .from('employee_calendar')
            .update({ employee_id: null })
            .eq('employee_id', employeeId);

        if (profileId) {
            await adminClient
                .from('employee_comments')
                .update({ author_id: null })
                .eq('author_id', profileId);
        }

        // Borrar Auth → cascade profiles → cascade employees
        if (profileId) {
            const { error: delAuthError } = await adminClient.auth.admin.deleteUser(profileId);
            if (delAuthError) {
                // Fallback: borrar fila employees + profile si Auth ya no existe
                await adminClient.from('employees').delete().eq('id', employeeId);
                await adminClient.from('profiles').delete().eq('id', profileId);
                return json({
                    ok: true,
                    warning: delAuthError.message,
                    message: 'Director de Edición eliminado correctamente.'
                });
            }
        } else {
            await adminClient.from('employees').delete().eq('id', employeeId);
        }

        return json({
            ok: true,
            message: 'Director de Edición eliminado correctamente.'
        });
    } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 500);
    }
});
