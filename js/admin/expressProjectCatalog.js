/* ==========================================================
   NEXA HUB — Catálogo tipos de proyecto (Express)
   Fácil de ampliar: agregar objetos al array.
   ========================================================== */

export const EXPRESS_PROJECT_TYPES = [
    { key: 'edicion_video', label: 'Edición de video' },
    { key: 'produccion_audiovisual', label: 'Producción audiovisual' },
    { key: 'toma_video', label: 'Toma de video' },
    { key: 'toma_aerea_drone', label: 'Toma aérea / Drone' },
    { key: 'fotografia', label: 'Fotografía' },
    { key: 'diseno_grafico', label: 'Diseño gráfico' },
    { key: 'desarrollo_web', label: 'Desarrollo web' },
    { key: 'marketing_digital', label: 'Marketing digital' },
    { key: 'otro', label: 'Otro' }
];

/** Estados alineados al vocabulario del Hub (keys = constraint DB). */
export const EXPRESS_PROJECT_STATUS = [
    { key: 'not_started', label: 'Pendiente' },
    { key: 'in_progress', label: 'En proceso' },
    { key: 'in_review', label: 'En revisión' },
    { key: 'completed', label: 'Finalizado' },
    { key: 'paused', label: 'Pausado' },
    { key: 'cancelled', label: 'Cancelado' }
];

export function expressProjectTypeLabel(keyOrLabel) {
    const found = EXPRESS_PROJECT_TYPES.find((t) => t.key === keyOrLabel || t.label === keyOrLabel);
    return found?.label || keyOrLabel || 'Otro';
}

export function expressProjectStatusLabel(key) {
    return EXPRESS_PROJECT_STATUS.find((s) => s.key === key)?.label || key || '—';
}
