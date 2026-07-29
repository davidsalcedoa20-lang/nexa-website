/* ==========================================================
   NEXA HUB — ERP: exportar CSV / Excel / PDF
   ========================================================== */
import { formatMoney } from './financeFormat.js';
import { FINANCE_STATUS_LABELS } from './financeCatalog.js';

function downloadBlob(filename, mime, content) {
    const blob = content instanceof Blob
        ? content
        : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function incomeRows(rows, opts) {
    return rows.map((r) => ({
        Fecha: r.entry_date,
        Concepto: r.concept,
        Cliente: r.workspaces?.name || '',
        Proyecto: r.projects?.name || '',
        Categoría: r.finance_categories?.name || '',
        Valor: Number(r.amount || 0),
        IVA: Number(r.tax_amount || 0),
        Total: Number(r.amount || 0) + Number(r.tax_amount || 0),
        Estado: FINANCE_STATUS_LABELS[r.status] || r.status,
        Método: r.finance_payment_methods?.name || '',
        Comprobante: r.voucher_number || '',
        Observaciones: r.notes || ''
    }));
}

function expenseRows(rows) {
    return rows.map((r) => ({
        Fecha: r.entry_date,
        Proveedor: r.vendor_name || '',
        Concepto: r.concept,
        Proyecto: r.projects?.name || '',
        Categoría: r.finance_categories?.name || '',
        Valor: Number(r.amount || 0),
        IVA: Number(r.tax_amount || 0),
        Total: Number(r.amount || 0) + Number(r.tax_amount || 0),
        Estado: FINANCE_STATUS_LABELS[r.status] || r.status,
        Método: r.finance_payment_methods?.name || '',
        Factura: r.invoice_number || '',
        Observaciones: r.notes || ''
    }));
}

function toCsv(objects) {
    if (!objects.length) return '';
    const headers = Object.keys(objects[0]);
    const escape = (v) => {
        const s = String(v ?? '');
        if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    };
    return [headers.join(';'), ...objects.map((o) => headers.map((h) => escape(o[h])).join(';'))].join('\n');
}

export function exportIncomesCsv(rows, filename = 'ingresos.csv') {
    const csv = '\uFEFF' + toCsv(incomeRows(rows));
    downloadBlob(filename, 'text/csv;charset=utf-8', csv);
}

export function exportExpensesCsv(rows, filename = 'gastos.csv') {
    const csv = '\uFEFF' + toCsv(expenseRows(rows));
    downloadBlob(filename, 'text/csv;charset=utf-8', csv);
}

/** Excel-compatible (CSV UTF-8 BOM con extensión .xls). */
export function exportIncomesExcel(rows, filename = 'ingresos.xls') {
    const csv = '\uFEFF' + toCsv(incomeRows(rows));
    downloadBlob(filename, 'application/vnd.ms-excel;charset=utf-8', csv);
}

export function exportExpensesExcel(rows, filename = 'gastos.xls') {
    const csv = '\uFEFF' + toCsv(expenseRows(rows));
    downloadBlob(filename, 'application/vnd.ms-excel;charset=utf-8', csv);
}

export function exportTablePdf({ title, rows, kind = 'income', currency = 'COP', locale = 'es-CO' }) {
    const data = kind === 'income' ? incomeRows(rows) : expenseRows(rows);
    const headers = data[0] ? Object.keys(data[0]) : [];
    const fmt = (v, key) => {
        if (['Valor', 'IVA', 'Total'].includes(key) && typeof v === 'number') {
            return formatMoney(v, { currency, locale });
        }
        return String(v ?? '');
    };

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>
        <style>
            body{font-family:Poppins,Arial,sans-serif;padding:24px;color:#111}
            h1{font-size:18px;margin:0 0 16px}
            table{width:100%;border-collapse:collapse;font-size:11px}
            th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
            th{background:#f3f3f3}
        </style></head><body>
        <h1>${title}</h1>
        <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${data.map((row) => `<tr>${headers.map((h) => `<td>${fmt(row[h], h)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <script>window.onload=()=>window.print()</script>
        </body></html>`;

    const w = window.open('', '_blank');
    if (!w) throw new Error('Permite ventanas emergentes para exportar PDF.');
    w.document.write(html);
    w.document.close();
}
