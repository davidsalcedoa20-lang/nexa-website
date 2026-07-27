/* ==========================================================
   NEXA HUB — Shell compartido del Panel Administrativo
   ==========================================================
   Este archivo SOLO controla interacciones de interfaz comunes
   a TODAS las páginas de /admin:
     1. Sidebar en vista móvil (abrir/cerrar).
     2. Menú desplegable del usuario (avatar, topbar).

   Se incluye en admin/index.html, admin/clientes.html,
   admin/proyectos.html, admin/proyecto-detalle.html y
   admin/tareas.html (después de js/portal.js).

   Los datos reales de cada página (Dashboard, Clientes,
   Proyectos, Tareas) viven en sus propios módulos dentro de
   js/admin/pages/*.js — este archivo no habla con Supabase.
   ========================================================== */

/* ================= 1. SIDEBAR MÓVIL ================= */
const adminSidebar = document.getElementById('adminSidebar');
const adminMenuToggle = document.getElementById('adminMenuToggle');
const adminOverlay = document.getElementById('adminOverlay');

if (adminSidebar && adminMenuToggle && adminOverlay) {
    const closeAdminSidebar = function () {
        adminSidebar.classList.remove('active');
        adminOverlay.classList.remove('active');
    };

    adminMenuToggle.addEventListener('click', function () {
        adminSidebar.classList.toggle('active');
        adminOverlay.classList.toggle('active');
    });

    adminOverlay.addEventListener('click', closeAdminSidebar);
}

/* ================= 2. MENÚ DE USUARIO ================= */
const adminUserToggle = document.getElementById('adminUserToggle');
const adminUserMenu = document.getElementById('adminUserMenu');

if (adminUserToggle && adminUserMenu) {
    adminUserToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        adminUserToggle.classList.toggle('is-open');
    });

    document.addEventListener('click', function (e) {
        if (!adminUserToggle.contains(e.target)) {
            adminUserToggle.classList.remove('is-open');
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            adminUserToggle.classList.remove('is-open');
        }
    });
}
