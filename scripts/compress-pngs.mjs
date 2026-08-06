/**
 * Comprime PNG de marketing in-place (misma ruta, menor peso).
 * Uso: node scripts/compress-pngs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
    { rel: 'assets/logo/nexa-logo.png', width: 1024, quality: 90 },
    { rel: 'assets/images/laptop-nexa.png', width: 1400, quality: 85 },
    { rel: 'assets/portafolio/audiovisual/miniatura/Camara.png', width: 1400, quality: 85 },
    { rel: 'assets/portafolio/dron/miniatura/Dron.png', width: 1400, quality: 85 }
];

async function loadSharp() {
    try {
        return (await import('sharp')).default;
    } catch (firstErr) {
        try {
            const require = createRequire(path.join(ROOT, 'scripts', 'compress-pngs.mjs'));
            return require('sharp');
        } catch {
            console.log('[compress] Instalando sharp temporalmente…');
            const r = spawnSync('npm', ['install', 'sharp', '--no-save', '--no-package-lock'], {
                cwd: ROOT,
                shell: true,
                stdio: 'inherit'
            });
            if (r.status !== 0) throw firstErr;
            return (await import('sharp')).default;
        }
    }
}

async function compressOne(sharp, job) {
    const filePath = path.join(ROOT, job.rel);
    if (!fs.existsSync(filePath)) {
        console.warn('[skip]', job.rel);
        return;
    }
    const before = fs.statSync(filePath).size;
    const meta = await sharp(filePath).metadata();
    const tmp = filePath + '.tmp.png';
    await sharp(filePath)
        .resize({ width: job.width, withoutEnlargement: true })
        .png({ compressionLevel: 9, quality: job.quality, effort: 10 })
        .toFile(tmp);

    const after = fs.statSync(tmp).size;
    if (after < before) {
        fs.renameSync(tmp, filePath);
        console.log(
            `[ok] ${job.rel}: ${meta.width}x${meta.height} ${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024).toFixed(1)}KB (−${Math.round((1 - after / before) * 100)}%)`
        );
    } else {
        fs.unlinkSync(tmp);
        console.log(`[keep] ${job.rel}: sin ganancia útil`);
    }
}

const sharp = await loadSharp();
for (const job of TARGETS) {
    await compressOne(sharp, job);
}
console.log('[compress] listo');
