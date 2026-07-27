/* ==========================================================
   NEXA HUB — Script de siembra: administradores permanentes
   ==========================================================
   Crea las cuentas de los dos administradores permanentes del
   sistema (David Salcedo y Diego Andrés) usando la Admin API
   de Supabase. El trigger "on_auth_user_created" (ver migración
   06_create_functions_and_triggers.sql) crea automáticamente su
   fila en "profiles" con role = 'admin', leyendo los metadatos
   que este script envía.

   IMPORTANTE — SEGURIDAD:
   - Este script usa la SERVICE_ROLE KEY (clave de administrador
     total de la base de datos). NUNCA debe usarse en el
     navegador ni subirse al repositorio.
   - Ejecútalo UNA sola vez, solo localmente, desde tu propia
     máquina.
   - Requiere que las migraciones (supabase/migrations) ya estén
     aplicadas en el proyecto.

   CÓMO EJECUTARLO (PowerShell):
     $env:SUPABASE_URL = "https://aeulqdihlxsvznviyozk.supabase.co"
     $env:SUPABASE_SERVICE_ROLE_KEY = "TU_SERVICE_ROLE_KEY"
     node scripts/seed-admins.mjs

   La service role key se obtiene en:
     Supabase Dashboard > Settings > API > service_role (secret)
   ========================================================== */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
        '\n[Error] Faltan variables de entorno.\n' +
        'Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY antes de ejecutar este script.\n'
    );
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

/* ----------------------------------------------------------
   Administradores permanentes del sistema (datos confirmados).
   Para agregar un tercer admin en el futuro, solo se agrega
   un elemento más a esta lista (la arquitectura ya soporta
   múltiples administradores sin cambios de esquema).
   ---------------------------------------------------------- */
const ADMINS = [
    { full_name: 'David Salcedo', email: 'davidsalcedoa2.0@gmail.com' },
    { full_name: 'Diego Andrés', email: 'salcedoagudelodiegoandres@gmail.com' }
];

async function seedAdmins() {
    for (const admin of ADMINS) {
        if (admin.email.startsWith('REEMPLAZAR')) {
            console.warn(`[Omitido] Reemplaza el correo real de "${admin.full_name}" antes de ejecutar.`);
            continue;
        }

        console.log(`Invitando a ${admin.full_name} (${admin.email})...`);

        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(admin.email, {
            data: {
                role: 'admin',
                full_name: admin.full_name
            }
        });

        if (error) {
            console.error(`  ✗ Error con ${admin.email}:`, error.message);
            continue;
        }

        console.log(`  ✓ Invitación enviada. auth.users.id = ${data.user.id}`);
    }
}

seedAdmins().then(() => {
    console.log('\nListo. Cada administrador recibirá un correo para definir su contraseña.');
});
