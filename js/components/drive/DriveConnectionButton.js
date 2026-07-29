/* ==========================================================
   DriveConnectionButton — inicia OAuth Google Drive (admin)
   ========================================================== */
import { startGoogleDriveOAuth } from '../../services/driveApiService.js';

export function renderDriveConnectionButton({
    label = 'Conectar Google Drive',
    projectId = null,
    returnUrl = null,
    className = 'admin-btn-primary'
} = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.innerHTML = `<span>${label}</span>`;
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.innerHTML = '<span>Conectando…</span>';
        try {
            await startGoogleDriveOAuth({
                projectId,
                returnUrl: returnUrl || window.location.href.split('#')[0]
            });
        } catch (error) {
            alert(error.message || 'No se pudo iniciar la conexión con Google.');
            btn.disabled = false;
            btn.innerHTML = original;
        }
    });
    return btn;
}
