# Migraciones — NEXA Hub

Estas 7 migraciones implementan el diseño aprobado en `docs/database-design.md`.
Deben aplicarse **en este orden** (el prefijo numérico ya lo garantiza):

1. `..._create_enums.sql` — tipos ENUM (roles, estados, prioridad).
2. `..._create_profiles.sql` — tabla `profiles` (extiende `auth.users`).
3. `..._create_workspaces_and_projects.sql` — `workspaces` y `projects`.
4. `..._create_methodology_templates.sql` — plantilla oficial de la Ruta NEXA (`methodology_stages`, `methodology_blocks`).
5. `..._create_project_instances_and_tasks.sql` — instancia por proyecto (`project_stages`, `project_blocks`) y `tasks`.
6. `..._create_functions_and_triggers.sql` — automatizaciones (crear perfil al crear usuario, `updated_at`, validación de rol, copia automática de la metodología al crear un proyecto).
7. `..._create_rls_policies.sql` — seguridad a nivel de fila (RLS) para todas las tablas.

## Cómo aplicarlas

**No se ejecutaron todavía** porque hacerlo requiere credenciales de administrador de la base de datos (contraseña de Postgres o un access token de Supabase), que nunca deben vivir en este repositorio ni en el frontend — el proyecto solo usa la clave pública `anon` (servida por `api/config.js` desde variables de entorno), que intencionalmente no puede correr DDL.

Elige una opción:

### Opción A — SQL Editor del Dashboard (recomendada, ~2 minutos, sin compartir credenciales)
1. Entra a [app.supabase.com](https://app.supabase.com) → tu proyecto → **SQL Editor**.
2. Abre cada archivo de esta carpeta **en el orden 1 a 7**, copia su contenido y pégalo en una nueva query.
3. Ejecuta ("Run") uno por uno, en orden.

### Opción B — Supabase CLI (si prefieres que se automatice)
```bash
npx supabase login                       # abre el navegador para autenticarte
npx supabase link --project-ref aeulqdihlxsvznviyozk
npx supabase db push                     # pedirá la contraseña de la base de datos
```
La CLI ya está inicializada en este proyecto (`supabase/config.toml`), así que solo faltan estos 3 comandos.

## Después de aplicarlas

- El **primer usuario administrador** debe crearse manualmente: crea el usuario en Authentication → Users (o vía Admin API) con `user_metadata: { "role": "admin", "full_name": "..." }`, y el trigger `on_auth_user_created` completará su `profiles` automáticamente.
- Los siguientes usuarios (clientes) los crea ese admin desde el futuro panel, usando la Admin API de Supabase con `user_metadata: { "role": "client", "full_name": "...", "created_by": "<uuid del admin>" }`.
