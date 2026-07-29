# Google Drive — Edge Function

Despliegue:

```bash
npx supabase db push
npx supabase secrets set GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx GOOGLE_REDIRECT_URI=https://TU-DOMINIO/admin/drive-oauth-callback.html
npx supabase functions deploy google-drive
```

En Google Cloud Console crea un OAuth Client (Web) con el mismo redirect URI.

Scopes usados: `drive.readonly`, `drive.metadata.readonly`, `userinfo.email`.
