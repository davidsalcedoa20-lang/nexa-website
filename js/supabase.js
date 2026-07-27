/* ==========================================================
   NEXA — Conexión centralizada con Supabase
   ==========================================================
   Este archivo crea UNA sola instancia del cliente de Supabase
   y la exporta para que cualquier página/script del proyecto
   pueda reutilizarla, en lugar de crear conexiones repetidas.

   NO implementa autenticación.
   NO consulta ni crea tablas.
   Solo deja la conexión lista para usarse más adelante.

   ---------------------------------------------------------
   CÓMO USARLO EN UNA PÁGINA
   ---------------------------------------------------------
   Antes de este archivo deben cargarse, en este orden:

     1. js/vendor/supabase-js.min.js   (la librería)
     2. js/env.js                      (tus credenciales locales)

   Ejemplo dentro de un <script type="module">:

     <script src="js/vendor/supabase-js.min.js"></script>
     <script src="js/env.js"></script>
     <script type="module">
       import { supabase } from './js/supabase.js';

       if (supabase) {
         // Ejemplo futuro (NO implementado todavía):
         // const { data, error } = await supabase.from('proyectos').select('*');
       }
     </script>

   Desde una página dentro de /pages, /portal o /dashboard,
   ajusta las rutas con "../" según corresponda.
   ========================================================== */

const env = window.__ENV__ || {};

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

/* window.supabaseLib aquí es el espacio de nombres global que expone la
   librería vendored (js/vendor/supabase-js.min.js), no el cliente conectado. */
const supabaseLib = window.supabase;

let client = null;

if (!supabaseLib) {
    console.error(
        '[Supabase] No se encontró la librería. Asegúrate de incluir ' +
        '"js/vendor/supabase-js.min.js" antes de "js/supabase.js".'
    );
} else if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
        '[Supabase] Faltan las variables SUPABASE_URL / SUPABASE_ANON_KEY. ' +
        'Completa "js/env.js" (usa "js/env.example.js" como referencia) ' +
        'con los datos de tu proyecto en https://app.supabase.com. ' +
        'La conexión no se creará hasta que estén completas.'
    );
} else {
    try {
        client = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
        console.error('[Supabase] No se pudo crear el cliente:', error.message);
    }
}

/* Instancia lista para usar en cualquier página.
   Será "null" hasta que "js/env.js" tenga credenciales válidas. */
export const supabase = client;
