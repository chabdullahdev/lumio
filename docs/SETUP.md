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

Launcher icons and the in-app logo marks are generated from the artwork in
`public/` (`LUMIO app icon.svg`, `LUMIO header logo.svg`) — run `npm run icons`
after changing them.

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
| `OLLAMA_MODEL` | defaults to `qwen3.5:9b` |
| `OLLAMA_TIMEOUT_MS` | abort a single generation call after this long (default 600000 = 10 min) |
| `WORKER_POLL_MS` | idle sleep between worker polls (default 15000) |

### Running the lesson worker

```bash
cd backend
npm run worker                   # poll loop; Ctrl+C to stop
npm run worker -- --once         # one pass (useful while testing)
```

Each pass: `enqueue_replenish_jobs` (gives every onboarded user below three
queued lessons one generation job) → `claim_jobs` → generate → validate →
store → `complete_job`. Failures retry with backoff (30 s doubling, capped at
20 min) up to 5 attempts, then the job is marked *dead* for inspection.

**Dead jobs and insufficient material.** If the approved library cannot
support a user's interests, the job is marked dead immediately
(`dead_letter_job`) and **keeps its idempotency key** — reconciliation then
stops creating jobs for that user so nothing churns. This is deliberate: dead
jobs are the signal that a human should extend the library. To retry after
fixing the library, clear the failure state, for example:

```sql
update public.jobs
   set status = 'queued', run_at = now(), locked_at = null, locked_by = null, finished_at = null
 where idempotency_key = 'replenish:<user-id>';
```

### Generating one lesson offline

For reviewing lesson quality without a service-role key there is a
DB-free preview path:

1. Export candidate data for a user as JSON (a `CandidateData` document — see
   `backend/src/lessons/candidates.ts`) using any SQL console.
2. Run:

```bash
node scripts/generate-preview.ts path/to/candidate-data.json --out lesson.json
```

It runs the real pipeline (selection → prompt → Ollama → validation) and
writes the validated lesson plus its plan (passage/concept ids) to
`lesson.json`. Exit code 2 = insufficient material, 3 = generation/validation
failure (the raw output is printed for inspection).

### Authoring lessons offline and storing them

When generation is too slow or too unreliable (for example CPU-only Ollama),
lessons can be authored offline against the same candidate data and stored
through the production write path. Two scripts cover this:

```bash
# 1. Build up to three distinct plans (real candidate selection, full passage text)
node --env-file-if-exists=.env scripts/plan-lessons.ts <user-id> --count 3 --out plans.json

# 2. After filling in a `lesson` object per plan (same JSON shape the model
#    returns), validate and store them exactly as generate.ts does:
#    lesson row -> takeaways -> sources -> concepts -> queue -> ready
node --env-file-if-exists=.env scripts/store-authored-lessons.ts authored.json
```

`store-authored-lessons.ts` re-validates every lesson with `validate.ts`, skips
titles already stored for the user, and refuses to write anything that would not
have passed the model path. Authored lessons are marked with
`generation_model = 'assistant-authored'` and a dated `prompt_version` in the
quality report, so provenance stays visible.

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
(review below); **all twelve migrations are applied and verified** on the
development project — see the two apply records after the table.

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
| 08 | `..._08_function_hygiene.sql` | `set_updated_at` explicit empty `search_path`; client EXECUTE revoked on `handle_new_user` (signup trigger unaffected) |
| 09 | `..._09_learning_loop.sql` | completion trigger (activity, streak, concepts, queue close, replenishment job) + job protocol (`claim_jobs`/`complete_job`/`fail_job`) + reconciliation (`enqueue_replenish_jobs`) |
| 10 | `..._10_seed_subjects.sql` | six approved top-level subjects (Science, History, Psychology, Islam, Geopolitics, Politics) |
| 11 | `..._11_seed_library.sql` | generated starter library: 7 sources, 12 concepts, 69 passages, 118 passage–concept links (see provenance below) |
| 12 | `..._12_dead_letter_jobs.sql` | `dead_letter_job`: terminal failure on first attempt, keeps the idempotency key to stop reconciliation churn |
| 13 | `..._13_lesson_source_reads.sql` | owner-scoped read policies on `sources`/`licensing_records`/`passages` so the reader can show a lesson's source attribution (found by end-to-end testing under RLS) |
| 14 | `..._14_job_search_path.sql` | explicit `set search_path = ''` on the job-protocol functions (advisor hygiene; behaviour unchanged) |
| 15 | `..._15_app_releases_bucket.sql` | public `app-releases` Storage bucket (APK + `latest.json` for Android auto-update) |

**Apply record (16 October 2026)** — applied via the Supabase MCP
`apply_migration` tool: one call per file, in filename order, each preceded by
a byte-level checksum of the local file and followed by object and history
checks. No errors; history holds all eight entries (server-assigned versions,
our names preserved). Server-side verification after all eight:

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
  the empty database; "unindexed foreign key" ×9). The two WARN-level function
  hygiene items were cleared by migration 08 (16 Oct 2026): `set_updated_at`
  now runs with `search_path = ''`, and EXECUTE on `handle_new_user()` was
  revoked from PUBLIC, `anon`, and `authenticated` — trigger invocation does
  not check the EXECUTE grant, so the signup trigger keeps firing (verified:
  trigger unchanged and enabled, all 12 `updated_at` triggers intact). The
  platform's own `rls_auto_enable()` carries the remaining client-execute lint
  and is deliberately left untouched.

Still to do when the first real account exists (no test user was created):
smoke-check that sign-up creates the `profiles` row and that an authenticated
session cannot read `passages` or other users' rows.

**Apply record #2 (16–17 October 2026) — migrations 09–14.** Applied via the
Supabase MCP `apply_migration` tool in filename order. Server-side
verification after applying:

- 6 approved top-level categories; 7 `ready` sources each with an approved
  licensing record; 12 concepts; 69 passages; 118 passage–concept links.
- `on_lesson_completed` trigger enabled; job functions (`claim_jobs`,
  `complete_job`, `fail_job`, `enqueue_replenish_jobs`, `dead_letter_job`)
  present with EXECUTE revoked from `anon`/`authenticated` (checked via
  `has_function_privilege`).
- **End-to-end checks with a real user session** (a confirmed signup via the
  public auth API, then PostgREST calls with the user's JWT):
  - reads: 6 approved categories visible; `passages`/`jobs` return zero rows;
  - hostile writes all rejected (HTTP 403, SQLSTATE 42501): inserting
    `passages`, `lessons`, `reading_activity`, `user_streaks`, and RPC calls
    to `claim_jobs`/`dead_letter_job`;
  - a `user_interests` row pointing at a non-existent category is rejected;
  - `enqueue_replenish_jobs` created exactly one job for the onboarded user
    and a second call created none (idempotency);
  - `claim_jobs` claimed the job (attempts + 1); a second worker got nothing;
  - `fail_job`: first failure requeued with ~30 s backoff; failure at
    `max_attempts` produced `dead`;
  - `dead_letter_job`: immediate `dead`, idempotency key **kept**, `job_events`
    row written; reconciliation inserted nothing while the key was held
    (anti-churn), and after putting the job back to `queued` it was claimable
    again (documented recovery path);
  - a stale `running` lock (40 minutes old) was reclaimed by another worker
    with attempts incremented.
- **End-to-end testing found and fixed a real RLS gap** (migration 13):
  `lesson_sources` could be read by owners, but the embedded `sources`,
  `licensing_records`, and `passages` rows were service-only, so the reader's
  source attribution silently came back empty. Migration 13 adds
  owner-scoped policies (visible only while referenced by one of the
  reader's own lessons); verified afterwards: attribution resolves, and a
  passage not used by the user's lessons is still invisible.
- **Advisors after migrations 09–14** (17 Oct 2026): security — no
  high-risk findings. Remaining WARNs: the platform's own `rls_auto_enable()`
  (client-executable SECURITY DEFINER helper, not ours — left untouched) and
  *Leaked Password Protection Disabled*, which is an Auth dashboard setting
  (Authentication → password protection; worth enabling before real users).
  The function-search-path warning on the new job functions was cleared by
  migration 14. Performance — two INFO items only. Eight tables still show
  "RLS enabled, no policy" by design (the service-only library/job tables,
  checked directly against `pg_policies`).
- **Real end-to-end lesson (17 Oct 2026).** One lesson was generated through
  the real pipeline: `backend/scripts/generate-preview.ts` planned from the
  live library (Science — Photosynthesis + Primary production, 7 passages,
  1624 source words), `qwen3.5:9b` produced an 853-word lesson in 430 s
  (≈7 min; the worker's default Ollama timeout is 10 min), and it passed
  validation first try. It was then stored exactly as `generate.ts` does
  (`generating` → child rows → queue → `ready`, with the job checkpointed and
  completed). Verified afterwards with the test user's session: home shows the
  lesson as next; the reader queries return 12 blocks, 4 takeaways, and 7
  source rows with CC BY-SA attribution; completing it kept the same-day
  streak at 1, raised the day's count to 2, bumped both covered concepts to
  *twice covered*, closed the queue row, and enqueued the next replenishment
  job (the previous key had been freed by `complete_job`).

**Apply record #3 (19 October 2026) — migration 15.** Applied via the Supabase
MCP `apply_migration` tool. Verified afterwards: `storage.buckets` holds
`app-releases` with `public = true`, a 250 MB size cap, and only the APK and
JSON MIME types allowed. No storage policies were added — reads happen through
the public object URL, uploads through the service-role key, which bypasses
RLS.

**Seeded library provenance (migration 11).** The starter library is seven
Wikipedia articles frozen as a committed snapshot
(`supabase/seed/wikipedia-extracts.json`) and generated into SQL by
`backend/scripts/build-library-seed.mjs` (reruns reproduce byte-identical
SQL). All extracts are CC BY-SA 4.0; each source row stores the attribution
and licence, and the app shows the source line on every lesson. This is
**development seed data** — replace with properly reviewed library ingestion
before production. The generator never lets a source without an approved
licensing record be used for a lesson.

Rules: never edit a migration that has been applied — add a new one. No
destructive operations without explicit approval.

## 5. Releasing the Android app (auto-update)

Installed apps update themselves from the public **`app-releases`** storage
bucket (migration 15). Release flow:

1. Bump `versionCode` (and usually `versionName`) in `android/app/build.gradle`.
2. Rebuild the release APK (Ship Studio: reopen the project).
3. Publish it:

   ```bash
   npm run release:publish
   ```

   The script reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
   `backend/.env`, uploads `lumio-<versionCode>.apk` plus `latest.json`, and
   refuses to replace a newer published build unless `--force` is passed.

4. On next launch the app compares the published `versionCode` with the
   installed one, shows an update card, downloads with progress, verifies the
   APK's SHA-256, and hands it to the Android installer (the user confirms the
   install; Android does not allow fully silent installs for normal apps).

**Release signing.** The build reads `android/keystore.properties` and
`android/app/lumio-release.keystore` (both gitignored). **Back both files up
somewhere safe** — Android only accepts an update signed with the same key, so
losing them means every installed app must be uninstalled before the next
build can be installed. Without the properties file the release build falls
back to the debug key (with a Gradle warning), which can still be installed
fresh but can never update an existing release-signed install.

## 6. Security rules (non-negotiable)

- Publishable key in the app; service-role key only in `backend/.env`.
- RLS enabled on every table. Knowledge/library tables are deny-by-default for
  clients; the only client-readable knowledge data is top-level **approved**
  categories.
- `.env` files are gitignored; only `.env.example` files are committed.
- Ollama stays on loopback — never expose it to the public internet.
- Summary tables (`user_streaks`, `user_covered_concepts`, `reading_activity`)
  are read-only to users and written by the backend, so client apps cannot
  forge streaks.

## 7. Known limitations / current state

- **The whole core journey is built** (app): welcome/sign-in, interest
  onboarding, home with three prepared lessons, reader with progress saving,
  takeaways, completion, explore, profile. Sample mode works with no backend
  at all; live mode runs against Supabase under RLS.
- **Learning loop is live in the database** (migrations 09 + 12): completion
  side effects and the durable job protocol are verified with a real user
  (see apply record #2 above).
- **Lesson generation worker requires the service-role key.** Everything in
  `backend/` is written and unit-tested, but `npm run worker` cannot run until
  `backend/.env` contains `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Project
  Settings → API keys). This is the one external step left.
- **Native rebuild pending** → `@react-native-async-storage/async-storage` was
  added; reopen the project in Ship Studio once to rebuild. Pure JS/TS changes
  hot-reload.
- **Test account (development only)** → `lumio.e2e.<timestamp>@gmail.com`
  (see the Supabase dashboard → Authentication → Users; the password was
  generated during testing — reset it there, or delete the account). Its
  interest data and progress exist only to exercise the loop.
- **Seeded library is development material** → Wikipedia extracts (CC BY-SA
  4.0) with per-source attribution; replace with reviewed ingestion before
  production. Only six subjects are covered, which is enough for the loop but
  not for variety.
- `npm run validate:migrations` checks **syntax only** (real PostgreSQL
  grammar via libpg_query). Semantic checks happen against the server after
  applying.
- **App identity**: Android application id `com.lumio.app`, label **Lumio**
  (renamed from the starter template). The iOS project folder is still
  `ios/ReactNativeStarter` and its bundle id has not been changed — harmless
  until an iOS build is set up, and changing it then does not affect Android.
- **Auto-update is Android-only**: it installs signed APKs, so iOS would need
  the App Store (or TestFlight) instead. Update UI hides itself when the
  native module or backend config is missing.
- **First install after the rename must be manual** (uninstall the old
  `com.reactnativestarter` build, then install the new APK); automatic updates
  apply from `com.lumio.app` build 1 onwards.
- Embedding model for Ollama is not pulled yet (needed for the retrieval
  phase). Passage embeddings are not generated yet; lesson selection uses
  concept links instead.
