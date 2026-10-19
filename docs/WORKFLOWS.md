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
| `.env`, `backend/.env` and `webapp/.env.local` (keys) | Copy them from the first machine (AirDrop, USB, password manager). Never email or commit them. |
| Android signing key (`android/app/lumio-release.keystore`, `android/keystore.properties`) | Copy both. Only needed to publish app updates. |
| Installed packages | `npm install`, `cd backend && npm install` and `cd webapp && npm install` |
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
3. **The AI decides what to teach next.** The code lists the valid choices for
   this user (concepts that have licensed, unused passages, from categories
   not already in their queue). The AI sees that numbered list, the user's
   interests and their recent lesson titles, and picks one. It prefers new
   ideas and a different subject from recent lessons. If the AI answers badly,
   fails, or picks something not on the list, the built-in rules choose
   instead, so a lesson is never blocked. The choice and its reason are saved
   with the lesson (`quality_report.chosen_by`, `choice_reason`).
4. Select passages for that concept → build prompt → ask Ollama → **validate**
   → store lesson, takeaways, sources → `complete_job`.

To switch the AI planner off and use only the rules, set
`LUMIO_AI_PLANNER=off` in `backend/.env`.
5. If the local AI is not running, the worker **waits and logs it** instead of
   claiming jobs, so no retry attempts are wasted.
6. On failure: retry with backoff (30 s doubling, capped at 20 min) up to 5
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

### 5b. The librarian: finding new books automatically

A background program that keeps the library growing without you picking books.
Plain code finds real public-domain books (Project Gutenberg's official
catalogue); **your local AI chooses the best ones and the ideas each can teach**.
The AI can only pick from the real list it is shown; anything invented is
discarded. Gutenberg books are all US public domain, so the licence is recorded
as approved automatically.

```bash
cd backend
npm run librarian                       # keep going; Ctrl+C to stop
npm run librarian -- --once             # one round, then stop
npm run librarian -- --once --category History
```

Each round it takes the next category in turn (Geopolitics, History, Islam,
Politics, Psychology, Science) and:

1. checks the local AI is running (waits and logs if not);
2. the AI chooses up to 5 **new** books, with concepts and search words for each;
3. the books are downloaded and converted to files;
4. the books are saved to Supabase and their passages linked to the AI's
   concepts. This step needs `backend/.env`; without it the librarian says so
   and keeps the converted files for later.

Then it sleeps (default 30 minutes) and repeats. Every step skips finished work,
so stopping and restarting is always safe.

Settings in `backend/.env` (optional): `LIBRARIAN_INTERVAL_MS` (default
1800000) and `LIBRARIAN_PICK` (default 5).

The steps can also be run one at a time:

```bash
npm run discover                                 # dry run: shortlist per category
npm run discover -- --curate --category Islam    # AI chooses books
npm run discover -- --fetch                      # convert the AI's picks to files
npm run books:store                              # dry run: what would be saved
npm run books:store -- --apply                   # save to Supabase
```

Options for `discover`: `--category`, `--shortlist 40` (books the AI sees),
`--pick 8` (books it may choose), `--model <name>`, `--refresh` (re-download the
catalogue). Files go to `backend/library-data/` (not committed): `curated.json`
(all AI picks), and per book `book.md` (readable), `book.json` (chapters and
~250-word passages), `concepts.json`, and `stored.json` once saved.

**How concepts are linked.** The AI names the concepts and gives search words for
each; the code then links each concept to the 12 best-matching passages. This is
guided keyword matching, not the AI reading every passage, and it is fast. A
book whose title is already in the library is skipped (Gutenberg often has
several editions).

**Keep the AI running.** Leave Ollama open (it should start at login). The lesson
worker and the librarian both check it first and wait instead of failing.
`npm run check` (in `backend/`) reports whether the AI and the model are ready.
Run the librarian and the worker on only one computer at a time.

---

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

## 7b. The web app (runs in the browser, alongside the phone app)

**Run it on your computer**

```bash
cd webapp
npm install                              # once
cp .env.example .env.local               # fill in the URL + publishable key (same as the phone app's .env)
npm run dev                              # opens http://localhost:5173/app/
```

From the project root you can also use `npm run web:dev` and `npm run web:build`.
With no `.env.local` the app still runs in **sample mode** (placeholder lessons).

**Checks** (run before committing): `cd webapp && npm run typecheck && npm test && npm run build`.
`typecheck` needs the phone app's packages installed too (`npm install` in the project
root), because the web app type-checks the phone app's shared data code.

**What is shared.** The database code (`src/data`) comes from the phone app, so
change a query there and both apps get it. If you change `src/data/*`, run
the phone app's checks too (`npm run typecheck && npm test` in the root).
Screens are *not* shared: the web screens live in `webapp/src/screens/` and
must be updated by hand when a phone screen changes its behaviour or wording.

**Adding a web page:** add a route in `src/router.ts`, a screen in `src/screens/`,
and a case in `src/App.tsx`. Keep it working on phones (the nav becomes a bottom bar
under 640 px) and in light and dark mode.

**Deploying (Vercel, your account)**

1. In Vercel, import the GitHub repo `chabdullahdev/lumio` with **Root Directory = the
   repository root** (not `web`). The root `vercel.json` already sets the build
   (`webapp` → `web/app/`) and serves `web/`.
2. Add two environment variables to the project (both public values):
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Without them the
   deployed web app runs in sample mode only.
3. Deploy. The landing page is at `/` and the web app at `/app/`.
4. In **Supabase → Authentication → URL Configuration → Redirect URLs**, add
   `https://lumio.mabdullahshahzad.com/app/` (and `http://localhost:5173/app/` for local
   testing). Without this, "Continue with Google" cannot return to the web app.
5. Email sign-up links also return to `/app/`, so keep that URL on the same list.

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
