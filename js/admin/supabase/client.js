/* ==========================================================
   NEXA HUB — Panel Administrativo / capa "supabase"
   ==========================================================
   Este archivo NO crea una nueva conexión: re-exporta el único
   cliente de Supabase ya centralizado en js/supabase.js, para
   que los servicios del panel (js/admin/services/*) lo importen
   desde una ruta consistente con la estructura del módulo:

     js/admin/
       supabase/    <- estás aquí
       services/
       components/
       pages/

   No agregues aquí lógica de negocio ni consultas: eso vive en
   js/admin/services/*.
   ========================================================== */

export { supabase } from '../../supabase.js';
