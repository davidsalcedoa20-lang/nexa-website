# NEXA HUB — Separación www / hub

Objetivo:

- `www.nexaorigin.com` → sitio corporativo
- `hub.nexaorigin.com` → aplicación NEXA HUB (PWA)

El código ya está preparado: la PWA abre `/portal/index.html` (login → dashboard según sesión).

---

## 1. Qué hacer en Vercel

1. En el proyecto de NEXA WEB, agrega el dominio `hub.nexaorigin.com`.
2. Mantén `www.nexaorigin.com` (y el apex si aplica) para el sitio público.
3. (Recomendado, un solo proyecto) Configura un rewrite por host para que en `hub.nexaorigin.com` la ruta `/` sirva el Hub:

   - Source: `/`
   - Destination: `/portal/index.html`
   - Condición: Host = `hub.nexaorigin.com`

   (Si usas `vercel.json`, puedes añadir esa regla cuando decidas tocar Vercel.)

4. Asegura las variables de entorno en el entorno de producción:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - y las de Google Drive / Calendar que ya uses

5. Redeploy después de publicar estos cambios (nueva versión del Service Worker: `nexa-hub-static-v2`).

---

## 2. Qué hacer en el DNS

1. Crea un registro para el subdominio Hub, según indique Vercel (normalmente):

   - Tipo: `CNAME`
   - Nombre: `hub`
   - Valor: `cname.vercel-dns.com` (o el target exacto de Vercel)

2. Conserva los registros de `www` / apex del sitio corporativo.

3. Espera propagación DNS y el certificado SSL automático de Vercel.

---

## 3. Qué hacer en Google Cloud OAuth

En el cliente OAuth usado por Drive (y Calendar si comparte cliente):

1. **Authorized JavaScript origins** — añade:
   - `https://hub.nexaorigin.com`

2. **Authorized redirect URIs** — añade:
   - `https://hub.nexaorigin.com/admin/drive-oauth-callback.html`
   - (mantén las URIs actuales de preview/producción mientras sigan en uso)

3. En **Supabase Auth → URL configuration**, añade:
   - Site URL o Redirect URLs: `https://hub.nexaorigin.com/**`
   - Incluye `https://hub.nexaorigin.com/portal/index.html` si lo pides de forma explícita

No hace falta cambiar secretos ni scopes; solo orígenes/callbacks del nuevo host.

---

## 4. Cómo validar

1. Abre `https://hub.nexaorigin.com/portal/index.html` → login.
2. Con sesión: admin → `/admin/`, cliente → `/dashboard/`.
3. Instala la PWA desde el Hub (no desde www).
4. App instalada: splash → login o dashboard; nunca Inicio/Nosotros/Portafolio.
5. Conecta Google Drive desde un proyecto y confirma el callback en `hub`.
