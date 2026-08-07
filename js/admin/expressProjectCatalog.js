/* ==========================================================
   NEXA HUB — Catálogo tipos de proyecto (Express)
   Fácil de ampliar: agregar objetos al array.
   ========================================================== */

export const EXPRESS_PROJECT_TYPES = [
    { key: 'produccion_audiovisual', label: 'Producción Audiovisual' },
    { key: 'edicion_video', label: 'Edición de Video' },
    { key: 'fotografia', label: 'Fotografía' },
    { key: 'toma_drone', label: 'Toma con Drone' },
    { key: 'pagina_web', label: 'Página Web' },
    { key: 'marketing_digital', label: 'Marketing Digital' },
    { key: 'diseno_grafico', label: 'Diseño Gráfico' },
    { key: 'otro', label: 'Otro' }
];

export const EXPRESS_PROJECT_STATUS = [
    { key: 'not_started', label: 'Sin iniciar' },
    { key: 'in_progress', label: 'En progreso' },
    { key: 'paused', label: 'Pausado' },
    { key: 'in_review', label: 'En revisión' },
    { key: 'completed', label: 'Completado' },
    { key: 'cancelled', label: 'Cancelado' }
];

export function expressProjectTypeLabel(keyOrLabel) {
    const found = EXPRESS_PROJECT_TYPES.find((t) => t.key === keyOrLabel || t.label === keyOrLabel);
    return found?.label || keyOrLabel || 'Otro';
}

export function expressProjectStatusLabel(key) {
    return EXPRESS_PROJECT_STATUS.find((s) => s.key === key)?.label || key || '—';
}
