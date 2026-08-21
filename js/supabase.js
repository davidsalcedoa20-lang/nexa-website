/* ==========================================================
   NEXA — Conexión centralizada con Supabase
   ==========================================================
   Este archivo es el ÚNICO punto de configuración de Supabase
   en todo el proyecto. Crea UNA sola instancia del cliente y la
   exporta para que cualquier página/módulo la reutilice.

   ---------------------------------------------------------
   DE DÓNDE SALEN LAS CREDENCIALES (SUPABASE_URL / ANON_KEY)
   ---------------------------------------------------------
   Ya NO se leen de "window.__ENV__" ni de ningún archivo
   "js/env.js" creado a mano. En su lugar, se piden en tiempo de
   ejecución al endpoint "/api/config" (ver api/config.js), que
   a su vez las toma de:

     - Vercel > Project Settings > Environment Variables, en
       producción y previews.
     - El archivo ".env.local" en la raíz del proyecto, cuando
       se desarrolla localmente con "vercel dev" (Vercel CLI lo
       carga automáticamente, sin librerías adicionales).

   Esto permite que el mismo código funcione igual en localhost
   y en producción, sin depender de ningún archivo ignorado por
   git dentro de "js/".

   ---------------------------------------------------------
   CÓMO USARLO EN UNA PÁGINA
   ---------------------------------------------------------
   Antes de este archivo debe cargarse:

     1. js/vendor/supabase-js.min.js   (la librería)

   Ejemplo dentro de un <script type="module">:

     <script src="js/vendor/supabase-js.min.js"></script>
     <script type="module">
       import { supabase } from './js/supabase.js';

       if (supabase) {
         const { data, error } = await supabase.from('proyectos').select('*');
       }
     </script>

   Desde un <script> clásico (no module), usa import() dinámico:

     const { supabase } = await import('./js/supabase.js');

   Desde una página dentro de /pages, /portal, /dashboard o
   /admin, ajusta la ruta relativa con "../" según corresponda.
   ========================================================== */

async function fetchPublicConfig() {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 10000) : null;
    try {
        const response = await fetch('/api/config', {
            cache: 'no-store',
            signal: controller?.signal
        });
        const body = await response.json().catch(() => null);

        if (!response.ok || !body || !body.SUPABASE_URL || !body.SUPABASE_ANON_KEY) {
            console.warn(
                '[Supabase] No se pudo obtener la configuración desde "/api/config". ' +
                (body && body.error ? body.error : 'Verifica SUPABASE_URL / SUPABASE_ANON_KEY.') +
                ' Si estás en desarrollo local, asegúrate de ejecutar el proyecto con "vercel dev" ' +
                '(no un servidor estático simple) y de tener un archivo ".env.local" con esas variables.'
            );
            return null;
        }

        return body;
    } catch (error) {
        console.error(
            '[Supabase] Error consultando "/api/config":',
            error.name === 'AbortError' ? 'timeout (10s)' : error.message,
            '— ¿estás sirviendo el proyecto con "vercel dev"?'
        );
        return null;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/* window.supabase aquí es el espacio de nombres global que expone la
   librería vendored (js/vendor/supabase-js.min.js), no el cliente conectado. */
const supabaseLib = window.supabase;

let client = null;

if (!supabaseLib) {
    console.error(
        '[Supabase] No se encontró la librería. Asegúrate de incluir ' +
        '"js/vendor/supabase-js.min.js" antes de "js/supabase.js".'
    );
} else {
    const config = await fetchPublicConfig();

    if (config) {
        try {
            client = supabaseLib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        } catch (error) {
            console.error('[Supabase] No se pudo crear el cliente:', error.message);
        }
    }
}

/* Instancia lista para usar en cualquier página.
   Será "null" si "/api/config" no devolvió credenciales válidas. */
export const supabase = client;
