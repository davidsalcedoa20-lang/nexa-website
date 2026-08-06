/* ==========================================================
   NEXA HUB — Servicio de Clientes
   ==========================================================
   ÚNICO archivo del módulo "Clientes" que habla con Supabase.
   Ningún componente ni página debe escribir consultas aquí
   dentro: todos importan estas funciones.

   Modelo de datos:
     - Un "Cliente" = una fila en profiles (role = 'client')
       + su workspace asociado (workspaces.client_id -> profiles.id).
     - Crear un cliente implica crear su cuenta real en Supabase
       Auth, lo cual requiere privilegios de administrador
       (service_role key) que NUNCA deben vivir en el navegador.
       Por eso createClient() no inserta directamente: llama a
       la Edge Function "create-client" (ver
       supabase/functions/create-client/index.ts), que sí corre
       en el servidor con esos privilegios.
     - updateClient() y deleteClient():
         · updateClient() llama a la Edge Function "update-client"
           (puede cambiar correo en Auth + profiles).
         · deleteClient() borra el workspace directo vía RLS.
   ========================================================== */

import { supabase } from '../supabase/client.js';

/**
 * Lista todos los clientes (workspaces + datos de contacto del
 * perfil asociado), ordenados del más reciente al más antiguo.
 * NO incluye el conteo de proyectos activos (ver getActiveProjectsCount).
 */
export async function listClients() {
    const { data, error } = await supabase
        .from('workspaces')
        .select(`
            id,
            name,
            city,
            notes,
            status,
            created_at,
            client_id,
            profiles:client_id ( id, full_name, email, phone )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return (data || []).map(function (row) {
        const profile = row.profiles || {};

        return {
            workspaceId: row.id,
            profileId: row.client_id,
            company: row.name,
            city: row.city || '',
            notes: row.notes || '',
            status: row.status,
            createdAt: row.created_at,
            contact: profile.full_name || '—',
            email: profile.email || '—',
            phone: profile.phone || ''
        };
    });
}

/**
 * Cuenta los proyectos con estado "in_progress" de un workspace.
 * Todavía no existen proyectos en el sistema, así que hoy
 * siempre devolverá 0 — es una consulta real, no un dato simulado.
 */
export async function getActiveProjectsCount(workspaceId) {
    const { count, error } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'in_progress');

    if (error) {
        console.error('[clientService] Error contando proyectos activos:', error.message);
        return 0;
    }

    return count || 0;
}

/**
 * Crea un cliente nuevo de punta a punta (cuenta en Auth + perfil
 * + workspace) a través de la Edge Function "create-client".
 * No crea ningún proyecto.
 *
 * La contraseña temporal ("password") la define el administrador
 * en el formulario y viaja cifrada (HTTPS) directo a la Edge
 * Function, que es la única que puede establecerla en Supabase
 * Auth (Admin API). Nunca se guarda en ninguna tabla ni se expone
 * la service_role key en el navegador.
 *
 * @param {{company:string, contact:string, email:string, phone?:string, city?:string, notes?:string, password:string}} payload
 * @returns {Promise<{success:boolean, workspace:object, userId:string, temporaryPassword:string}>}
 */
export async function createClient(payload) {
    const { data, error } = await supabase.functions.invoke('create-client', {
        body: payload
    });

    if (error) {
        // supabase.functions.invoke no siempre trae el mensaje real del
        // servidor en "error.message" (a veces solo dice "non-2xx status").
        const serverMessage = data && data.error;
        throw new Error(serverMessage || error.message || 'No se pudo crear el cliente.');
    }

    if (data && data.error) {
        throw new Error(data.error);
    }

    return data;
}

/**
 * Regenera la contraseña temporal de un cliente ya existente a
 * través de la Edge Function "reset-client-password". Marca
 * must_change_password = true para que el cliente sea obligado a
 * definir una contraseña nueva en su próximo inicio de sesión.
 *
 * @param {{profileId:string, password:string}} payload
 * @returns {Promise<{success:boolean, temporaryPassword:string}>}
 */
export async function resetClientPassword(payload) {
    const { data, error } = await supabase.functions.invoke('reset-client-password', {
        body: payload
    });

    if (error) {
        const serverMessage = data && data.error;
        throw new Error(serverMessage || error.message || 'No se pudo regenerar la contraseña.');
    }

    if (data && data.error) {
        throw new Error(data.error);
    }

    return data;
}

/**
 * Actualiza los datos editables de un cliente ya existente,
 * incluyendo el correo de acceso (Auth + profiles) vía la
 * Edge Function "update-client".
 *
 * @param {{workspaceId:string, profileId:string, company:string, contact:string, email:string, phone?:string, city?:string, notes?:string}} payload
 */
export async function updateClient(payload) {
    const { data, error } = await supabase.functions.invoke('update-client', {
        body: payload
    });

    if (error) {
        const serverMessage = data && data.error;
        throw new Error(serverMessage || error.message || 'No se pudo actualizar el cliente.');
    }

    if (data && data.error) {
        throw new Error(data.error);
    }

    return data;
}

/**
 * Elimina el workspace del cliente (y, en cascada, cualquier
 * proyecto/etapa/tarea que llegara a tener). NO elimina su
 * cuenta de Supabase Auth ni su perfil — solo desvincula su
 * espacio de trabajo. Eliminar la cuenta de Auth requeriría la
 * Admin API (fuera del alcance de esta acción).
 */
export async function deleteClient(workspaceId) {
    const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);

    if (error) {
        throw error;
    }
}
