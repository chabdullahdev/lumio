# LUMIO landing page

One static page (`index.html`), no build step, no scripts from other sites. Deployed to
**https://lumio.mabdullahshahzad.com** with Vercel (Root Directory: `web`, framework preset
**Other**).

## What the page does

- **Download for Android** (two buttons) reads `latest.json` from the public `app-releases`
  Storage bucket and points at the newest APK, so publishing a new build
  (`npm run release:publish`) updates the page automatically. If the manifest cannot be read
  it falls back to `lumio-1.apk`.
- There is no sign-in on the website. Accounts are created inside the app (email or Google).
- Nothing secret lives here: the page contains no keys at all.

The sample quote in the phone preview is a real sentence from the stored text of Thucydides'
*History of the Peloponnesian War* (Crawley translation, public domain).

## Preview locally

```bash
npx serve web
```
