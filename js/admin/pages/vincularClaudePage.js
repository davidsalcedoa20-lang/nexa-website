/* ==========================================================
   NEXA HUB — Página: Vincular Claude (admin/vincular-claude.html)
   ==========================================================
   Genera el código de un solo uso para NEXA MCP llamando a la
   Edge Function "mcp-link" (acción "create"). Esta página NUNCA
   ve ni maneja tokens de sesión — solo pide y muestra el código
   de 6 dígitos. El canje (acción "redeem") ocurre del lado del
   MCP, no aquí.
   ========================================================== */
import { supabase } from '../../services/supabaseClient.js';

const idleState = document.getElementById('mcpLinkIdle');
const resultState = document.getElementById('mcpLinkResult');
const codeEl = document.getElementById('mcpLinkCode');
const countdownEl = document.getElementById('mcpLinkCountdown');
const errorEl = document.getElementById('mcpLinkError');
const generateBtn = document.getElementById('mcpLinkGenerate');
const regenerateBtn = document.getElementById('mcpLinkRegenerate');

let countdownTimer = null;

function showError(message) {
    errorEl.textContent = message || 'No se pudo generar el código.';
    errorEl.classList.add('active');
}

function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('active');
}

function stopCountdown() {
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

function startCountdown(expiresInSeconds) {
    stopCountdown();
    let remaining = expiresInSeconds;

    function render() {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        countdownEl.textContent = remaining > 0
            ? `Válido por ${m}:${String(s).padStart(2, '0')}`
            : 'Código vencido — genera uno nuevo.';
    }

    render();
    countdownTimer = setInterval(() => {
        remaining -= 1;
        render();
        if (remaining <= 0) stopCountdown();
    }, 1000);
}

async function generateCode() {
    clearError();
    generateBtn.disabled = true;
    regenerateBtn.disabled = true;

    try {
        if (!supabase) throw new Error('No hay conexión con Supabase. Recarga la página.');

        const { data, error } = await supabase.functions.invoke('mcp-link', {
            body: { action: 'create' }
        });

        if (error) {
            const serverMessage = data && data.error;
            throw new Error(serverMessage || error.message || 'No se pudo generar el código.');
        }
        if (data && data.error) throw new Error(data.error);
        if (!data || !data.code) throw new Error('Respuesta inesperada del servidor.');

        codeEl.textContent = data.code;
        idleState.style.display = 'none';
        resultState.style.display = 'block';
        startCountdown(data.expires_in || 600);
    } catch (err) {
        showError(err.message);
    } finally {
        generateBtn.disabled = false;
        regenerateBtn.disabled = false;
    }
}

generateBtn?.addEventListener('click', generateCode);
regenerateBtn?.addEventListener('click', generateCode);
