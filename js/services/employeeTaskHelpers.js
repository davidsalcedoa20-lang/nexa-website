/* ==========================================================
   Helpers compartidos — tareas / videos de empleados
   ========================================================== */

export const TASK_STATUSES = [
    { id: 'pendiente', label: 'Pendiente' },
    { id: 'en_progreso', label: 'En edición' },
    { id: 'esperando_revision', label: 'En revisión' },
    { id: 'finalizado', label: 'Entregado' }
];

export const PRIORITY_OPTIONS = [
    { id: 'alta', label: 'Alta' },
    { id: 'media', label: 'Media' },
    { id: 'baja', label: 'Baja' }
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

export function priorityLabel(priority) {
    return PRIORITY_OPTIONS.find((p) => p.id === priority)?.label || priority || 'Media';
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

/** Normaliza checklist a array [{id,label,done}]. */
export function normalizeChecklist(raw) {
    if (Array.isArray(raw)) {
        return raw.map((item, i) => ({
            id: String(item.id || `item-${i}`),
            label: String(item.label || item.title || 'Tarea'),
            done: !!item.done
        }));
    }
    if (raw && typeof raw === 'object') {
        return Object.entries(raw).map(([id, done]) => ({
            id,
            label: id.replace(/_/g, ' '),
            done: !!done
        }));
    }
    return [];
}

export function checklistProgress(list) {
    const items = normalizeChecklist(list);
    if (!items.length) return 0;
    const done = items.filter((i) => i.done).length;
    return Math.round((done / items.length) * 100);
}

export function deliveryUrgency(iso) {
    if (!iso) return 'neutral';
    const d = iso.length <= 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const days = Math.round((d - today) / 86400000);
    if (days < 0) return 'danger';
    if (days <= 2) return 'danger';
    if (days <= 5) return 'warn';
    return 'ok';
}

export function formatDeliveryShort(iso) {
    if (!iso) return 'Sin fecha';
    const d = iso.length <= 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

/** Comprime una imagen File a dataURL JPEG. */
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

export function newChecklistId() {
    return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
