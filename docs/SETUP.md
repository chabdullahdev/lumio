# LUMIO — Development Setup

How the pieces fit together:

```
┌──────────────────────────┐        ┌──────────────────────────────┐
│  Mobile app (Ship Studio)│  reads │  Supabase                     │
│  bare React Native + TS  │ ─────► │  PostgreSQL (RLS) + Storage   │
│  publishable key only    │        │                               │
└──────────────────────────┘        │                               │
                                    │  ▲ writes (service role)      │
┌──────────────────────────┐        │  │                           │
│  Backend workers (local) │ ─────► │  │                           │
│  Node.js + TS, backend/  │        └──┼───────────────────────────┘
│  service-role key        │           │
│        │                 │◄──────────┘
│        ▼                 │
│  Ollama (127.0.0.1 only) │
└──────────────────────────┘
```

Once a lesson is generated and stored in Supabase, the app can display it
without the developer's computer being on. Only *new* lesson generation needs
the local workers.

## Prerequisites

- **Node.js >= 22.11** (verified with v26.3.0). `node --test` and TypeScript
  type stripping are used natively by the backend — no build step.
- **Ship Studio** — builds and previews the mobile app. Do not run
  `react-native run-*` or `react-native start` manually.
- **A Supabase project** — the LUMIO development project is configured in the
  Supabase MCP entry (`project_ref` in `~/.config/opencode/opencode.json`).
- **Ollama** (for AI phases; installed locally). Current local model:
  `qwen3.5:9b`. An embedding model will be added when the retrieval phase
  starts. Ollama must stay on loopback.

## 1. Mobile app

```bash
npm install                      # installs deps; CocoaPods runs via postinstall on macOS
copy .env.example .env           # Windows: copy / macOS+Linux: cp
```

Fill `.env` (never committed):

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API | `https://<ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | same page | publishable (`sb_publishable_…`) or legacy anon key. **Never** the service/secret key — the app validator rejects it. |

Until `.env` is filled, the app runs and shows a "not configured" status card
on the home screen instead of failing.

**After adding a native dependency** (for example `@react-native-async-storage/async-storage`,
added in this phase), the native app must be rebuilt: go back to the project
list in Ship Studio and reopen the project. Pure JS/TS changes hot-reload.

Checks:

```bash
npm run typecheck
npm run lint
npm test
```

## 2. Backend workers

```bash
cd backend
npm install
copy .env.example .env           # backend/.env — never committed
npm run check                    # validates configuration; prints no secrets
```

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL` | same project URL as the app |
| `SUPABASE_SERVICE_ROLE_KEY` | **server side only** — bypasses RLS. Starts with `sb_secret_…` or is a service_role JWT (legacy). |
| `OLLAMA_BASE_URL` | defaults to `http://127.0.0.1:11434`; must not be publicly reachable |

Checks:

```bash
npm run typecheck
npm test                         # node --test, TypeScript runs natively
npm run validate:migrations      # parses every SQL migration with PostgreSQL's real parser
```

## 3. Supabase connection status

The Supabase MCP server is configured in opencode (`~/.config/opencode/opencode.json`)
but currently shows **needs authentication**. To connect it:

1. In opencode, run `/mcps`, select **supabase**, and sign in (browser flow).
2. Reload/reopen the session so the Supabase tools load.

Alternative (CLI): `supabase login`, then
`supabase link --project-ref <ref>`, then use `supabase db push` /
`supabase migration list`. Only after migration review (below).

## 4. Applying the database migrations (after review)

Migrations live in `supabase/migrations/` and must be applied in filename
order. They are **not applied yet** — the schema is proposed and awaits
review + a connected Supabase session.

| # | File | Purpose |
| --- | --- | --- |
| 01 | `..._01_setup_extensions.sql` | pgvector extension, `updated_at` trigger helper |
| 02 | `..._02_profiles.sql` | `profiles` (1:1 with auth users), auto-create trigger, own-row RLS |
| 03 | `..._03_knowledge_library.sql` | `sources`, `licensing_records`, `source_sections`, `passages` (+ FTS/HNSW indexes). Service-only |
| 04 | `..._04_taxonomy_and_concepts.sql` | `categories` (dynamic tree), `concepts`, relations, `passage_concepts`, `user_interests` |
| 05 | `..._05_lessons.sql` | `lessons`, `lesson_takeaways`, `lesson_sources` (claim-level traceability), `lesson_concepts` |
| 06 | `..._06_learning_progress.sql` | `lesson_queue` (max 3 prepared, deduped), progress, covered concepts, `reading_activity`, `user_streaks` |
| 07 | `..._07_jobs_and_review.sql` | `jobs` (durable, idempotent, retryable), `job_events`, `review_items`, private storage buckets |

Apply via the Supabase MCP `apply_migration` tool (one call per file, in
order) so migration history is recorded, or via the CLI. After applying:

1. Run the Supabase security and performance advisors; fix anything they flag.
2. Smoke checks: tables exist; RLS enabled everywhere; creating a test user
   produces a `profiles` row; a fresh authenticated session cannot read
   `passages` or another user's rows.

Rules: never edit a migration that has been applied — add a new one. No
destructive operations without explicit approval.

## 5. Security rules (non-negotiable)

- Publishable key in the app; service-role key only in `backend/.env`.
- RLS enabled on every table. Knowledge/library tables are deny-by-default for
  clients; the only client-readable knowledge data is top-level **approved**
  categories.
- `.env` files are gitignored; only `.env.example` files are committed.
- Ollama stays on loopback — never expose it to the public internet.
- Summary tables (`user_streaks`, `user_covered_concepts`, `reading_activity`)
  are read-only to users and written by the backend, so client apps cannot
  forge streaks.

## 6. Known limitations / current state

- **Supabase MCP is not signed in** → schema not applied; all database work so
  far is local migration files (validated by parser, not yet by the server).
- **Native rebuild pending** → `@react-native-async-storage/async-storage` was
  added; reopen the project in Ship Studio once to rebuild.
- `npm run validate:migrations` checks **syntax only** (real PostgreSQL
  grammar via libpg_query). Semantic checks happen against the server after
  applying.
- The app is still named `ReactNativeStarter` in `app.json` and the native
  projects; renaming is a small native change scheduled for the mobile phase.
- No authentication, onboarding, or lesson screens yet — later phases.
- Embedding model for Ollama is not pulled yet (needed for the retrieval phase).
