# LUMIO landing page

One static page (`index.html`), no build step, no scripts from other sites. Deployed to
**https://lumio.mabdullahshahzad.com** with Vercel (project `lumio-web`, Root Directory `web`,
framework preset **Other**, no build step). The full web app lives at `/app/`: `web/app/` is the
**committed build** of `webapp/` (run `npm run web:build` from the repository root after changing
it, then commit). See `docs/WORKFLOWS.md`, "The web app".

## What the page does

- **Download for Android** (two buttons) reads `latest.json` from the public `app-releases`
  Storage bucket and points at the newest APK, so publishing a new build
  (`npm run release:publish`) updates the page automatically. If the manifest cannot be read
  it falls back to `lumio-1.apk`.
- The landing page itself has no sign-in. **Open in your browser** goes to the web app at `/app/`,
  where accounts work the same as in the phone app (email or Google).
- Nothing secret lives here: the page contains no keys at all.

The sample quote in the phone preview is a real sentence from the stored text of Thucydides'
*History of the Peloponnesian War* (Crawley translation, public domain).

## SEO and sharing

- `index.html` carries the title, description, keywords, canonical URL, Open Graph and Twitter
  tags, and JSON-LD (Organization, Person, WebSite, MobileApplication, FAQPage). The FAQPage
  JSON-LD must always match the visible FAQ text word for word.
- `robots.txt`, `sitemap.xml`, `site.webmanifest` and `llms.txt` are served from the site root.
  Update the `lastmod` dates in `sitemap.xml` when pages change.
- The share card is `og-image.png` (1200x630). Its source is `scripts/og-image.html`: render that
  page at exactly 1200x630 (for example with a headless browser screenshot) to regenerate it.
- Touch icons come from the original app icon: `node scripts/generate-web-icons.mjs`.
- After publishing, refresh the cached preview on the sharing platforms (for example Facebook's
  Sharing Debugger or LinkedIn's Post Inspector); they cache images for days.

## Preview locally

```bash
npx serve web
```
