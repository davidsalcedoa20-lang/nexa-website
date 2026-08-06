/* ==========================================================
   NEXA HUB — Shell compartido del Panel Administrativo
   ==========================================================
   Este archivo SOLO controla interacciones de interfaz comunes
   a TODAS las páginas de /admin:
     1. Sidebar en vista móvil (abrir/cerrar).
     2. Menú desplegable del usuario (avatar, topbar).
     3. Acordeón del menú Empleados (abrir/cerrar + activo).

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

/* ================= 3. ACORDEÓN EMPLEADOS ================= */
(function initEmployeesAccordion() {
    const STORAGE_KEY = 'nexa-emp-nav-open';
    const group = document.querySelector('.emp-nav-group[data-emp-accordion]');
    if (!group) return;

    const toggle = group.querySelector('.emp-nav-toggle');
    const panel = group.querySelector('.emp-nav-sub');
    if (!toggle || !panel) return;

    const page = (location.pathname.split('/').pop() || '').toLowerCase();
    const search = location.search || '';

    // Marcar opción activa
    panel.querySelectorAll('a').forEach(function (link) {
        link.classList.remove('is-active');
        const href = link.getAttribute('href') || '';
        let active = false;

        if (href === 'empleados.html?nuevo=1') {
            active = page === 'empleados.html' && /(?:^|[?&])nuevo=1(?:&|$)/.test(search);
        } else if (href === 'empleados.html') {
            active = (page === 'empleados.html' && !/(?:^|[?&])nuevo=1(?:&|$)/.test(search))
                || page === 'empleado.html';
        } else if (href === 'empleados-calendario.html') {
            active = page === 'empleados-calendario.html';
        } else if (href === 'empleados-rendimiento.html') {
            active = page === 'empleados-rendimiento.html';
        }

        if (active) link.classList.add('is-active');
    });

    function setOpen(open, persist) {
        group.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (persist !== false) {
            try {
                localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
            } catch (_) { /* ignore */ }
        }
    }

    let preferred = null;
    try {
        preferred = localStorage.getItem(STORAGE_KEY);
    } catch (_) { /* ignore */ }

    // Por defecto cerrado. Si el usuario lo abrió, se mantiene al navegar.
    setOpen(preferred === '1', false);

    toggle.addEventListener('click', function () {
        setOpen(!group.classList.contains('is-open'), true);
    });
})();
