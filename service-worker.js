/* ==========================================================
   NEXA HUB — Service Worker (solo estáticos del Hub)
   No cachea marketing (/pages), Supabase, OAuth ni APIs.
   ========================================================== */
const CACHE_VERSION = 'nexa-hub-static-v2';
const PRECACHE_URLS = [
  '/portal/index.html',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/logo/nexa-logo.png',
  '/css/style.css',
  '/css/portal.css',
  '/css/admin.css',
  '/js/pwa-register.js',
  '/js/portal.js',
  '/js/vendor/supabase-js.min.js'
];

/** Orígenes / rutas que NUNCA deben cachearse */
function shouldBypass(request, url) {
  if (request.method !== 'GET') return true;

  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  const href = url.href.toLowerCase();

  // Sitio corporativo / marketing (no pertenece al Hub)
  if (path === '/' || path === '/index.html' || path.startsWith('/pages/')) return true;

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

function isHubStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname.toLowerCase();

  // Solo shell del Hub
  if (!(
    path.startsWith('/portal/') ||
    path.startsWith('/admin/') ||
    path.startsWith('/dashboard/') ||
    path.startsWith('/assets/') ||
    path.startsWith('/css/') ||
    path.startsWith('/js/') ||
    path === '/manifest.json' ||
    path === '/service-worker.js'
  )) {
    return false;
  }

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
    path === '/manifest.json'
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
    return;
  }

  if (!isHubStaticAsset(url)) {
    return;
  }

  // HTML del Hub: network-first (actualizaciones en Vercel)
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
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
      const login = await cache.match('/portal/index.html');
      if (login) return login;
    }
    throw _;
  }
}

async function staleWhileRevalidate(request) {
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

  if (cached) {
    networkPromise.catch(() => null);
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
