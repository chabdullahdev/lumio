# LUMIO — Resources

Everything LUMIO depends on: services, tools, libraries, keys, content
sources, and reference documents. For where code lives see
[STRUCTURE.md](STRUCTURE.md); for how to do things see
[WORKFLOWS.md](WORKFLOWS.md).

## Services

| Service | Used for | Notes |
| --- | --- | --- |
| **Supabase** | Postgres database, Auth (email + Google), Storage | One project holds everything. Row Level Security on every table. |
| **Vercel** | Hosts the landing page (`web/`) and the web app (`/app/`, built from `webapp/`) | Root Directory = repository root; the root `vercel.json` does the build. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Live at https://lumio.mabdullahshahzad.com |
| **GitHub** | Source code | `https://github.com/chabdullahdev/lumio` (branch `master`). The website redeploys from here. |
| **Google (OAuth)** | "Continue with Google" | Configured in the Supabase Auth dashboard. |
| **Project Gutenberg** | Public-domain books for the library | Catalogue read and books fetched by the librarian (`discover-books.ts`) and `ingest-library.ts`. |
| **Wikipedia** | Seed articles (CC BY-SA 4.0) | Frozen in `supabase/seed/wikipedia-extracts.json`. |

### Supabase pieces

- **Tables** — see the migration list in [STRUCTURE.md](STRUCTURE.md). Library
  and job tables are service-only; users can only read approved top-level
  categories and their own lessons, progress and sources.
- **Auth redirects** — `lumio://auth/callback` (phone) and
  `https://lumio.mabdullahshahzad.com/app/` (web; plus `http://localhost:5173/app/`
  for local testing) must be listed under Authentication → URL Configuration →
  Redirect URLs, or Google sign-in never returns to the app.
- **Storage bucket `app-releases`** — public, 250 MB cap, APK and JSON only.
  Holds `lumio-<versionCode>.apk` and `latest.json`. Created by migration 15.
- **Auth setting to turn on before real users:** Leaked Password Protection
  (Authentication → password protection).

## Keys and secrets

| Secret | Lives in | Who may use it |
| --- | --- | --- |
| `SUPABASE_URL` | `.env` and `backend/.env` | App and worker (not secret). |
| `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`, or legacy anon key) | `.env` | The mobile app. Safe to ship because RLS protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_…`, or legacy service_role JWT) | `backend/.env` only | The worker and the release script. Bypasses RLS — never in the app, never committed, never shared. |
| Android signing keystore | `android/app/lumio-release.keystore` + `android/keystore.properties` | Release builds. Gitignored. **Back both up.** Losing them means every installed copy must be uninstalled before a new build can be installed. |

All `.env` files are gitignored; only `.env.example` templates are committed.

## Environment variables

**App (`.env`)**

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL, `https://<ref>.supabase.co`. |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key. The app refuses a secret key. |

**Web app (`webapp/.env.local`, and Vercel project settings)**

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL (public). |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (public by design; the app refuses a secret key). |

**Worker (`backend/.env`)**

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | — | Same project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Server-side key. |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local AI server. Must stay on loopback. |
| `OLLAMA_MODEL` | `qwen3.5:9b` | Model used to write lessons. |
| `OLLAMA_TIMEOUT_MS` | `600000` | Abort one generation after this long. |
| `WORKER_POLL_MS` | `15000` | Idle wait between polls. |
| `LIBRARIAN_INTERVAL_MS` | `1800000` | Wait between librarian rounds (30 min). |
| `LIBRARIAN_PICK` | `5` | Books the AI may choose per round. |
| `LUMIO_AI_PLANNER` | on | Set to `off` to stop the AI choosing each user's next topic (rules only). |

## Tools you need installed

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | ≥ 22.11 | App tooling; the backend runs TypeScript natively. |
| Ship Studio | current | Builds and previews the app. Don't run `react-native run-*` or `start` by hand. |
| Ollama | current | Runs the lesson-writing model locally. |
| Xcode + CocoaPods | current | iOS builds (macOS only). |
| Android SDK + JDK | current | Android builds, plus `apksigner`/`aapt` used by the release script's safety checks. |

## Main libraries

**Web app** — `vite`, `react` 19, `@supabase/supabase-js`, TypeScript, `vitest`.

**Mobile app** — `react-native` 0.86, `react` 19, `@supabase/supabase-js`,
`@react-native-async-storage/async-storage`, `react-native-safe-area-context`,
`react-native-url-polyfill`. Dev: TypeScript, Jest, ESLint, Prettier, `sharp`
(icon generation). Navigation is hand-rolled — no navigation library.

**Backend** — `@supabase/supabase-js`, `undici`; dev: TypeScript,
`pgsql-parser` (migration validation). Tests use Node's built-in runner.

## Content and licensing

- Every lesson is built only from library material with an **approved
  licensing record**; the generator refuses unlicensed sources.
- Current library: seven Wikipedia articles (CC BY-SA 4.0, attribution shown
  in the app) plus public-domain Gutenberg books listed in
  `backend/src/library/catalog.ts`.
- The Wikipedia set is **development seed data** — replace it with reviewed
  library ingestion before a production launch.
- Keyword links from concepts to passages are a first pass, not editorial
  review. Spot-check lessons per concept.

## AI model

- **Ollama** runs on the developer's machine, bound to `127.0.0.1`. The only model kept is `qwen3.5:9b` (`ollama pull qwen3.5:9b`).
- The AI does three jobs: it **chooses new books and their concepts** (librarian), **decides what each user learns next**, and **writes the lesson** (worker). Code always limits it to valid, licensed options. It never browses the internet; it only sees lists and passages the code hands it.
- The model only receives passages chosen by the worker; its output is
  validated (structure, length, takeaways, source use) before storage.
- Rough cost/time: one ~850-word lesson took about 7 minutes on `qwen3.5:9b`.
- Once a lesson is stored, the app shows it without the developer's computer
  being on; only *new* lessons need the worker.

## Brand

- Name: **LUMIO** · Tagline: "Less scrolling. More understanding."
- Accent green `#54E36E`; light and dark mode both supported.
- Master artwork in `public/`; regenerate icons with `npm run icons`.

## Reference documents

| Document | What it covers |
| --- | --- |
| [README.md](../README.md) | Quick overview. |
| [APP.md](../APP.md) | Product, screens, brand. |
| [docs/SETUP.md](SETUP.md) | Full setup, database apply records, release, security rules. |
| [docs/STRUCTURE.md](STRUCTURE.md) | Folder-by-folder map. |
| [docs/WORKFLOWS.md](WORKFLOWS.md) | Step-by-step procedures. |
| [web/README.md](../web/README.md) | Landing page and SEO. |
| [agent.md](../agent.md) | Working agreement for the AI development partner. |
