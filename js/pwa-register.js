/* ==========================================================
   NEXA HUB — Registro PWA + splash de arranque
   No modifica lógica de negocio (portal/admin/dashboard).
   ========================================================== */
(function () {
  'use strict';

  var THEME = '#8C52FF';
  var BG = '#050505';
  var MIN_MS = 700;
  var MAX_MS = 1200;

  function resolveLogo() {
    var path = window.location.pathname || '';
    if (path.indexOf('/admin') === 0 || path.indexOf('/portal') === 0 || path.indexOf('/dashboard') === 0) {
      return '../assets/logo/nexa-logo.png';
    }
    return '/assets/logo/nexa-logo.png';
  }

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.indexOf('android-app://') === 0
    );
  }

  function showSplash() {
    if (document.getElementById('nexa-pwa-splash')) return;
    // Solo en app instalada (standalone), para no interferir en el navegador web
    if (!isStandalone()) return;

    var splash = document.createElement('div');
    splash.id = 'nexa-pwa-splash';
    splash.setAttribute('aria-live', 'polite');
    splash.setAttribute('role', 'status');
    splash.innerHTML =
      '<div class="nexa-pwa-splash-inner">' +
      '<img src="' + resolveLogo() + '" alt="NEXA" width="96" height="96" decoding="async">' +
      '<strong>NEXA HUB</strong>' +
      '<span>Cargando...</span>' +
      '</div>';

    var style = document.createElement('style');
    style.id = 'nexa-pwa-splash-style';
    style.textContent =
      '#nexa-pwa-splash{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
      'background:' + BG + ';transition:opacity .35s ease,visibility .35s ease;}' +
      '#nexa-pwa-splash.is-hide{opacity:0;visibility:hidden;pointer-events:none;}' +
      '.nexa-pwa-splash-inner{display:flex;flex-direction:column;align-items:center;gap:14px;font-family:Poppins,system-ui,sans-serif;}' +
      '.nexa-pwa-splash-inner img{width:96px;height:96px;object-fit:contain;filter:drop-shadow(0 0 18px rgba(140,82,255,.35));}' +
      '.nexa-pwa-splash-inner strong{color:#fff;font-size:22px;font-weight:700;letter-spacing:.04em;}' +
      '.nexa-pwa-splash-inner span{color:rgba(255,255,255,.55);font-size:13px;font-weight:400;}';

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(splash);

    var started = Date.now();
    var duration = MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS + 1));

    function hide() {
      var elapsed = Date.now() - started;
      var wait = Math.max(0, duration - elapsed);
      setTimeout(function () {
        splash.classList.add('is-hide');
        setTimeout(function () {
          if (splash.parentNode) splash.parentNode.removeChild(splash);
          if (style.parentNode) style.parentNode.removeChild(style);
        }, 400);
      }, wait);
    }

    if (document.readyState === 'complete') {
      hide();
    } else {
      window.addEventListener('load', hide, { once: true });
      // Fallback de seguridad
      setTimeout(hide, MAX_MS + 800);
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    var swUrl = '/service-worker.js';
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register(swUrl, { scope: '/' })
        .then(function (reg) {
          // Actualización automática al publicar en Vercel
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          reg.addEventListener('updatefound', function () {
            var worker = reg.installing;
            if (!worker) return;
            worker.addEventListener('statechange', function () {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                worker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch(function (err) {
          console.warn('[NEXA PWA] No se pudo registrar el Service Worker:', err && err.message);
        });

      navigator.serviceWorker.addEventListener('controllerchange', function () {
        // Nueva versión activa; recarga suave solo si ya había un controller previo
      });
    });
  }

  // theme-color hint (por si falta en HTML)
  try {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = THEME;
      document.head.appendChild(meta);
    }
  } catch (_) { /* noop */ }

  showSplash();
  registerServiceWorker();
})();
