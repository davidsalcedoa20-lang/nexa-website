/* ==========================================================
   NEXA HUB — Re-export del cliente Supabase para js/services/*
   ==========================================================
   Todos los servicios del motor de Proyectos importan desde
   aquí en vez de referenciar rutas relativas distintas según
   dónde vivan (admin/ o dashboard/).
   ========================================================== */
export { supabase } from '../supabase.js';
