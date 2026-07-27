/* ==========================================================
   NEXA HUB — Componente: modal "Contraseña temporal" (una vez)
   ==========================================================
   Muestra una contraseña temporal recién creada/regenerada para
   que el administrador la copie y se la envíe al cliente por su
   canal habitual. No la guarda en ningún lado: solo vive en la
   memoria de este módulo mientras el modal está abierto.
   ========================================================== */

const overlay = document.getElementById('passwordRevealModalOverlay');
const messageEl = document.getElementById('passwordRevealMessage');
const valueInput = document.getElementById('passwordRevealValue');
const copyBtn = document.getElementById('passwordRevealCopyBtn');
const closeBtn = document.getElementById('passwordRevealClose');
const doneBtn = document.getElementById('passwordRevealDoneBtn');

function close() {
    if (!overlay) return;
    overlay.classList.remove('active');
    if (valueInput) valueInput.value = '';
}

/**
 * @param {{message:string, password:string}} options
 */
export function openPasswordRevealModal(options) {
    if (!overlay) return;
    if (messageEl) messageEl.textContent = options.message || 'Contraseña temporal generada correctamente.';
    if (valueInput) valueInput.value = options.password || '';
    overlay.classList.add('active');
}

if (copyBtn) {
    copyBtn.addEventListener('click', async function () {
        if (!valueInput || !valueInput.value) return;
        try {
            await navigator.clipboard.writeText(valueInput.value);
            const original = copyBtn.textContent;
            copyBtn.textContent = 'Copiado';
            setTimeout(function () { copyBtn.textContent = original; }, 1500);
        } catch (e) {
            valueInput.select();
            document.execCommand('copy');
        }
    });
}

if (closeBtn) closeBtn.addEventListener('click', close);
if (doneBtn) doneBtn.addEventListener('click', close);

if (overlay) {
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) close();
    });
}
