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

Connected. The Supabase MCP server (configured in opencode,
`~/.config/opencode/opencode.json`) is signed in to project
`kufcrqeobbjyblfcozvg` and was used for a **read-only review of the live
project on 16 October 2026** (outcome in §4). If it ever shows **needs
authentication** again:

1. In opencode, run `/mcps`, select **supabase**, and sign in (browser flow).
2. Reload/reopen the session so the Supabase tools load.

Alternative (CLI): `supabase login`, then
`supabase link --project-ref kufcrqeobbjyblfcozvg`, then `supabase db push` /
`supabase migration list` — only after the pre-flight in §4.

## 4. Applying the database migrations (after review)

Migrations live in `supabase/migrations/` and must be applied in filename
order. They are **not applied yet**: the schema was reviewed read-only against
the live project on 16 October 2026 and is cleared to apply — after one
Dashboard pre-flight.

**Review outcome (16 October 2026)**

- The project is empty — no tables, views, enums, policies, buckets, edge
  functions, branches, users, or migration history; advisors are clean. There
  are **no name or data conflicts** with the migrations.
- The environment matches the migrations' assumptions: PostgreSQL 17.11;
  `extensions` schema present (owned by `postgres`); pgvector 0.8.2 available
  (HNSW needs ≥ 0.5); `auth.uid()` present; `gen_random_uuid()` built in.
- Privileges verified for the migration role (`postgres`): create in `public`
  and `extensions`, create triggers and functions, reference `auth.users`,
  insert storage buckets. The platform's `rls_auto_enable` helper also
  auto-enables RLS on new `public` tables (our explicit enables stay
  idempotent).
- Default privileges expose new `public` tables to `anon`/`authenticated`/
  `service_role`, so **RLS policies are the actual gate** — as designed.
  `service_role` bypasses RLS (backend only); `anon`/`authenticated` do not.
- **Pre-flight required — enable pgvector first.** On this project `vector` is
  superuser-only to install (`pg_available_extension_versions` reports
  `superuser = true`, `trusted = false`) and the migration role is not a
  superuser. Enable it once at **Dashboard → Database → Extensions →
  `vector`** (installs into the `extensions` schema); migration 01's
  `create extension if not exists ...` then no-ops.

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
order; pass the filename stem as the migration name) so history is recorded,
or via the CLI — only after the pre-flight above. Apply one file, then verify
before starting the next: expected objects exist, advisors stay clean,
`list_migrations` shows the new entry; stop on the first error. After all
seven:

1. Run the Supabase security and performance advisors. Expect, and accept,
   "RLS enabled, no policy" for the service-only library tables and "unused
   index" on empty tables (fresh indexes).
2. Smoke checks: creating a test user produces a `profiles` row; a fresh
   authenticated session cannot read `passages` or another user's rows.

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

- **Schema not applied yet** → the seven migrations were reviewed against the
  live project read-only (16 Oct 2026, §4) and are cleared to apply once
  `vector` is enabled in the Dashboard. Everything shipped is local migration
  files, parser-validated but not server-applied.
- **Native rebuild pending** → `@react-native-async-storage/async-storage` was
  added; reopen the project in Ship Studio once to rebuild.
- `npm run validate:migrations` checks **syntax only** (real PostgreSQL
  grammar via libpg_query). Semantic checks happen against the server after
  applying.
- The app is still named `ReactNativeStarter` in `app.json` and the native
  projects; renaming is a small native change scheduled for the mobile phase.
- No authentication, onboarding, or lesson screens yet — later phases.
- Embedding model for Ollama is not pulled yet (needed for the retrieval phase).
