-- ==========================================================
-- NEXA HUB — 08. Auto-aprovisionamiento de perfiles (bootstrap)
-- ==========================================================
-- Permite que un usuario ya autenticado inserte SU PROPIO
-- registro en public.profiles si todavía no existe.
--
-- Esto resuelve el problema de "huevo y gallina" al iniciar
-- sesión por primera vez: el trigger on_auth_user_created (ver
-- 20260726231549_create_functions_and_triggers.sql) ya crea el
-- perfil automáticamente cuando el usuario se crea vía Admin
-- API, pero si por cualquier motivo (usuario creado manualmente
-- desde el Dashboard de Supabase, un fallo puntual del trigger,
-- etc.) el perfil no llegó a crearse, el frontend (ver
-- js/portal.js -> fetchOrCreateProfile) lo crea en el primer
-- inicio de sesión, en vez de bloquear el acceso con "acceso
-- denegado".
--
-- Sin esta política, ese insert desde el cliente sería
-- rechazado por RLS, porque la única política de escritura
-- existente (profiles_admin_all) requiere is_admin() = true,
-- y un usuario sin perfil todavía no puede cumplir esa condición
-- (ciclo: para ser admin necesita un perfil, para crear su
-- perfil necesitaría ya ser admin).
--
-- ⚠️ ADVERTENCIA DE SEGURIDAD — revisar antes de crear clientes:
-- Esta política solo exige que el id insertado sea el del propio
-- usuario (auth.uid()); NO valida qué "role" puede asignarse a
-- sí mismo. Hoy es aceptable porque el frontend solo la usa para
-- aprovisionar a los administradores permanentes y todavía no
-- existe ningún cliente real en el sistema. Antes de dar de alta
-- al primer cliente real, se recomienda endurecer esta política
-- (por ejemplo, restringir el insert propio a role = 'client',
-- y dejar la creación de administradores exclusivamente al
-- trigger + Admin API).
-- ==========================================================

create policy profiles_insert_own on public.profiles
    for insert
    with check (id = auth.uid());
