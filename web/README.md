# LUMIO landing page

One static page (`index.html`), no build step. Deployed to
**https://lumio.mabdullahshahzad.com** with Vercel.

## Deploy

1. In Vercel, import this repository and set **Root Directory** to `web`.
   Framework preset: **Other** (no build command, no output directory).
2. Add the domain `lumio.mabdullahshahzad.com` under Project → Settings → Domains
   and create the DNS record Vercel shows (a CNAME to `cname.vercel-dns.com`).

## One-time Supabase settings (needed for Google sign-in)

In the Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**, add:

- `https://lumio.mabdullahshahzad.com`
- `https://lumio.mabdullahshahzad.com/`
- `lumio://auth/callback` (this is how the Android/iOS app receives the Google sign-in)

In Google Cloud → OAuth client, the only authorised redirect URI that is needed is the
Supabase one: `https://kufcrqeobbjyblfcozvg.supabase.co/auth/v1/callback`.

## What the page does

- **Download APK** reads `latest.json` from the public `app-releases` Storage bucket and
  points at the newest APK, so publishing a new build (`npm run release:publish`) updates
  the page automatically. If the manifest cannot be read it falls back to `lumio-1.apk`.
- **Continue with Google** uses Supabase Auth (PKCE) and returns to the same page.
- The Supabase URL and the **publishable** key are embedded in `index.html`. They are meant
  to be public. Never put the service-role / secret key in this folder.

## Preview locally

```bash
npx serve web
```
