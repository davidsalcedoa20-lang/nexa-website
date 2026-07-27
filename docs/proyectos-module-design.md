# Módulo PROYECTOS — Diseño técnico (NEXA HUB)

> Documento de **diseño únicamente**. No se ha escrito ni ejecutado ningún
> código de este módulo todavía. Requiere aprobación explícita antes de
> implementar, siguiendo el mismo proceso usado para `docs/database-design.md`.

---

## 0. Auditoría de la arquitectura actual (punto 1 solicitado)

Antes de diseñar nada, este es el estado real y verificado del proyecto (leí
cada archivo relevante, no es de memoria):

### 0.1 Autenticación y roles
- Supabase Auth + `profiles` (extiende `auth.users`). Trigger
  `handle_new_user()` crea el perfil leyendo `raw_user_meta_data.role` /
  `full_name`.
- `user_role` enum: `admin` | `client`. Helper RLS `is_admin()` (SECURITY
  DEFINER) usado por todas las políticas admin.
- Login (`js/portal.js`): `signInWithPassword` → `fetchOrCreateProfile()` →
  redirección por rol (`admin` → `/admin`, `client` → `/dashboard`). Guardas
  de sesión vía `data-auth-guard="admin|client"` en `<body>`.
- **No se tocará nada de esto.**

### 0.2 Datos de clientes (módulo Clientes, ya funcional)
- `profiles` (id, role, full_name, email, phone, avatar_url, is_active,
  created_by, timestamps).
- `workspaces` (id, `client_id` UNIQUE → profiles, name, status
  `workspace_status` active/inactive, city, notes, created_by, timestamps).
  **1 cliente = 1 workspace.**
- RLS: `profiles_admin_all`, `profiles_select_own`, `profiles_insert_own`
  (bootstrap), `workspaces_admin_all`, `workspaces_select_own`.
- Edge Function `create-client`: única vía autorizada para crear la cuenta
  Auth + perfil + workspace de un cliente (usa `service_role` solo en
  servidor).
- Servicio `js/admin/services/clientService.js` (list/create/update/delete).
- **No se tocará nada de esto.** El módulo Proyectos se conecta a
  `workspaces`/`profiles` solo por lectura (FK), sin modificar su esquema ni
  sus políticas.

### 0.3 Esquema de proyectos YA EXISTENTE (creado en el diseño original, sin frontend construido todavía)
Esto es clave: estas tablas **existen en la base de datos pero ningún
componente de la interfaz las usa todavía** (ni admin ni cliente). Por lo
tanto puedo rediseñarlas por completo **sin romper ninguna funcionalidad
real**, solo hay que decidir si se reutilizan, se extienden o se dejan
en desuso.

| Tabla | Columnas actuales | Problema frente al nuevo objetivo |
|---|---|---|
| `projects` | workspace_id, name, description, status (`project_status`), start_date, end_date, order_index | Le faltan: tipo de proyecto, color, responsable, número de bloques, archivado. Es reutilizable con `ALTER TABLE`. |
| `methodology_stages` / `methodology_blocks` | Plantilla **global fija** ("Ruta NEXA"): una sola metodología para todos los proyectos | Incompatible con el objetivo: "sistema INTELIGENTE, ESCALABLE y REUTILIZABLE para **cualquier servicio**". Cada proyecto necesita sus propios bloques, no una copia de una plantilla única. |
| `project_stages` / `project_blocks` | Copia de la plantilla global por proyecto, sin secciones, sin duración en días, sin dependencias | No soporta secciones, dependencias, ni porcentaje de avance en tiempo real. |
| `tasks` | title, description, responsible_id, status (`task_status`), priority, due_date, project_block_id | No distingue Cliente/NEXA/Aprobación, no tiene dependencias, no se conecta a archivos/comentarios/cronología. |

**Decisión de diseño (necesita tu confirmación, ver sección 8):**
Dejar `methodology_stages`, `methodology_blocks`, `project_stages`,
`project_blocks`, `tasks` y el trigger `instantiate_project_methodology()`
**intactos pero en desuso** (no se borran en esta fase — cero riesgo).
Se construye el nuevo motor con tablas nuevas y bien nombradas. `projects`
sí se **extiende** (no se reemplaza) porque ya tiene la forma correcta.

### 0.4 Panel administrativo actual
- `admin/index.html` (Dashboard, datos simulados) y `admin/clientes.html`
  (Clientes, datos reales) comparten el mismo *shell*: `.admin-sidebar`,
  `.admin-topbar`, `.admin-main`, definidos en `css/admin.css`.
- Sidebar: enlaces reales a "Dashboard" y "Clientes"; "Proyectos", "Tareas",
  "Calendario", "Configuración" son placeholders inertes marcados "PRONTO".
  → El módulo Proyectos activará el enlace "Proyectos" (mismo patrón usado
  para activar "Clientes").
- Patrón de código ya establecido: `js/admin/{supabase,services,components,pages}/`.
  `clientService.js` es la única pieza que habla con Supabase; los
  componentes son puros; la página orquesta.
- Sistema visual: fondo oscuro, glassmorphism (`rgba(255,255,255,.03)` +
  `backdrop-filter:blur`), gradiente `--blue → --purple → --pink`, badges de
  estado, modal genérico, estados de carga/vacío/error, breakpoints en
  1180/992/900/576px.

### 0.5 Portal del Cliente
- `/portal` (login) y `/dashboard` (placeholder "en desarrollo") ya existen,
  con el mismo guard de sesión (`data-auth-guard="client"`). El contenido
  real del Portal del Cliente **no se ha construido todavía** — esta tarea
  es la primera que lo requiere explícitamente.

### 0.6 Edge Functions y almacenamiento
- Solo existe `create-client`. **No existe ningún bucket de Supabase
  Storage todavía** — el módulo Archivos lo necesitará (ver sección 6.7).

---

## 1. Arquitectura general del motor (mapeo directo de tu diagrama)

```
Cliente (profiles) ──< Workspace ──< Proyecto ──< Bloque (Fase) ──< Sección ──< Tarea
                                          │                                      │
                                          │                                      ├─ tipo: cliente / nexa / aprobación
                                          │                                      └─ (si aprobación) → registro en "approvals"
                                          │
                                          ├──< Archivo (por carpeta)
                                          ├──< Entregable (puede enlazar un Archivo)
                                          ├──< Comentario (polimórfico: proyecto/bloque/tarea/entregable)
                                          └──< Evento de Cronología (autogenerado)
```

Todas las entidades (Bloque, Tarea, Entregable, Comentario) son **genéricas**:
no existe ninguna tabla ni columna que mencione "Marca Personal" ni ningún
servicio específico. El **tipo de servicio** (Marca Personal, Página Web,
Meta Ads, etc.) es un dato de catálogo (`project_types`), no una estructura
de código distinta. Un mismo motor sirve para todos.

---

## 2. Nuevas tablas propuestas y relaciones (puntos 2 y 3 solicitados)

### 2.1 `project_types` — catálogo de servicios (el corazón de la reutilización)
En vez de un `enum` fijo (que requeriría una migración cada vez que NEXA
venda un servicio nuevo), es una **tabla administrable**:

```
project_types
  id            uuid PK
  name          text        -- "Marca Personal", "Meta Ads", "Render Arquitectónico"...
  slug          text UNIQUE -- "marca-personal", "meta-ads"
  color_hex     text        -- color sugerido por defecto para proyectos de este tipo
  description   text
  is_active     boolean default true
  created_at, updated_at
```
El admin puede agregar "Fotografía" o cualquier servicio futuro sin tocar
código ni base de datos — solo crea una fila.

### 2.2 `projects` (EXTENDER, no reemplazar)
Columnas nuevas vía `ALTER TABLE` (no rompe las filas/uso actuales, hoy
inexistentes):
```
+ project_type_id   uuid  → project_types(id), nullable
+ color_hex          text  -- color identificador propio (puede sobreescribir el del tipo)
+ responsible_id     uuid  → profiles(id), nullable  -- responsable NEXA del proyecto
+ archived_at        timestamptz, nullable            -- "Archivarlo" ≠ un estado de flujo
```
`status` reutiliza el `project_status` enum ya existente
(`not_started/in_progress/paused/completed/cancelled`), que ya cubre
Activo/Pausado/Reanudado/Finalizado. "Archivar" es independiente del estado
(un proyecto completado también puede archivarse).

El campo "Número de bloques" del formulario de creación **no se guarda como
columna**: se usa una sola vez para generar N filas iniciales en
`project_phases` (evita que quede desincronizado si luego se agregan o
eliminan bloques).

### 2.3 `project_phases` — Bloques
```
project_phases
  id                uuid PK
  project_id        uuid → projects(id) on delete cascade
  name              text            -- "Bloque 1"
  description       text
  order_index       int
  duration_days     int             -- "7 días"
  planned_start_date date
  planned_end_date   date
  status            progress_status  -- ver enum en sección 4
  progress_percent  int default 0    -- cacheado, recalculado por trigger (ver 5.3)
  created_at, updated_at
```

### 2.4 `project_sections` — Secciones dentro de un Bloque
```
project_sections
  id          uuid PK
  phase_id    uuid → project_phases(id) on delete cascade
  name        text     -- "Bio", "Links", "Fotografía", "Contenido"...
  order_index int
  created_at, updated_at
```

### 2.5 `project_tasks` — Tareas
```
project_tasks
  id            uuid PK
  section_id    uuid → project_sections(id) on delete cascade
  title         text
  description   text
  task_type     task_type          -- 'client' | 'nexa' | 'approval'
  status        progress_status
  priority      task_priority       -- reutiliza el enum ya existente
  assignee_id   uuid → profiles(id), nullable
  due_date      date
  order_index   int
  created_by    uuid → profiles(id)
  created_at, updated_at
```
Toda tarea vive dentro de una Sección (el servicio crea automáticamente una
sección "General" si el admin no define secciones explícitas, para no
obligar a un paso extra).

### 2.6 `approvals` — Detalle de tareas tipo "aprobación"
```
approvals
  id                uuid PK
  task_id           uuid UNIQUE → project_tasks(id) on delete cascade
  decision          approval_decision  -- 'pending' | 'approved' | 'changes_requested'
  decided_by        uuid → profiles(id), nullable
  decided_at        timestamptz, nullable
  decision_comment  text
  created_at, updated_at
```
Una fila 1:1 con cada tarea `task_type = 'approval'`. Las acciones
"Comentar" y "Adjuntar archivos" del cliente reutilizan `project_comments` y
`project_files` (ver abajo) en vez de duplicar esa lógica aquí.

### 2.7 `project_dependencies` — Dependencias inteligentes
```
project_dependencies
  id                        uuid PK
  phase_id                  uuid → project_phases(id)   -- el bloque que depende
  depends_on_phase_id       uuid → project_phases(id), nullable
  depends_on_task_id        uuid → project_tasks(id), nullable
  depends_on_deliverable_id uuid → project_deliverables(id), nullable
  created_at
  CHECK ( exactamente una de las 3 columnas depends_on_* no es nula )
```
Ejemplo del enunciado (Meta Ads bloqueado hasta Landing page + aprobación +
entrega de branding) = **3 filas** en esta tabla, todas con
`phase_id = <id de Meta Ads>`. Una función `is_phase_unblocked(phase_id)`
evalúa si TODAS las dependencias están satisfechas (fase `finished`, tarea
`completed`, entregable `approved`) y un trigger mantiene
`project_phases.status = 'blocked'` sincronizado automáticamente.

### 2.8 `project_files` — Archivos organizados por carpeta
```
project_files
  id                uuid PK
  project_id        uuid → projects(id) on delete cascade
  folder            text default 'General'   -- libre: permite carpetas personalizadas
  file_name         text
  storage_path      text    -- ruta dentro del bucket de Supabase Storage
  mime_type         text
  size_bytes        bigint
  uploaded_by       uuid → profiles(id)
  visible_to_client boolean default true
  created_at
```
Carpetas como "Logos", "Fotografías", "Videos", "PDF", "Contratos" son
simplemente valores de `folder` — el admin (o el sistema) puede crear
cualquier carpeta nueva sin migración.

### 2.9 `project_deliverables` — Entregables
```
project_deliverables
  id            uuid PK
  project_id    uuid → projects(id) on delete cascade
  phase_id      uuid → project_phases(id), nullable
  title         text
  description   text
  file_id       uuid → project_files(id), nullable
  status        deliverable_status   -- draft/delivered/approved/rejected
  delivered_by  uuid → profiles(id)
  delivered_at  timestamptz
  created_at, updated_at
```

### 2.10 `project_comments` — Comentarios (polimórficos)
```
project_comments
  id                 uuid PK
  project_id         uuid → projects(id) on delete cascade  -- para RLS/scoping simple
  commentable_type   text   -- 'project' | 'phase' | 'task' | 'deliverable'
  commentable_id     uuid
  author_id          uuid → profiles(id)
  body               text
  attachment_file_id uuid → project_files(id), nullable
  created_at, updated_at
```

### 2.11 `project_timeline_events` — Cronología automática
```
project_timeline_events
  id          uuid PK
  project_id  uuid → projects(id) on delete cascade
  event_type  text     -- 'project_created','phase_finished','task_completed','approval_decided','file_uploaded','deliverable_delivered','comment_added'
  description text     -- texto humano ya formado, ej: "Cliente aprobó el logo"
  actor_id    uuid → profiles(id), nullable
  metadata    jsonb
  created_at
```
Se llena **solo por triggers** (nunca por inserción directa desde el
frontend) al detectar cambios relevantes en `project_tasks`, `approvals`,
`project_phases`, `project_files`, `project_deliverables`.

---

## 3. Diagrama de relaciones (resumen)

```
profiles ──1:1── workspaces ──1:N── projects ──N:1── project_types
                                       │
                                       ├──1:N── project_phases ──1:N── project_sections ──1:N── project_tasks ──1:1── approvals
                                       │              │                                              │
                                       │              └──N (dependencias)──> project_phases/tasks/deliverables
                                       │
                                       ├──1:N── project_files
                                       ├──1:N── project_deliverables ──N:1── project_files
                                       ├──1:N── project_comments (polimórfico)
                                       └──1:N── project_timeline_events
```

---

## 4. Nuevos tipos ENUM necesarios

```sql
create type public.task_type as enum ('client', 'nexa', 'approval');

create type public.progress_status as enum (
    'pending', 'in_progress', 'waiting_approval', 'completed', 'blocked', 'finished'
);
-- Usado por project_phases.status Y project_tasks.status (mismo vocabulario,
-- evita mantener dos enums casi idénticos). Coincide exactamente con los
-- 6 estados que pediste: Pendiente/En proceso/Esperando aprobación/
-- Completado/Bloqueado/Finalizado.

create type public.approval_decision as enum ('pending', 'approved', 'changes_requested');

create type public.deliverable_status as enum ('draft', 'delivered', 'approved', 'rejected');
```
`task_priority` (ya existe) se reutiliza tal cual. `project_status` (ya
existe) se reutiliza tal cual para `projects.status`.

---

## 5. Automatizaciones (funciones y triggers)

1. **`recalculate_phase_progress(phase_id)`** — al cambiar
   `project_tasks.status`, recalcula `% completado` de la sección/fase
   (tareas completadas ÷ total) y actualiza `project_phases.progress_percent`.
2. **`recalculate_project_progress(project_id)`** — al cambiar el progreso de
   una fase, recalcula el progreso general del proyecto y, por separado, el
   **progreso "Cliente"** (solo tareas `task_type='client'`) y **progreso
   "NEXA"** (solo `task_type='nexa'`) — exactamente el ejemplo "CLIENTE 80%,
   NEXA 65%, PROYECTO 75%".
3. **`sync_phase_blocked_status(phase_id)`** — evalúa `project_dependencies`
   y fuerza `status='blocked'` (o lo libera) automáticamente.
4. **`log_timeline_event(...)`** — función reutilizada por triggers en
   `project_tasks`, `approvals`, `project_phases`, `project_files`,
   `project_deliverables` para insertar filas en `project_timeline_events`
   con una descripción humana ya generada (ej: `"{full_name} aprobó {title}"`).
5. **`duplicate_project(project_id)`** — función (o lógica en el servicio
   JS) que clona un proyecto con sus fases/secciones (sin tareas ni
   archivos/comentarios, que son específicos de la ejecución real) — cubre
   "Duplicarlos".

---

## 6. Row Level Security (política general)

Patrón consistente con lo ya implementado:

- **Admin**: `for all using (is_admin()) with check (is_admin())` en todas
  las tablas nuevas — acceso total, igual que hoy.
- **Cliente — lectura**: nuevo helper `is_project_owner(project_id)`
  (análogo a `is_admin()`) que verifica
  `projects.workspace_id → workspaces.client_id = auth.uid()`. Se usa en
  políticas `select` de `project_phases`, `project_sections`, `project_tasks`,
  `approvals`, `project_files` (solo `visible_to_client = true`),
  `project_deliverables`, `project_comments`, `project_timeline_events`.
- **Cliente — escritura (nueva, más granular que el patrón anterior)**:
  - `project_tasks`: `update` **solo** si `task_type = 'client'` y es dueño
    del proyecto (no puede tocar tareas NEXA ni cambiar título/tipo, solo
    `status`).
  - `approvals`: `update` de `decision`/`decision_comment` solo si es dueño
    del proyecto vía la tarea asociada.
  - `project_comments`: `insert`/`select` si es dueño del proyecto.
  - `project_files`: `insert` (subir archivos propios) + `select` donde
    `visible_to_client = true`.
  - `project_deliverables`, `project_phases`, `project_sections`,
    `project_timeline_events`: **solo lectura** para el cliente.

---

## 7. Diseño de Frontend

### 7.1 Reorganización de JS (evolución del patrón ya usado)
`clientService.js` es admin-only (los clientes nunca gestionan otros
clientes). Los servicios de Proyectos, en cambio, **los usan tanto el admin
como el cliente** (las políticas RLS ya limitan qué ve/edita cada uno), así
que propongo un nivel compartido nuevo, sin tocar lo existente:

```
js/
  admin/            (sin cambios: services/clientService.js sigue admin-only)
  services/          <- NUEVO, compartido admin + cliente
    projectService.js       (list/get/create/update/duplicate/archive/changeStatus)
    phaseService.js          (CRUD de bloques + progreso)
    taskService.js            (CRUD de tareas + dependencias)
    approvalService.js         (aprobar/solicitar cambios)
    fileService.js              (subir/listar/eliminar en Storage + tabla)
    deliverableService.js
    commentService.js
    timelineService.js
    projectTypeService.js
  components/         <- NUEVO, compartido (progreso, listas, badges de estado)
  admin/pages/proyectosPage.js, proyectoDetallePage.js
  client/pages/proyectosPage.js, proyectoDetallePage.js   (o dentro de dashboard/)
```

### 7.2 Experiencia del Administrador
- `admin/proyectos.html`: listado (tabla o tarjetas) con filtro por
  cliente/tipo/estado, botón **+ Nuevo Proyecto** (modal, seguirá el patrón
  del modal de Clientes) con los campos pedidos, incluido "Número de
  bloques" (genera N filas en `project_phases` automáticamente al guardar).
- `admin/proyecto-detalle.html?id=`: vista tipo Notion/Linear con pestañas:
  **Resumen** (progreso general + Cliente/NEXA + bloques completados, igual
  al ejemplo), **Bloques** (fases con secciones/tareas anidadas y
  candados 🔒 cuando `is_phase_unblocked()` = false), **Tareas** (todas,
  filtrables por tipo), **Archivos** (por carpeta), **Comentarios**,
  **Cronología**. Barra de acciones: Editar / Duplicar / Pausar / Reanudar /
  Finalizar / Archivar / Eliminar.

### 7.3 Experiencia del Cliente (dentro de `/dashboard`, hoy placeholder)
- Vista principal: nombre del cliente + tarjetas de "Proyectos activos" con
  barra de progreso (igual al ejemplo "Marca Personal 65%, Página Web 35%").
- Detalle de proyecto: progreso, tiempo restante, bloque actual, tareas
  pendientes **solo tipo cliente**, archivos disponibles, aprobaciones
  pendientes (con botones Aprobar/Solicitar cambios/Comentar/Adjuntar),
  cronología, entregables. Sin ningún elemento de administración visible.
- Mismo sistema visual (`--blue/--purple/--pink`, glassmorphism), pero con
  una capa de componentes propia (`css/client.css`, nuevo, sin tocar
  `css/portal.css` ni `css/admin.css`).

### 7.4 Nueva infraestructura necesaria (no es código, es configuración)
Se necesita crear un bucket de **Supabase Storage** (ej. `project-files`)
para los archivos reales — las tablas solo guardan la ruta/metadata. Esto se
hace una vez, junto con las migraciones, cuando implementemos.

---

## 8. Decisiones que necesito que confirmes antes de programar

1. ¿Apruebas dejar `methodology_stages/methodology_blocks/project_stages/project_blocks/tasks` **intactas pero en desuso** (sin borrarlas), y construir el nuevo motor con las tablas descritas arriba?
2. ¿Apruebas `project_types` como **tabla administrable** (en vez de un enum fijo) para poder agregar servicios futuros sin migraciones?
3. ¿Apruebas extender `projects` con `project_type_id`, `color_hex`, `responsible_id`, `archived_at` vía `ALTER TABLE` (no rompe nada, hoy no hay filas)?
4. ¿Confirmas el modelo de dependencias polimórfico (fase que puede depender de otra fase, de una tarea puntual, o de un entregable)?
5. ¿Confirmas construir ya la mitad de "Portal del Cliente" para Proyectos (antes se pausó explícitamente esa parte, ahora tu pedido la incluye)?
6. ¿Apruebas la reorganización de JS en `js/services/` y `js/components/` compartidos (nuevo, no toca `js/admin/*` existente)?

## 9. Qué sigue después de tu aprobación
Con el visto bueno, el orden de implementación sería: (1) migraciones SQL
(enums → project_types → alter projects → phases/sections/tasks/approvals →
dependencies → files/deliverables/comments/timeline → funciones/triggers →
RLS) → (2) bucket de Storage → (3) servicios JS → (4) frontend admin → (5)
frontend cliente — verificando en cada paso que nada de lo existente
(login, Dashboard, Clientes) se vea afectado.
