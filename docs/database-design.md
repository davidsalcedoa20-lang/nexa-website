# Diseño de Base de Datos — NEXA Hub (Panel Administrativo)

> Estado: **APROBADO.** Las migraciones SQL ya están escritas en `supabase/migrations/` (ver README de esa carpeta). Pendiente únicamente aplicarlas contra el proyecto de Supabase (requiere credenciales que el asistente no tiene por diseño: la app solo usa la clave `anon`).

## 1. Enfoque general

- Nombres de tablas/columnas en inglés `snake_case` (convención estándar en Postgres/Supabase), aunque el contenido y la UI sigan en español.
- Todas las PK son `uuid`, consistentes con `auth.users` de Supabase.
- La metodología "Ruta NEXA" se modela en dos capas:
  - **Plantilla oficial** (`methodology_stages`, `methodology_blocks`): global, reusable, mantenida por el admin.
  - **Instancia por proyecto** (`project_stages`, `project_blocks`, `tasks`): copia real por proyecto, con estados independientes.
- Diseño pensado desde el inicio para Row Level Security (RLS) de Supabase.

## 2. Decisiones de diseño a confirmar

1. Ruta NEXA = plantilla + instancia (ver sección 1). Alternativa: etapas/bloques globales compartidos por todos los proyectos (solo tareas por proyecto).
2. Los clientes solo consultan (lectura). Ni proyectos, ni etapas, ni tareas son editables por el cliente. Basado en el copy ya escrito: "consultar el avance de tu proyecto".
3. 1 cliente = 1 workspace (relación 1 a 1, `UNIQUE`). Extensión futura: `workspace_members` si se necesitan varios usuarios por workspace.
4. El "responsable" de una tarea puede ser cualquier perfil (admin o cliente), no se restringe por rol.
5. No hay tabla de "Calendario" (se deriva de `tasks.due_date`). "Configuración" vive por ahora dentro de `profiles`.

## 3. Diagrama de relaciones (vista general)

```
auth.users (Supabase Auth)
   └── profiles (role: admin | client)
          ├── workspaces (1 cliente -> 1 workspace)      [client_id UNIQUE]
          │      └── projects (1 workspace -> N proyectos)
          │             └── project_stages (instancia por proyecto)
          │                    └── project_blocks
          │                           └── tasks (responsible_id -> profiles)
          │
          └── (created_by / responsible_id apuntan aqui desde varias tablas)

methodology_stages (plantilla oficial, global)
      └── methodology_blocks
            (referenciadas por project_stages / project_blocks
             para saber de que plantilla vino cada instancia)
```

## 4. Tablas propuestas

### 4.1 profiles
Extiende `auth.users` con datos de aplicación: rol (admin/cliente), nombre, estado de cuenta. Punto de apoyo de casi todas las políticas RLS.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | uuid | PK, FK -> auth.users(id) ON DELETE CASCADE | Mismo id que el usuario de Auth |
| role | user_role (enum) | NOT NULL, default 'client' | admin \| client |
| full_name | text | NOT NULL | Nombre visible |
| email | text | NOT NULL | Copia sincronizada del email |
| phone | text | NULL | |
| avatar_url | text | NULL | |
| is_active | boolean | NOT NULL, default true | Permite desactivar acceso sin borrar |
| created_by | uuid | FK -> profiles(id), NULL | Admin que creó la cuenta |
| created_at / updated_at | timestamptz | default now() | Auditoría |

### 4.2 workspaces
El "Espacio de Trabajo" del cliente: contenedor privado que aísla sus datos del resto de clientes.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | |
| client_id | uuid | UNIQUE NOT NULL, FK -> profiles(id) ON DELETE CASCADE | Garantiza 1 cliente = 1 workspace |
| name | text | NOT NULL | Nombre del cliente/empresa |
| status | workspace_status (enum) | NOT NULL, default 'active' | active \| inactive |
| created_by | uuid | NOT NULL, FK -> profiles(id) | Admin que lo creó |
| created_at / updated_at | timestamptz | default now() | |

Regla adicional (vía trigger, no vía CHECK): el `client_id` referenciado debe tener `role = 'client'`.

### 4.3 projects
Un workspace contiene uno o varios proyectos. Cada proyecto es una instancia independiente de la Ruta NEXA.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| workspace_id | uuid | NOT NULL, FK -> workspaces(id) ON DELETE CASCADE | |
| name | text | NOT NULL | |
| description | text | NULL | |
| status | project_status (enum) | NOT NULL, default 'not_started' | not_started/in_progress/paused/completed/cancelled |
| start_date / end_date | date | NULL | |
| order_index | integer | NOT NULL, default 0 | Orden manual |
| created_by | uuid | NOT NULL, FK -> profiles(id) | |
| created_at / updated_at | timestamptz | default now() | |

### 4.4 methodology_stages — Plantilla oficial (global)
Definición maestra de la Ruta NEXA, mantenida una sola vez por el admin y reutilizada en todos los proyectos.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| name | text | NOT NULL | Ej: Descubrimiento, Estrategia, Producción, Lanzamiento |
| description | text | NULL | |
| order_index | integer | NOT NULL | Orden oficial de la ruta |
| is_active | boolean | NOT NULL, default true | Retirar del catálogo sin borrar historial |
| created_at / updated_at | timestamptz | default now() | |

### 4.5 methodology_blocks — Plantilla oficial (global)
Desglosa cada etapa oficial en bloques de trabajo estándar, a nivel de plantilla.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| stage_id | uuid | NOT NULL, FK -> methodology_stages(id) ON DELETE CASCADE | |
| name | text | NOT NULL | |
| description | text | NULL | |
| order_index | integer | NOT NULL | |
| is_active | boolean | NOT NULL, default true | |
| created_at / updated_at | timestamptz | default now() | |

### 4.6 project_stages — Instancia por proyecto
Copia real de una etapa aplicada a un proyecto concreto. Aquí se rastrea el avance sin tocar la plantilla oficial.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| project_id | uuid | NOT NULL, FK -> projects(id) ON DELETE CASCADE | |
| methodology_stage_id | uuid | NULL, FK -> methodology_stages(id) ON DELETE SET NULL | Referencia a la plantilla de origen |
| name | text | NOT NULL | Copiado de la plantilla al crearse |
| order_index | integer | NOT NULL | |
| status | stage_status (enum) | NOT NULL, default 'not_started' | not_started/in_progress/completed |
| created_at / updated_at | timestamptz | default now() | |

### 4.7 project_blocks — Instancia por proyecto

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| project_stage_id | uuid | NOT NULL, FK -> project_stages(id) ON DELETE CASCADE | |
| methodology_block_id | uuid | NULL, FK -> methodology_blocks(id) ON DELETE SET NULL | |
| name | text | NOT NULL | |
| order_index | integer | NOT NULL | |
| status | block_status (enum) | NOT NULL, default 'not_started' | |
| created_at / updated_at | timestamptz | default now() | |

### 4.8 tasks
Unidad atómica de trabajo, con exactamente los campos solicitados.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| project_block_id | uuid | NOT NULL, FK -> project_blocks(id) ON DELETE CASCADE | |
| title | text | NOT NULL | título |
| description | text | NULL | descripción |
| responsible_id | uuid | NULL, FK -> profiles(id) ON DELETE SET NULL | responsable |
| status | task_status (enum) | NOT NULL, default 'pending' | estado: pending/in_progress/completed/blocked |
| priority | task_priority (enum) | NOT NULL, default 'medium' | prioridad: low/medium/high/urgent |
| due_date | date | NULL | fecha |
| order_index | integer | NOT NULL, default 0 | orden |
| created_by | uuid | NOT NULL, FK -> profiles(id) | |
| created_at / updated_at | timestamptz | default now() | |

## 5. Tipos enumerados (ENUM)

```
user_role        : admin | client
workspace_status : active | inactive
project_status   : not_started | in_progress | paused | completed | cancelled
stage_status     : not_started | in_progress | completed
block_status     : not_started | in_progress | completed
task_status      : pending | in_progress | completed | blocked
task_priority    : low | medium | high | urgent
```

## 6. Estrategia de seguridad (RLS) — resumen por tabla

Regla general: admin ve y edita todo; cliente solo lee lo de su propio workspace.

| Tabla | Admin | Cliente |
|---|---|---|
| profiles | CRUD total | Solo su propia fila (id = auth.uid()). Ver vista `profiles_public` para exponer nombre/avatar del responsable sin datos sensibles |
| workspaces | CRUD total | SELECT solo si client_id = auth.uid() |
| projects | CRUD total | SELECT solo si su workspace_id pertenece a su workspace |
| methodology_stages / methodology_blocks | CRUD total | SELECT libre (información pública de referencia) |
| project_stages / project_blocks / tasks | CRUD total | Solo SELECT, filtrando por proyecto -> workspace -> client_id = auth.uid() |

## 7. Funciones/triggers recomendados (pendientes de implementar)

1. `handle_new_user()` — trigger AFTER INSERT en auth.users que crea automáticamente la fila en profiles.
2. `set_updated_at()` — trigger genérico BEFORE UPDATE para mantener updated_at.
3. `validate_client_role()` — trigger en workspaces que valida que client_id tenga role = 'client'.
4. `instantiate_project_methodology(project_id)` — copia automáticamente methodology_stages/methodology_blocks activas hacia project_stages/project_blocks al crear un proyecto.

## 8. Índices recomendados

profiles(role) · projects(workspace_id) · methodology_blocks(stage_id) · project_stages(project_id) · project_stages(methodology_stage_id) · project_blocks(project_stage_id) · tasks(project_block_id) · tasks(responsible_id) · tasks(status) · tasks(due_date)

## 9. Fuera de alcance por ahora (extensiones futuras)

- workspace_members (varios usuarios por workspace).
- Comentarios/adjuntos en tareas.
- audit_log de acciones del admin.
- profile_settings jsonb para preferencias de "Configuración".

## 10. Próximos pasos

Pendiente de aprobación de los 5 puntos de la sección 2. Una vez aprobado, el siguiente paso sería escribir las migraciones SQL reales (todavía no se ha tocado Supabase ni el frontend).

## 11. Addendum — Multi-administrador (confirmado)

El sistema tiene dos administradores permanentes (David Salcedo y Andrés Lizcano), y la arquitectura ya soportaba múltiples administradores desde el diseño original sin necesidad de cambios: `role` es un enum evaluado en tiempo real por `is_admin()`, no hay ninguna referencia a un admin específico en el esquema. Detalle completo, script de creación de los administradores y requisitos de interfaz del futuro Panel Administrativo en `docs/admin-panel-requirements.md`.
