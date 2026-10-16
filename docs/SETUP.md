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
`supabase migration list` (all migrations are already applied — see §4).

## 4. Database migrations (applied and verified)

Migrations live in `supabase/migrations/` and are applied in filename order.
The schema was reviewed read-only against the live project on 16 October 2026
(review below); **all seven migrations are applied and verified** on the
development project — see the apply record after the table.

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
- **Pre-flight (done before applying) — pgvector.** On this project `vector`
  is superuser-only to install (`pg_available_extension_versions` reports
  `superuser = true`, `trusted = false`) and the migration role is not a
  superuser. It was enabled once at **Dashboard → Database → Extensions →
  `vector`** (installs into the `extensions` schema) before applying;
  migration 01's `create extension if not exists ...` then no-oped.

| # | File | Purpose |
| --- | --- | --- |
| 01 | `..._01_setup_extensions.sql` | pgvector extension, `updated_at` trigger helper |
| 02 | `..._02_profiles.sql` | `profiles` (1:1 with auth users), auto-create trigger, own-row RLS |
| 03 | `..._03_knowledge_library.sql` | `sources`, `licensing_records`, `source_sections`, `passages` (+ FTS/HNSW indexes). Service-only |
| 04 | `..._04_taxonomy_and_concepts.sql` | `categories` (dynamic tree), `concepts`, relations, `passage_concepts`, `user_interests` |
| 05 | `..._05_lessons.sql` | `lessons`, `lesson_takeaways`, `lesson_sources` (claim-level traceability), `lesson_concepts` |
| 06 | `..._06_learning_progress.sql` | `lesson_queue` (max 3 prepared, deduped), progress, covered concepts, `reading_activity`, `user_streaks` |
| 07 | `..._07_jobs_and_review.sql` | `jobs` (durable, idempotent, retryable), `job_events`, `review_items`, private storage buckets |

**Apply record (16 October 2026)** — applied via the Supabase MCP
`apply_migration` tool: one call per file, in filename order, each preceded by
a byte-level checksum of the local file and followed by object and history
checks. No errors; history holds all seven entries (server-assigned versions,
our names preserved). Server-side verification after all seven:

- 23 tables, 13 enums, 20 RLS policies — every policy granted `to
  authenticated` only (zero for `anon`; the `categories` read policy and the
  `user_interests` insert rule are exactly as reviewed). The 11 service-only
  library and job tables have RLS on with no client policies (deny by
  default).
- `on_auth_user_created` on `auth.users` is enabled (AFTER INSERT FOR EACH
  ROW); `handle_new_user` is `SECURITY DEFINER` with `search_path = ''`.
- Storage: `library-originals`, `library-processed`, `licensing-evidence` —
  all private; no storage policies (service-role access only).
- The passage vector index is planner-usable: EXPLAIN of a cosine KNN query
  shows `Index Scan using passages_embedding_idx` (HNSW,
  `vector_cosine_ops`).
- Advisors: no high-risk findings. INFO notes are the expected ones ("RLS
  enabled, no policy" ×11 for the service-only tables; "unused index" ×29 on
  the empty database; "unindexed foreign key" ×9). Two WARN-level items are
  function hygiene — `set_updated_at` has a mutable search path, and
  `handle_new_user()` is executable by client roles (both are trigger-only
  functions, so practical exposure is minimal; the platform's own
  `rls_auto_enable()` carries the same client-execute lint and is left
  untouched). Both can be silenced by a small follow-up migration:
  `alter function … set search_path` and
  `revoke execute … from anon, authenticated` (trigger firing does not depend
  on the EXECUTE grant).

Still to do when the first real account exists (no test user was created):
smoke-check that sign-up creates the `profiles` row and that an authenticated
session cannot read `passages` or other users' rows.

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

- **Schema applied and verified** → all seven migrations are live on the
  development project (16 Oct 2026, §4): 23 tables, 20 RLS policies (all
  `to authenticated`), service-only tables deny-by-default, three private
  storage buckets, signup trigger and HNSW vector index confirmed, no
  high-risk advisor findings. The connected project is for development only —
  provision a separate production project (and apply these migrations there)
  before real users.
- **Native rebuild pending** → `@react-native-async-storage/async-storage` was
  added; reopen the project in Ship Studio once to rebuild.
- `npm run validate:migrations` checks **syntax only** (real PostgreSQL
  grammar via libpg_query). Semantic checks happen against the server after
  applying.
- The app is still named `ReactNativeStarter` in `app.json` and the native
  projects; renaming is a small native change scheduled for the mobile phase.
- No authentication, onboarding, or lesson screens yet — later phases.
- Embedding model for Ollama is not pulled yet (needed for the retrieval phase).
