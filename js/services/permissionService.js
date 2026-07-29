/* ==========================================================
   NEXA HUB — Servicio de permisos
   ========================================================== */
import { supabase } from './supabaseClient.js';
import { ALL_PERMISSION_KEYS } from '../components/permissions/permissionCatalog.js';

let cachedProfile = null;
let cachedKeys = null;
let cacheUserId = null;

export function clearPermissionCache() {
    cachedProfile = null;
    cachedKeys = null;
    cacheUserId = null;
}

export async function getCurrentStaffProfile() {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return null;

    if (cacheUserId === userId && cachedProfile) return cachedProfile;

    const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, email, avatar_url, job_title, is_active, project_access_mode')
        .eq('id', userId)
        .maybeSingle();
    if (error) throw error;

    cachedProfile = data;
    cacheUserId = userId;
    return data;
}

export async function loadMyPermissionKeys({ force = false } = {}) {
    const profile = await getCurrentStaffProfile();
    if (!profile) return [];

    if (!force && cacheUserId === profile.id && cachedKeys) return cachedKeys;

    if (profile.role === 'owner') {
        cachedKeys = [...ALL_PERMISSION_KEYS];
        return cachedKeys;
    }

    const { data, error } = await supabase.rpc('get_my_permissions');
    if (error) throw error;
    cachedKeys = (data || []).map((row) => row.permission_key || row);
    return cachedKeys;
}

export async function hasPermission(key) {
    const profile = await getCurrentStaffProfile();
    if (!profile) return false;
    if (profile.role === 'owner') return true;
    const keys = await loadMyPermissionKeys();
    return keys.includes(key);
}

export async function hasAnyPermission(keys = []) {
    if (!keys.length) return true;
    for (const key of keys) {
        if (await hasPermission(key)) return true;
    }
    return false;
}

export async function isOwner() {
    const profile = await getCurrentStaffProfile();
    return profile?.role === 'owner';
}

/** Lista staff (admin + owner) con conteo de permisos. */
export async function listStaffUsers() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role, job_title, is_active, project_access_mode, created_at')
        .in('role', ['admin', 'owner'])
        .order('full_name', { ascending: true });
    if (error) throw error;

    const ids = (profiles || []).map((p) => p.id);
    if (!ids.length) return [];

    const { data: perms, error: permError } = await supabase
        .from('user_permissions')
        .select('user_id, permission_key')
        .in('user_id', ids);
    if (permError) throw permError;

    const countByUser = new Map();
    (perms || []).forEach((row) => {
        countByUser.set(row.user_id, (countByUser.get(row.user_id) || 0) + 1);
    });

    return (profiles || []).map((p) => ({
        ...p,
        permission_count: p.role === 'owner' ? ALL_PERMISSION_KEYS.length : (countByUser.get(p.id) || 0)
    }));
}

export async function getUserPermissionKeys(userId) {
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .maybeSingle();
    if (profile?.role === 'owner') return [...ALL_PERMISSION_KEYS];

    const { data, error } = await supabase
        .from('user_permissions')
        .select('permission_key')
        .eq('user_id', userId);
    if (error) throw error;
    return (data || []).map((r) => r.permission_key);
}

export async function getUserProjectAccess(userId) {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role, project_access_mode')
        .eq('id', userId)
        .single();
    if (error) throw error;

    const { data: access, error: accessError } = await supabase
        .from('admin_project_access')
        .select('project_id')
        .eq('user_id', userId);
    if (accessError) throw accessError;

    return {
        mode: profile.project_access_mode || 'all',
        projectIds: (access || []).map((r) => r.project_id)
    };
}

/**
 * Reemplaza permisos + modo de acceso a proyectos de un admin.
 * El propietario no se edita (bloqueado en UI y trigger).
 */
export async function saveUserAccess({
    userId,
    permissionKeys = [],
    projectAccessMode = 'all',
    projectIds = []
} = {}) {
    const { data: auth } = await supabase.auth.getUser();
    const actorId = auth?.user?.id || null;

    const { data: target, error: targetError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .single();
    if (targetError) throw targetError;
    if (target.role === 'owner') {
        throw new Error('Los permisos del propietario no se pueden modificar.');
    }

    const uniqueKeys = [...new Set(permissionKeys.filter((k) => ALL_PERMISSION_KEYS.includes(k)))];

    // Mutua exclusión view_all / view_assigned (prioridad a view_all)
    let keys = uniqueKeys;
    if (keys.includes('projects.view_all')) {
        keys = keys.filter((k) => k !== 'projects.view_assigned');
    }

    const mode = projectAccessMode === 'selected' ? 'selected' : 'all';
    if (mode === 'all' && !keys.includes('projects.view_all') && !keys.includes('projects.view_assigned')) {
        keys.push('projects.view_all');
    }
    if (mode === 'selected') {
        keys = keys.filter((k) => k !== 'projects.view_all');
        if (!keys.includes('projects.view_assigned')) keys.push('projects.view_assigned');
    }

    const { error: modeError } = await supabase
        .from('profiles')
        .update({ project_access_mode: mode })
        .eq('id', userId);
    if (modeError) throw modeError;

    const { error: delPermError } = await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);
    if (delPermError) throw delPermError;

    if (keys.length) {
        const rows = keys.map((permission_key) => ({
            user_id: userId,
            permission_key,
            granted_by: actorId
        }));
        const { error: insError } = await supabase.from('user_permissions').insert(rows);
        if (insError) throw insError;
    }

    const { error: delAccessError } = await supabase
        .from('admin_project_access')
        .delete()
        .eq('user_id', userId);
    if (delAccessError) throw delAccessError;

    if (mode === 'selected' && projectIds.length) {
        const rows = [...new Set(projectIds)].map((project_id) => ({
            user_id: userId,
            project_id
        }));
        const { error: accessInsError } = await supabase.from('admin_project_access').insert(rows);
        if (accessInsError) throw accessInsError;
    }

    if (cacheUserId === userId) clearPermissionCache();
    return { permissionKeys: keys, projectAccessMode: mode, projectIds: mode === 'selected' ? projectIds : [] };
}
