/* ==========================================================
   NEXA HUB — Utilidad: generador de contraseñas temporales
   ==========================================================
   Se usa SOLO en el panel administrativo (crear cliente /
   regenerar contraseña) para rellenar el campo con una sugerencia
   segura que el admin puede editar antes de enviarla. Se genera
   100% en el navegador con crypto.getRandomValues (nunca se
   guarda ni se envía a ningún sitio hasta que el admin decide
   crear/regenerar el cliente).
   ========================================================== */

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

export function generateTemporaryPassword(length = 12) {
    const values = new Uint32Array(length);
    if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(values);
    } else {
        for (let i = 0; i < length; i += 1) values[i] = Math.floor(Math.random() * 4294967295);
    }

    let password = '';
    for (let i = 0; i < length; i += 1) {
        password += CHARSET[values[i] % CHARSET.length];
    }
    return password;
}
