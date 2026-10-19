# LUMIO — Workflows

Step-by-step procedures for the things you do repeatedly. For background see
[STRUCTURE.md](STRUCTURE.md) and [RESOURCES.md](RESOURCES.md).

> **Golden rule:** don't run `react-native start`, `run-ios` or `run-android`
> yourself. Ship Studio builds and launches the app. Pure JS/TS edits
> fast-refresh; if the preview looks stuck, click **Reload** in the preview
> toolbar.

---

## 1. First-time setup

1. Install Node ≥ 22.11, Ship Studio, and Ollama (see RESOURCES.md).
2. Open the project in Ship Studio (first build takes a few minutes).
3. App config:
   ```bash
   npm install
   cp .env.example .env      # fill in SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY
   ```
4. Worker config:
   ```bash
   cd backend
   npm install
   cp .env.example .env      # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
   npm run check             # confirms the setup, prints no secrets
   ```
5. Pull the model once: `ollama pull qwen3.5:9b`.

Without `.env` the app still runs in **sample mode** with placeholder lessons.

---

## 1b. Working from a second computer

Git carries all the code, docs and database files. It deliberately does **not**
carry secrets or large generated files, so a second machine needs these once:

| Not in git | What to do on the new machine |
| --- | --- |
| `.env` and `backend/.env` (keys) | Copy them from the first machine (AirDrop, USB, password manager). Never email or commit them. |
| Android signing key (`android/app/lumio-release.keystore`, `android/keystore.properties`) | Copy both. Only needed to publish app updates. |
| Installed packages | `npm install` and `cd backend && npm install` |
| The AI model | `ollama pull qwen3.5:9b` |
| Your git name and email | `git config user.name "chabdullahdev"` and `git config user.email "238083306+chabdullahdev@users.noreply.github.com"` (inside the project) |
| GitHub login | `gh auth login` as `chabdullahdev` |
| Downloaded book files (`backend/library-data/`) | Nothing: regenerate with the discovery script, or just use the books already saved in Supabase. |

Then run `npm run doctor`. It lists exactly what is still missing.

**Daily habit, so the two machines never clash:** before you start, `git pull`;
when you stop, commit and `git push`. Only run the lesson worker on **one**
machine at a time.

---

## 2. Everyday development (the app)

1. Edit files in `src/`. The preview refreshes on its own.
2. Before committing, run all three checks:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```
3. If you add a package with native code: `npm install`, then go back to
   **Projects** in Ship Studio and reopen the project to rebuild.
4. After meaningful changes, update `APP.md` (and these docs if structure
   changed).

**Adding a screen:** create `src/screens/NameScreen.tsx`, add a route to the
`Route` type in `src/navigation/NavigationContext.tsx`, and render it where
routes are switched. Support light and dark mode (`use-theme.ts`), keep touch
targets ≥ 44 pt, and put the main action near the bottom.

**Adding data:** add the type to `src/data/types.ts`, then implement it in
**both** `sample-api.ts` and `supabase-api.ts` so sample and live modes stay
identical.

---

## 3. Database changes

1. Inspect the current schema first.
2. Add a **new** numbered file in `supabase/migrations/`
   (`YYYYMMDDHHMMSS_NN_name.sql`). Never edit one that has been applied.
3. Validate: `cd backend && npm run validate:migrations`.
4. Turn on RLS for any new table, and add policies only for what the app
   truly needs. Give new functions a fixed `search_path`.
5. Apply to Supabase (MCP `apply_migration`, or the dashboard SQL editor).
6. Verify: run the Supabase security and performance advisors and test with a
   real user session.
7. Record the apply in `docs/SETUP.md`.

No destructive operations (drops, deletes, resets) without explicit approval.

---

## 4. Lesson generation (the worker)

```bash
cd backend
npm run worker               # continuous; Ctrl+C to stop
npm run worker -- --once     # a single pass (testing)
```

Each pass:

1. `enqueue_replenish_jobs` — every onboarded user with fewer than 3 queued
   lessons gets a generation job.
2. `claim_jobs` — take due jobs safely (no double-processing).
3. Select passages → build prompt → ask Ollama → **validate** → store lesson,
   takeaways, sources → `complete_job`.
4. On failure: retry with backoff (30 s doubling, capped at 20 min) up to 5
   attempts, then the job is marked **dead**.

**Dead jobs.** If the library can't support a user's interests, the job is
dead-lettered immediately and reconciliation stops retrying, on purpose. It's
a signal to extend the library. After fixing it, requeue:

```sql
update public.jobs
   set status = 'queued', run_at = now(), locked_at = null,
       locked_by = null, finished_at = null
 where idempotency_key = 'replenish:<user-id>';
```

**Testing quality without a database key:**
```bash
node scripts/generate-preview.ts path/to/candidate-data.json --out lesson.json
```

---

## 5. Growing the knowledge library

1. Add the Gutenberg book to `BOOKS` in `backend/src/library/catalog.ts`, and
   add or extend a concept in `CONCEPTS`.
2. Dry run (writes nothing):
   ```bash
   cd backend
   node scripts/ingest-library.ts --show
   ```
3. Read the previewed passages for each concept. Fix keyword rules if they're
   off.
4. Apply:
   ```bash
   node --env-file-if-exists=.env scripts/ingest-library.ts --apply
   # or only some books: --apply --only 3207,1232
   ```
5. Re-running is safe: stored books are skipped, concept links are replaced,
   and links are capped at 12 per concept.
6. Spot-check a few generated lessons per concept.
7. Public-domain only. Every source needs an approved licensing record.

---

### 5b. Finding new books automatically (script + local AI)

A script reads Project Gutenberg's official catalogue (all public domain), sorts
books into the six LUMIO categories with plain rules, and your local AI chooses
the best ones and the concepts each can teach. The AI can only pick real books
from the list it is given; anything else it returns is discarded.

```bash
cd backend
node scripts/discover-books.ts                              # dry run: counts + shortlist per category
node scripts/discover-books.ts --curate --model <installed> # AI chooses (Ollama must be running)
node scripts/discover-books.ts --fetch                      # convert the AI's picks to files
```

Options: `--category History`, `--shortlist 40` (books the AI sees), `--pick 8`
(books it may choose), `--refresh` (re-download the catalogue). Output goes to
`backend/library-data/` (not committed): `curated.json`, and per book a
`book.md`, `book.json` (chapters + ~250-word passages) and `concepts.json`.
Nothing is written to Supabase yet; saving converted books to the database is
the next step.

## 6. Releasing an Android update

1. In `android/app/build.gradle`, raise `versionCode` (and usually
   `versionName`).
2. Rebuild the release APK (reopen the project in Ship Studio).
3. Make sure `android/keystore.properties` and
   `android/app/lumio-release.keystore` are present — a debug-signed build can
   never update a release-signed install.
4. Publish:
   ```bash
   npm run release:publish
   ```
   It checks the package id (`com.lumio.app`), the version code, and the
   signature; uploads `lumio-<versionCode>.apk` and `latest.json`; and refuses
   to replace a newer build unless you add `--force`.
5. Installed apps see the update card on next launch, download it, verify the
   SHA-256, and the user confirms the install. The website's download button
   updates automatically.
6. Commit the version bump and push (workflow 8).

---

## 7. Updating the website

1. Edit files in `web/`. Preview with `npx serve web`.
2. Keep the FAQ JSON-LD identical to the visible FAQ text.
3. Update `lastmod` in `sitemap.xml`.
4. If the share card changed, re-render `scripts/og-image.html` at exactly
   1200×630 into `web/og-image.png`.
5. Commit and push to `master`; Vercel redeploys.
6. Refresh the cached preview in Facebook's Sharing Debugger / LinkedIn's Post
   Inspector.

---

## 8. Committing and pushing to Git

1. Check what changed: `git status` and `git diff`.
2. Confirm no secrets are staged — `.env`, keystores, and service-role keys
   must never appear.
3. Stage specific files (not `git add -A`) and commit with a message that
   explains *why*:
   ```bash
   git add docs/ …
   git commit -m "Short summary of the change"
   ```
4. Push: `git push origin master`.
5. If the change touches the website, confirm the Vercel deployment succeeds.

---

## 9. Troubleshooting

| Symptom | Try |
| --- | --- |
| Preview blank or stuck | Click **Reload**; or Projects → reopen the project. |
| "Not configured" card on Home | Fill `.env`, then reload. |
| App rejects the key | You pasted a secret key; use the publishable key. |
| Google sign-in never returns | Add `lumio://auth/callback` to Supabase Redirect URLs. |
| No new lessons appearing | Is the worker running? Is Ollama up? Check for dead jobs (workflow 4). |
| Worker says Ollama unreachable | Start Ollama; confirm `OLLAMA_BASE_URL` is `127.0.0.1`. |
| Android update won't install over old app | Signing key differs — rebuild with the release keystore. |
| Everything else | `npm run typecheck && npm run lint && npm test`, and `cd backend && npm run check`. |

---

## 10. Security checklist (every change)

- Publishable key in the app; service-role key only in `backend/.env`.
- RLS on every table; library and job tables stay service-only.
- No `.env` or keystore in git.
- Ollama stays on loopback.
- Never claim a feature works without running it.
