# Roles y Permisos — NEXA Hub (simplificado)

## Conceptos

| Rol DB | Etiqueta UI | Comportamiento |
|--------|-------------|----------------|
| `owner` | Administrador Principal | Acceso absoluto. Un solo owner. No se degrada ni elimina. |
| `admin` | Administrador | Acceso según 4 bloques simples. |
| `client` | Cliente | Portal del cliente. |
| `employee` | Empleado | Portal editor. |

## Bloques

### 1. Proyectos
Exactamente una opción:
- `projects.view_all` — todos los proyectos
- `projects.view_assigned` — solo asignados (`admin_project_access`) + siempre los que cree
- `projects.view_own` — solo los que cree

`can_access_project` siempre incluye `created_by = auth.uid()`.

### 2. Contabilidad
Sin permission keys. Cada `finance_books.admin_id` es dueño.
Compartir: `finance_book_shares`. Owner role ve todas.

### 3. Administradores
Solo el Administrador Principal (`role = owner`) puede crear/editar/eliminar admins y permisos.
Edge Function `manage-admin` exige owner.

### 4. Empleados
- `employees.manage` — ver módulo y CRUD empleados

## Tablas

- `permissions` — catálogo (solo 4 keys)
- `user_permissions` — grants por admin
- `admin_project_access` — proyectos en modo assigned
- `finance_book_shares` — compartir contabilidades
- `profiles.project_access_mode` — `all` \| `selected` \| `own`

## UI

`admin/usuarios-permisos.html` — solo el Administrador Principal (`owner`).

## Administrador Principal

Debe existir un perfil con `role = 'owner'`.

Asignado: `davidsalcedoa2.0@gmail.com` (David Salcedo).

```sql
update public.profiles
set role = 'owner', project_access_mode = 'all'
where email = 'CORREO_DEL_PRINCIPAL';
```

(Si el update lo bloquea un trigger, desactivar temporalmente `restrict_profile_self_update`.)
