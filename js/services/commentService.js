/* ==========================================================
   NEXA HUB — Servicio: Comentarios (polimórfico)
   ==========================================================
   El autor de un comentario puede ser un admin o un cliente
   distinto al usuario actual, y las políticas RLS de "profiles"
   no permiten leer el perfil de otra persona directamente. Por
   eso el nombre/rol se resuelve con la función SECURITY DEFINER
   get_public_profiles() (expone solo id/full_name/avatar_url/role,
   nunca email ni teléfono). Ver migración
   create_get_public_profiles_function.sql.
   ========================================================== */
import { supabase } from './supabaseClient.js';

async function attachAuthorProfiles(comments) {
    const authorIds = [...new Set(comments.map((c) => c.author_id))];
    if (!authorIds.length) return comments;

    const { data: profiles, error } = await supabase.rpc('get_public_profiles', { profile_ids: authorIds });
    if (error) {
        console.error('[commentService] No se pudieron resolver los autores:', error.message);
        return comments;
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    return comments.map((c) => ({ ...c, profiles: profileMap.get(c.author_id) || null }));
}

/**
 * @param {'project'|'phase'|'task'|'deliverable'} commentableType
 */
export async function listComments(projectId, commentableType = null, commentableId = null) {
    let query = supabase
        .from('project_comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

    if (commentableType && commentableId) {
        query = query.eq('commentable_type', commentableType).eq('commentable_id', commentableId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return attachAuthorProfiles(data || []);
}

export async function addComment({ projectId, commentableType, commentableId, authorId, body, attachmentFileId }) {
    const { data, error } = await supabase
        .from('project_comments')
        .insert({
            project_id: projectId,
            commentable_type: commentableType,
            commentable_id: commentableId,
            author_id: authorId,
            body,
            attachment_file_id: attachmentFileId || null
        })
        .select('*')
        .single();
    if (error) throw error;
    const [withAuthor] = await attachAuthorProfiles([data]);
    return withAuthor;
}
