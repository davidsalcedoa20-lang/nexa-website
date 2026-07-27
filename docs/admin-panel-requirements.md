# Panel Administrativo de NEXA Hub — Requisitos funcionales

> Este documento reúne los requisitos confirmados para el **Panel Administrativo**
> (distinto del **Portal del Cliente**, que ya tiene su base construida en
> `/portal` y `/dashboard`). El Panel Administrativo todavía no se ha
> construido — este archivo existe para no perder los requisitos mientras se
> termina primero la arquitectura de base de datos.

## 1. Multi-administrador (confirmado, sin cambios de esquema necesarios)

El sistema tiene **dos administradores permanentes**:

- David Salcedo
- Andrés Lizcano

La arquitectura **ya soporta esto sin ningún cambio**, porque el diseño nunca
asumió un único admin:

- `profiles.role` es un enum (`admin` / `client`), no hay ninguna columna ni
  restricción que limite a un solo registro con `role = 'admin'`.
- Todas las políticas RLS (`profiles_admin_all`, `workspaces_admin_all`,
  `projects_admin_all`, etc., ver `20260726231552_create_rls_policies.sql`)
  usan la función `is_admin()`, que evalúa el rol del usuario autenticado en
  tiempo real — **no** referencian un `id` de usuario específico.
- Resultado: **cualquier** perfil con `role = 'admin'` tiene acceso total a
  todos los workspaces, proyectos, etapas, bloques y tareas de todos los
  clientes, sin distinción entre David, Andrés o un futuro tercer admin.

Para agregar un tercer administrador en el futuro solo se necesita crear su
usuario con `role: 'admin'` en los metadatos (ver `scripts/seed-admins.mjs`).
No se requiere ninguna migración adicional.

## 2. Creación de los dos administradores permanentes

Se preparó `scripts/seed-admins.mjs`, un script de un solo uso que:

1. Usa la Admin API de Supabase (`service_role` key, nunca en el repo ni en
   el navegador) para invitar por correo a David Salcedo y Andrés Lizcano.
2. Cada uno recibe un correo para definir su propia contraseña (no se genera
   ni se transmite ninguna contraseña temporal).
3. El trigger `on_auth_user_created` crea automáticamente su fila en
   `profiles` con `role = 'admin'`.

**Pendiente:** reemplazar los correos placeholder en el script por los
correos reales de David y Andrés antes de ejecutarlo.

## 3. Requisitos de interfaz (para cuando se construya el frontend del panel)

- El Panel Administrativo debe mostrar en la **barra superior** el nombre del
  administrador autenticado (`profiles.full_name` del usuario en sesión, leído
  vía `supabase.auth.getUser()` + consulta a `profiles`). Nunca un nombre fijo
  ni un texto genérico tipo "Administrador".
- El panel debe permitir gestionar (crear/ver/editar) **todos** los clientes,
  workspaces y proyectos, sin importar cuál de los dos administradores esté
  conectado — ambos ven exactamente los mismos datos.
- Es una interfaz separada del Portal del Cliente (`/portal`, `/dashboard`);
  todavía falta definir su ruta (propuesta: `/admin` para login y
  `/admin/panel` o similar para el panel, a confirmar contigo).

## 4. Estado actual / próximos pasos

- [x] Diseño de base de datos aprobado.
- [x] Migraciones SQL escritas (`supabase/migrations/`).
- [x] Confirmado soporte multi-admin (sin cambios de esquema).
- [x] Script de creación de los 2 admins permanentes preparado.
- [ ] Aplicar las migraciones en Supabase (pendiente, ver `supabase/migrations/README.md`).
- [ ] Ejecutar `scripts/seed-admins.mjs` con los correos reales.
- [ ] Construir el frontend del Panel Administrativo (no iniciado).
