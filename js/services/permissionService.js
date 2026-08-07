/* ==========================================================
   NEXA HUB — Servicio de permisos (modelo simplificado)
   ========================================================== */
import { supabase } from './supabaseClient.js';
import {
    ALL_PERMISSION_KEYS,
    projectKeyForMode,
    resolveProjectAccessMode
} from '../components/permissions/permissionCatalog.js';

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

/** Lista staff (admin + owner). */
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

    const keysByUser = new Map();
    (perms || []).forEach((row) => {
        const list = keysByUser.get(row.user_id) || [];
        list.push(row.permission_key);
        keysByUser.set(row.user_id, list);
    });

    return (profiles || []).map((p) => {
        const keys = p.role === 'owner' ? [...ALL_PERMISSION_KEYS] : (keysByUser.get(p.id) || []);
        return {
            ...p,
            permission_keys: keys,
            permission_count: keys.length,
            project_mode: resolveProjectAccessMode(keys, p.project_access_mode)
        };
    });
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

    const keys = await getUserPermissionKeys(userId);
    const { data: access, error: accessError } = await supabase
        .from('admin_project_access')
        .select('project_id')
        .eq('user_id', userId);
    if (accessError) throw accessError;

    return {
        mode: resolveProjectAccessMode(keys, profile.project_access_mode || 'all'),
        projectIds: (access || []).map((r) => r.project_id)
    };
}

/**
 * Construye keys finales a partir del modo de proyectos + empleados.
 */
export function buildSimplePermissionKeys({ projectMode = 'all', employeesManage = false } = {}) {
    const keys = [projectKeyForMode(projectMode)];
    if (employeesManage) keys.push('employees.manage');
    return keys;
}
