/* ==========================================================
   NEXA HUB — Autenticación y autorización
   ==========================================================
   - Login (/portal): autentica con Supabase Auth, busca (o
     crea, si todavía no existe) su fila en "profiles", y
     redirige según el rol:
       role = 'admin'  -> /admin
       role = 'client' -> /dashboard (Portal del Cliente)
       rol inválido / cuenta inactiva -> Acceso denegado
   - Dashboard (/dashboard) y Admin (/admin): protegen el acceso
     verificando sesión + rol antes de mostrar contenido, y
     controlan el sidebar en vista móvil.

   Requiere que, ANTES de este archivo, ya se haya cargado:
     1. js/vendor/supabase-js.min.js

   Las credenciales de Supabase (SUPABASE_URL / SUPABASE_ANON_KEY)
   ya NO se leen de "window.__ENV__" ni de ningún "js/env.js": se
   obtienen dentro de "js/supabase.js" desde el endpoint "/api/config"
   (ver ese archivo para más detalle). Este archivo no necesita saber
   de dónde salen: solo importa dinámicamente "./supabase.js".

   ---------------------------------------------------------
   BOOTSTRAP DE PERFILES (fetchOrCreateProfile)
   ---------------------------------------------------------
   El trigger "on_auth_user_created" (ver
   supabase/migrations/20260726231549_create_functions_and_triggers.sql)
   ya crea automáticamente la fila en "profiles" cuando el
   usuario se crea vía Admin API. Pero si por cualquier motivo
   esa fila no llegó a crearse (por ejemplo, si el usuario fue
   creado manualmente desde el Dashboard de Supabase antes de
   que el trigger existiera), esta función la crea en el primer
   inicio de sesión en lugar de bloquear el acceso.

   ⚠️ Por ahora el rol asignado en ese caso siempre es 'admin'
   (ver supabase/migrations/20260727003400_add_profiles_self_insert_policy.sql
   para la política de RLS que lo permite, y su advertencia de
   seguridad). Esto es aceptable mientras el sistema solo tiene
   administradores; debe revisarse antes de dar de alta al
   primer cliente real.
   ========================================================== */

function getSupabase() {
    return import('./supabase.js').then(function (mod) {
        return mod.supabase;
    });
}

/* Busca la fila de "profiles" del usuario autenticado. Si no
   existe todavía, la crea automáticamente y la devuelve.
   Devuelve "null" si algo falla (y deja el detalle en consola). */
async function fetchOrCreateProfile(supabase, user) {
    const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, role, full_name, is_active')
        .eq('id', user.id)
        .maybeSingle();

    if (fetchError) {
        console.error('[NEXA HUB] Error consultando el perfil:', fetchError.message);
        return null;
    }

    if (existingProfile) {
        return existingProfile;
    }

    const newProfile = {
        id: user.id,
        email: user.email,
        full_name: (user.user_metadata && user.user_metadata.full_name) || '',
        role: 'admin'
    };

    const { data: createdProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select('id, role, full_name, is_active')
        .single();

    if (!insertError) {
        return createdProfile;
    }

    /* Código 23505 = violación de llave única: alguien más (ej. el
       trigger) ya lo creó justo antes que nosotros. Lo recuperamos. */
    if (insertError.code === '23505') {
        const { data: recovered } = await supabase
            .from('profiles')
            .select('id, role, full_name, is_active')
            .eq('id', user.id)
            .maybeSingle();

        return recovered || null;
    }

    console.error('[NEXA HUB] Error creando el perfil automáticamente:', insertError.message);
    return null;
}

/* ================= LOGIN — /portal ================= */
const portalLoginForm = document.getElementById('portalLoginForm');

if (portalLoginForm) {
    const portalUser = document.getElementById('portalUser');
    const portalPass = document.getElementById('portalPass');
    const portalError = document.getElementById('portalError');
    const portalSubmit = portalLoginForm.querySelector('.portal-submit');

    function showError(message) {
        portalError.textContent = message;
        portalError.classList.add('active');
    }

    function setLoading(isLoading) {
        portalSubmit.disabled = isLoading;
        portalSubmit.style.opacity = isLoading ? '.7' : '1';
        portalSubmit.style.cursor = isLoading ? 'wait' : 'pointer';
    }

    portalLoginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const email = portalUser.value.trim();
        const password = portalPass.value.trim();

        if (email === '' || password === '') {
            showError('Por favor completa ambos campos para continuar.');
            return;
        }

        const supabase = await getSupabase();

        if (!supabase) {
            showError('No se pudo conectar con el servidor. Intenta más tarde.');
            return;
        }

        setLoading(true);

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError || !authData || !authData.user) {
            setLoading(false);
            showError('Correo o contraseña incorrectos.');
            return;
        }

        const profile = await fetchOrCreateProfile(supabase, authData.user);

        if (!profile || profile.is_active === false) {
            await supabase.auth.signOut();
            setLoading(false);
            showError('No se pudo preparar tu cuenta. Contacta a tu asesor NEXA.');
            return;
        }

        if (profile.role === 'admin') {
            window.location.href = '../admin/index.html';
            return;
        }

        if (profile.role === 'client') {
            if (authData.user.user_metadata && authData.user.user_metadata.must_change_password === true) {
                window.location.href = 'change-password.html';
                return;
            }
            window.location.href = '../dashboard/index.html';
            return;
        }

        await supabase.auth.signOut();
        setLoading(false);
        showError('Acceso denegado. Tu cuenta no tiene un rol válido en el sistema. Contacta a tu asesor NEXA.');
    });

    [portalUser, portalPass].forEach(function (field) {
        field.addEventListener('input', function () {
            portalError.classList.remove('active');
        });
    });
}

/* ============ CAMBIO DE CONTRASEÑA OBLIGATORIO — /portal/change-password.html ============
   Se muestra cuando un cliente inicia sesión con la contraseña
   temporal que le asignó un administrador (user_metadata.must_change_password
   === true, ver Edge Functions create-client / reset-client-password).
   No usa el mecanismo genérico de [data-auth-guard] porque su condición
   de acceso es distinta (no basta con el rol: importa el estado de
   must_change_password), así que valida la sesión por su cuenta. */
const changePasswordForm = document.getElementById('changePasswordForm');

if (changePasswordForm) {
    initChangePasswordPage(changePasswordForm);
}

async function initChangePasswordPage(form) {
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const errorEl = document.getElementById('changePasswordError');
    const submitBtn = form.querySelector('.portal-submit');
    const MIN_PASSWORD_LENGTH = 8;

    function showError(message) {
        errorEl.textContent = message;
        errorEl.classList.add('active');
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        submitBtn.style.opacity = isLoading ? '.7' : '1';
        submitBtn.style.cursor = isLoading ? 'wait' : 'pointer';
    }

    const supabase = await getSupabase();

    if (!supabase) {
        showError('No se pudo conectar con el servidor. Intenta más tarde.');
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Sin sesión activa: no tiene nada que cambiar aquí.
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Si ya cambió su contraseña (o es un admin que llegó por error a esta
    // URL), no debe quedarse en esta pantalla.
    if (!user.user_metadata || user.user_metadata.must_change_password !== true) {
        const profile = await fetchOrCreateProfile(supabase, user);
        window.location.href = profile && profile.role === 'admin' ? '../admin/index.html' : '../dashboard/index.html';
        return;
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        errorEl.classList.remove('active');

        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!newPassword || !confirmPassword) {
            showError('Completa ambos campos para continuar.');
            return;
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            showError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
            return;
        }

        if (newPassword !== confirmPassword) {
            showError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);

        // Cambia la contraseña y limpia el flag en un solo llamado, usando
        // la propia sesión del cliente (anon key): no requiere la Admin API
        // ni la service_role key.
        const { error } = await supabase.auth.updateUser({
            password: newPassword,
            data: { must_change_password: false }
        });

        setLoading(false);

        if (error) {
            showError(error.message || 'No se pudo cambiar la contraseña. Intenta de nuevo.');
            return;
        }

        window.location.href = '../dashboard/index.html';
    });

    [newPasswordInput, confirmPasswordInput].forEach(function (field) {
        field.addEventListener('input', function () {
            errorEl.classList.remove('active');
        });
    });
}

/* ================= GUARDA DE SESIÓN — /admin y /dashboard ================= */
/* Se activa si la página incluye un elemento con [data-auth-guard]
   indicando el rol requerido, ej: <body data-auth-guard="admin"> */
const guardedRole = document.body ? document.body.getAttribute('data-auth-guard') : null;

if (guardedRole) {
    initAuthGuard(guardedRole);
}

async function initAuthGuard(requiredRole) {
    const supabase = await getSupabase();

    if (!supabase) {
        window.location.href = '../portal/index.html';
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = '../portal/index.html';
        return;
    }

    const profile = await fetchOrCreateProfile(supabase, user);
    const isValid = profile && profile.is_active !== false && profile.role === requiredRole;

    if (!isValid) {
        await supabase.auth.signOut();
        window.location.href = '../portal/index.html';
        return;
    }

    // Si el cliente todavía tiene pendiente cambiar su contraseña temporal
    // (asignada por un admin al crear su cuenta o al regenerarla), no puede
    // entrar directo al Dashboard aunque escriba la URL a mano: se le fuerza
    // a pasar primero por /portal/change-password.html. No se cierra la
    // sesión, solo se redirige (la sesión sigue siendo válida).
    if (requiredRole === 'client' && user.user_metadata && user.user_metadata.must_change_password === true) {
        window.location.href = '../portal/change-password.html';
        return;
    }

    const fullName = profile.full_name || '';
    const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || fullName;
    const initials = nameParts.slice(0, 2).map(function (part) {
        return part.charAt(0).toUpperCase();
    }).join('') || 'NX';

    document.querySelectorAll('[data-user-name]').forEach(function (el) {
        el.textContent = fullName;
    });

    document.querySelectorAll('[data-user-firstname]').forEach(function (el) {
        el.textContent = firstName;
    });

    document.querySelectorAll('[data-user-initials]').forEach(function (el) {
        el.textContent = initials;
    });

    document.querySelectorAll('[data-logout]').forEach(function (el) {
        el.addEventListener('click', async function (e) {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = '../portal/index.html';
        });
    });
}

/* ================= SIDEBAR MÓVIL — /dashboard y /admin ================= */
const dashSidebar = document.getElementById('dashSidebar');
const dashMenuToggle = document.getElementById('dashMenuToggle');
const dashOverlay = document.getElementById('dashOverlay');

if (dashSidebar && dashMenuToggle && dashOverlay) {
    const closeDashSidebar = function () {
        dashSidebar.classList.remove('active');
        dashOverlay.classList.remove('active');
    };

    dashMenuToggle.addEventListener('click', function () {
        dashSidebar.classList.toggle('active');
        dashOverlay.classList.toggle('active');
    });

    dashOverlay.addEventListener('click', closeDashSidebar);
}
