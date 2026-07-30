# NEXA HUB — Separación www / hub

Objetivo:

- `www.nexaorigin.com` → sitio corporativo
- `hub.nexaorigin.com` → aplicación NEXA HUB (PWA)

El código ya está preparado: la PWA abre `/portal/index.html` (login → dashboard según sesión).

---

## 1. Qué hacer en Vercel

1. Dominio `hub.nexaorigin.com` asignado al proyecto (ya hecho si DNS está OK).
2. Mantén `www.nexaorigin.com` / `nexaorigin.com` para el corporativo.
3. Enrutamiento por hostname (ya en el repo):
   - `vercel.json`: redirects **solo** si `host === hub.nexaorigin.com`
   - `middleware.js`: refuerzo Edge — `www` / apex nunca se redirigen; `hub` → `/portal/index.html`
4. **Redeploy** obligatorio para aplicar ambos archivos.

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
