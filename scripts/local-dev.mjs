/**
 * Servidor local sin login de Vercel.
 * Sirve archivos estáticos + GET /api/config desde .env.local
 *
 * Uso: npm run dev:local
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

function loadEnvLocal() {
    const envPath = path.join(ROOT, '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('[local-dev] Falta .env.local en la raíz del proyecto.');
        console.error('           Copia .env.example → .env.local y completa SUPABASE_URL / SUPABASE_ANON_KEY.');
        process.exit(1);
    }

    const env = {};
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
    return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[local-dev] SUPABASE_URL / SUPABASE_ANON_KEY vacías en .env.local');
    process.exit(1);
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.webm': 'video/webm',
    '.mp4': 'video/mp4',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json'
};

function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(payload)
    });
    res.end(payload);
}

function safeResolve(urlPath) {
    const decoded = decodeURIComponent(urlPath.split('?')[0]);
    const relative = decoded === '/' ? '/index.html' : decoded;
    const resolved = path.resolve(ROOT, '.' + relative);
    if (!resolved.startsWith(ROOT)) return null;
    return resolved;
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/config') {
        return sendJson(res, 200, {
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        });
    }

    let filePath = safeResolve(url.pathname);
    if (!filePath) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404).end('Not found');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
    console.log(`[local-dev] http://localhost:${PORT}`);
    console.log(`[local-dev] Portal: http://localhost:${PORT}/portal/`);
    console.log(`[local-dev] /api/config OK (SUPABASE_URL configurada)`);
});
