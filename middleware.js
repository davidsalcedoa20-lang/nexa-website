/* ==========================================================
   NEXA HUB — Enrutamiento por hostname (Vercel Edge Middleware)
   ==========================================================
   hub.nexaorigin.com  → NEXA HUB (/portal/index.html)
   www.nexaorigin.com  → sitio corporativo (sin intervención)
   nexaorigin.com      → sitio corporativo (sin intervención)
   ========================================================== */

export const config = {
  matcher: ['/', '/index.html', '/pages/:path*']
};

export default function middleware(request) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();

  // Corporativo: no tocar
  if (host === 'www.nexaorigin.com' || host === 'nexaorigin.com') {
    return;
  }

  // Solo Hub → Login / app
  if (host === 'hub.nexaorigin.com') {
    const url = new URL(request.url);
    url.pathname = '/portal/index.html';
    return Response.redirect(url, 307);
  }

  // Preview / localhost / otros: no intervenir
  return;
}
