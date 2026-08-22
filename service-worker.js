/* ==========================================================
   NEXA HUB — Service Worker (solo estáticos)
   ========================================================== */
const CACHE_VERSION = 'nexa-hub-static-v3';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/robots.txt',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/logo/nexa-logo.png',
  '/css/style.css',
  '/css/portal.css',
  '/css/admin.css',
  '/js/pwa-register.js'
];

/** Orígenes / rutas que NUNCA deben cachearse */
function shouldBypass(request, url) {
  if (request.method !== 'GET') return true;

  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  const href = url.href.toLowerCase();

  // Supabase / APIs / auth
  if (host.includes('supabase.co') || host.includes('supabase.in')) return true;
  if (path.includes('/auth/') || path.includes('/rest/') || path.includes('/realtime/') || path.includes('/storage/')) return true;

  // Google OAuth / Drive / Calendar
  if (host.includes('googleapis.com') || host.includes('google.com') || host.includes('gstatic.com')) return true;
  if (host.includes('accounts.google.com') || host.includes('oauth')) return true;
  if (href.includes('oauth') || href.includes('access_token') || href.includes('id_token')) return true;

  // Vercel / analytics / dynamic APIs
  if (path.startsWith('/api/')) return true;
  if (host.includes('vercel.') && path.includes('/_')) return true;

  // Accept header suggests JSON / API payload
  const accept = (request.headers.get('Accept') || '').toLowerCase();
  if (accept.includes('application/json') && !accept.includes('text/html')) return true;

  return false;
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname.toLowerCase();
  return (
    path.endsWith('.html') ||
    path.endsWith('.css') ||
    path.endsWith('.js') ||
    path.endsWith('.mjs') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg') ||
    path.endsWith('.webp') ||
    path.endsWith('.gif') ||
    path.endsWith('.svg') ||
    path.endsWith('.ico') ||
    path.endsWith('.woff') ||
    path.endsWith('.woff2') ||
    path.endsWith('.ttf') ||
    path.endsWith('.otf') ||
    path === '/' ||
    path === '/manifest.json' ||
    path.startsWith('/assets/') ||
    path.startsWith('/css/') ||
    path.startsWith('/js/')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch (_) {
    return;
  }

  if (shouldBypass(request, url)) {
    return; // red directa, sin cache
  }

  if (!isStaticAsset(url)) {
    return; // no tocar fetch dinámicos ni cross-origin no estáticos
  }

  // HTML: network-first (actualizaciones en Vercel), fallback a cache
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirst(request));
    return;
  }

  // CSS/JS/imagenes/fuentes: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event, request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const home = await cache.match('/index.html') || await cache.match('/');
      if (home) return home;
    }
    throw _;
  }
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Evita que el navegador mate el fetch de revalidación en cuanto
  // respondemos con la copia en caché: así la caché sí queda al día
  // para la próxima visita en vez de quedarse "congelada" en la versión vieja.
  event.waitUntil(networkPromise);

  if (cached) {
    return cached;
  }

  const fresh = await networkPromise;
  if (fresh) return fresh;
  return new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
