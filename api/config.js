/* ==========================================================
   NEXA HUB — Endpoint de configuración pública (Vercel Function)
   ==========================================================
   ÚNICO punto donde el navegador obtiene las credenciales
   públicas de Supabase (URL + anon key). Reemplaza al antiguo
   "js/env.js" (archivo manual e ignorado por git).

   De dónde vienen las variables:
     - En producción/preview: Vercel Project Settings ->
       Environment Variables (SUPABASE_URL, SUPABASE_ANON_KEY).
     - En desarrollo local: archivo ".env.local" en la raíz del
       proyecto, leído automáticamente por "vercel dev" (no
       requiere ninguna librería adicional).

   Este archivo corre en el servidor (Vercel Serverless
   Function), nunca se descarga al navegador tal cual: solo
   expone lo que explícitamente devolvemos en la respuesta, que
   son datos públicos por diseño (la "anon key" de Supabase está
   pensada para ser pública; el acceso real se controla con RLS).

   NO expone SUPABASE_SERVICE_ROLE_KEY ni ninguna otra variable:
   esta función solo lee y retorna las dos variables públicas.
   ========================================================== */

module.exports = (req, res) => {
    const SUPABASE_URL = process.env.SUPABASE_URL || '';
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

    // Evita que el navegador o un CDN guarden en caché una respuesta
    // vieja si las variables cambian entre despliegues.
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        res.status(500).json({
            error: 'Faltan SUPABASE_URL / SUPABASE_ANON_KEY. Configúralas en ".env.local" (desarrollo) ' +
                'o en Vercel > Project Settings > Environment Variables (producción/preview).'
        });
        return;
    }

    res.status(200).json({
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_ANON_KEY: SUPABASE_ANON_KEY
    });
};
