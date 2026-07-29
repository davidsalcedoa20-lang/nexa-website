/* ==========================================================
   NEXA HUB — ERP Financiero: formato y fechas
   ========================================================== */
const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function currentMonthKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

export function parseMonthKey(monthKey) {
    const [y, m] = String(monthKey || '').split('-').map(Number);
    if (!y || !m) {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    return { year: y, month: m };
}

export function formatMonthLabel(monthKey) {
    const { year, month } = parseMonthKey(monthKey);
    return `${MONTHS_ES[month - 1]} ${year}`;
}

export function shiftMonth(monthKey, delta) {
    const { year, month } = parseMonthKey(monthKey);
    const d = new Date(year, month - 1 + delta, 1);
    return currentMonthKey(d);
}

export function monthDateRange(monthKey) {
    const { year, month } = parseMonthKey(monthKey);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
}

export function formatMoney(amount, { currency = 'COP', locale = 'es-CO' } = {}) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return '—';
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            maximumFractionDigits: currency === 'COP' ? 0 : 2
        }).format(value);
    } catch (_) {
        return `${value.toLocaleString('es-CO')} ${currency}`;
    }
}

export function formatVariation(pct) {
    if (pct === null || pct === undefined || Number.isNaN(Number(pct))) {
        return { text: '— vs mes anterior', tone: 'neutral' };
    }
    const n = Number(pct);
    const sign = n > 0 ? '+' : '';
    return {
        text: `${sign}${n.toFixed(1)}% vs mes anterior`,
        tone: n > 0 ? 'up' : n < 0 ? 'down' : 'neutral'
    };
}

export function buildMonthOptions(centerKey = currentMonthKey(), radius = 8) {
    const options = [];
    for (let i = -radius; i <= radius; i += 1) {
        const key = shiftMonth(centerKey, i);
        options.push({ key, label: formatMonthLabel(key) });
    }
    return options;
}
