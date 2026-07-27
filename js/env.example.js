/* ==========================================================
   NEXA — Plantilla de variables de entorno para el navegador
   ==========================================================
   Este proyecto es un sitio estático (HTML/CSS/JS sin backend
   ni bundler), por lo que el navegador NO puede leer el
   archivo ".env" directamente (eso solo funciona con Node.js
   o herramientas de build como Vite/Webpack).

   Este archivo es la versión "puente" que sí puede leer el
   navegador. Debes:

   1. Duplicar este archivo y renombrarlo a "env.js"
      (mismo folder: js/env.js).
   2. Completar los valores con los mismos datos de tu ".env"
      (SUPABASE_URL y SUPABASE_ANON_KEY).
   3. "js/env.js" está incluido en .gitignore, por lo que nunca
      se sube al repositorio. "js/env.example.js" sí se versiona
      como referencia para el equipo.
   ========================================================== */

window.__ENV__ = {
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: ""
};
