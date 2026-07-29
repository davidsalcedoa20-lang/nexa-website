# Roles y Permisos — NEXA Hub

## Conceptos

| Rol DB | Etiqueta UI | Comportamiento |
|--------|-------------|----------------|
| `owner` | Propietario | Acceso absoluto. Un solo owner. No se degrada ni elimina. |
| `admin` | Administrador | Permisos individuales en `user_permissions`. |
| `client` | Cliente | Portal del cliente (sin cambios). |

## Tablas

- `permissions` — catálogo
- `user_permissions` — grants por usuario
- `admin_project_access` — proyectos visibles en modo `selected`
- `profiles.project_access_mode` — `all` | `selected`

## Helpers SQL

- `is_owner()`, `is_admin()` (incluye owner), `has_permission(key)`, `can_access_project(id)`, `get_my_permissions()`

## Frontend

- Catálogo: `js/components/permissions/permissionCatalog.js`
- Servicio: `js/services/permissionService.js`
- Guard: `js/admin/permissionsGuard.js`
- UI: `admin/usuarios-permisos.html`

## Activar owner Jaime David

Tras `npm run db:push`, si el perfil existe con ese nombre queda como owner.
Si no:

```sql
update public.profiles
set role = 'owner', project_access_mode = 'all'
where email = 'CORREO_DE_JAIME';
```

## Crear / editar administradores

Edge Function: `manage-admin`

```bash
npx supabase functions deploy manage-admin
npm run db:push
```

UI: `admin/usuarios-permisos.html` → botón **Nuevo administrador**.
