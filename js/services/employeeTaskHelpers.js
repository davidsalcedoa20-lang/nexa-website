/* ==========================================================
   Helpers compartidos — tareas / videos de empleados
   ========================================================== */

export const TASK_STATUSES = [
    { id: 'pendiente', label: 'Pendiente' },
    { id: 'en_progreso', label: 'En progreso' },
    { id: 'esperando_revision', label: 'Esperando revisión' },
    { id: 'finalizado', label: 'Finalizado' }
];

export const CHECKLIST_ITEMS = [
    { id: 'material_descargado', label: 'Material descargado' },
    { id: 'edicion_iniciada', label: 'Edición iniciada' },
    { id: 'correccion_aplicada', label: 'Corrección aplicada' },
    { id: 'render_final', label: 'Render final' },
    { id: 'video_entregado', label: 'Video entregado' }
];

export function normalizeTaskStatus(status) {
    if (status === 'en_edicion') return 'en_progreso';
    if (status === 'entregado') return 'finalizado';
    return status || 'pendiente';
}

export function statusLabel(status) {
    const id = normalizeTaskStatus(status);
    return TASK_STATUSES.find((s) => s.id === id)?.label || id;
}

export function folderDisplayName(task) {
    if (task?.drive_folder_name) return task.drive_folder_name;
    const url = task?.drive_url || task?.folder_url || '';
    if (!url) return 'Sin carpeta';
    try {
        const u = new URL(url);
        return u.pathname.split('/').filter(Boolean).pop() || 'Carpeta de Drive';
    } catch {
        return 'Carpeta de Drive';
    }
}

/** Comprime una imagen File a dataURL JPEG (máx ~ width px). */
export function compressImageFile(file, maxWidth = 960, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('Selecciona una imagen válida.'));
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('Imagen inválida.'));
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

export function formatTaskDate(iso) {
    if (!iso) return '—';
    const d = iso.length <= 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatRelativeActivity(iso) {
    if (!iso) return 'Sin actividad';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days} d`;
    return formatTaskDate(iso);
}
