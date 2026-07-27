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
     - updateClient() y deleteClient() SÍ se hacen directo desde
       aquí, porque solo modifican/borran filas ya existentes y
       el admin autenticado ya tiene permiso vía RLS
       (profiles_admin_all / workspaces_admin_all).
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
 * @param {{company:string, contact:string, email:string, phone?:string, city?:string, notes?:string}} payload
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
 * Actualiza los datos editables de un cliente ya existente.
 * El correo NO se puede editar aquí (cambiar el email de Auth
 * requiere la Admin API); se mantiene el que ya tiene.
 *
 * @param {{workspaceId:string, profileId:string, company:string, contact:string, phone?:string, city?:string, notes?:string}} payload
 */
export async function updateClient(payload) {
    const { workspaceId, profileId, company, contact, phone, city, notes } = payload;

    const { error: workspaceError } = await supabase
        .from('workspaces')
        .update({
            name: company,
            city: city || null,
            notes: notes || null
        })
        .eq('id', workspaceId);

    if (workspaceError) {
        throw workspaceError;
    }

    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            full_name: contact,
            phone: phone || null
        })
        .eq('id', profileId);

    if (profileError) {
        throw profileError;
    }
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
