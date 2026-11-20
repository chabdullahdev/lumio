# LUMIO landing page

One static page (`index.html`), no build step, no scripts from other sites. Deployed to
**https://lumio.mabdullahshahzad.com** with Vercel (project `lumio-web`, Root Directory `web`,
framework preset **Other**, no build step). The full web app lives at `/app/`: `web/app/` is the
**committed build** of `webapp/` (run `npm run web:build` from the repository root after changing
it, then commit). See `docs/WORKFLOWS.md`, "The web app".

## What the page does

- **Start reading free** and **Install on your phone** go to the web app at `/app/`, which is an installable
  PWA (manifest and service worker in `webapp/public/`). There is no APK any more.
- The landing page itself has no sign-in. **Open in your browser** goes to the web app at `/app/`,
  where accounts work the same as in the phone app (email or Google).
- Nothing secret lives here: the page contains no keys at all.

The sample quote in the phone preview is a real sentence from the stored text of Thucydides'
*History of the Peloponnesian War* (Crawley translation, public domain).

## SEO and sharing

- `index.html` carries the title, description, keywords, canonical URL, Open Graph and Twitter
  tags, and JSON-LD (Organization, Person, WebSite, WebApplication, FAQPage). The FAQPage
  JSON-LD must always match the visible FAQ text word for word.
- `robots.txt`, `sitemap.xml` and `llms.txt` are served from the site root. `/app/` is kept out of search with a
  `noindex` tag in `web/app/index.html`; do not also block it in `robots.txt`, or Google cannot read the tag.
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
