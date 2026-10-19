# LUMIO — Project Structure

A map of every folder in the repository: what lives there, what it does, and
what to be careful about. For setup steps see [SETUP.md](SETUP.md); for the
services and tools the project depends on see [RESOURCES.md](RESOURCES.md); for
step-by-step procedures see [WORKFLOWS.md](WORKFLOWS.md).

## The big picture

LUMIO is made of four parts that share one database:

```
┌─────────────────────┐   reads (publishable key, RLS)   ┌───────────────────┐
│ Mobile app          │ ───────────────────────────────► │ Supabase          │
│ React Native + TS   │                                  │ Postgres + Storage│
│ (root, src/)        │ ◄─────────────────────────────── │ + Auth            │
└─────────────────────┘     APK updates (app-releases)   │ (supabase/)       │
                                                         └─────────▲─────────┘
┌─────────────────────┐   writes (service-role key)                │
│ Backend worker      │ ───────────────────────────────────────────┘
│ Node + TS (backend/)│
│        │            │
│        ▼            │
│ Ollama (local only) │
└─────────────────────┘

┌─────────────────────┐
│ Landing page (web/) │  static HTML on Vercel; reads latest.json for the
└─────────────────────┘  Android download link

┌─────────────────────┐  same Supabase, same accounts and lessons as the
│ Web app (webapp/)   │  phone app; built into web/app/ and served at
└─────────────────────┘  /app/ on the landing site
```

- The **app** only reads and writes the signed-in user's own data.
- The **worker** is the only thing that creates lessons, using the secret key
  and a local AI model.
- **Supabase** holds the data, enforces who can see what (Row Level Security),
  and hosts the Android update files.
- The **website** is a separate static page; it contains no secrets.
- The **web app** is the whole LUMIO experience in a browser. It talks to Supabase
  with the same publishable key and reuses the phone app's data code.

## Top level

| Path | Purpose |
| --- | --- |
| `App.tsx` | Root of the mobile app: wraps everything in providers and picks the first screen. |
| `index.js` | React Native entry point. Don't edit. |
| `app.json` | App name registered with React Native. |
| `package.json` | Mobile app dependencies and scripts (`typecheck`, `lint`, `test`, `icons`, `release:publish`). |
| `.env.example` | Template for the app's `.env` (Supabase URL + **publishable** key only). |
| `APP.md` | Product description: purpose, screens, brand, tech summary. |
| `README.md` | Short project overview and quick start. |
| `CLAUDE.md` | Ship Studio rules for the AI assistant working in this project. |
| `agent.md` | Working agreement and product rules for the AI development partner. |
| `babel.config.js`, `metro.config.js`, `tsconfig.json`, `jest.config.js`, `jest.setup.js`, `.eslintrc.js`, `.prettierrc.js` | Build, type-check, test and style configuration. |
| `Gemfile`, `.bundle/` | Ruby setup used by CocoaPods for iOS. |
| `.shipstudio/` | Ship Studio project metadata. |
| `vercel.json` | Deployment: builds `webapp/` and serves `web/` (landing page + `/app/`). |

## `src/` — the mobile app

```
src/
├── screens/        One file per screen
├── components/     Reusable UI pieces
├── navigation/     Screen flow and bottom tabs
├── state/          App-wide state (session, updates)
├── data/           Data layer: sample mode and live (Supabase) mode
├── lib/            Helpers: env, Supabase client, Google sign-in, updates, dates, theme
├── assets/         Logo images (green + ink, @1x/@2x/@3x)
├── types/          TypeScript declarations (env variables)
├── test-utils/     Test stubs
└── theme.ts        Colours, spacing, type — light and dark
```

### Screens (`src/screens/`)

| File | Screen | Notes |
| --- | --- | --- |
| `WelcomeScreen.tsx` | Welcome | Entry point: sign in, create account, or explore sample lessons. |
| `AuthScreen.tsx` | Sign in / sign up | Email + password, and Google sign-in. |
| `OnboardingScreen.tsx` | Choose interests | Pick broad subjects. |
| `HomeScreen.tsx` | Home | Next recommended lesson, streak, upcoming lessons. |
| `LessonScreen.tsx` | Reader | Block-by-block reading; progress is saved as you go. |
| `TakeawaysScreen.tsx` | Takeaways | 3–5 key takeaways and the sources used. |
| `CompleteScreen.tsx` | Completion | Summary after finishing a lesson. |
| `ExploreScreen.tsx` | Explore | Selected topics and their next lessons. |
| `TopicsEditorScreen.tsx` | Edit topics | Change interests after onboarding. |
| `ProfileScreen.tsx` | Profile | Interests, reading time, reminders, streak history. |

### Navigation (`src/navigation/`)

LUMIO's flow is small and linear (welcome → onboarding → tabs → lesson →
takeaways → complete), so it uses a simple typed screen stack held in React
state (`NavigationContext.tsx`) instead of a navigation library — no extra
native dependency. `MainTabs.tsx` provides the three bottom tabs: Home,
Explore, Profile.

### State (`src/state/`)

- `session.tsx` — who is signed in, and which data mode is active.
- `updates.tsx` — Android update availability and download progress.

### Data layer (`src/data/`)

Screens never talk to Supabase directly; they call one interface with two
implementations that return the same shapes (`types.ts`):

- `sample-api.ts` + `sample-lessons.ts` — **sample mode.** Bundled, clearly
  labelled placeholder lessons. Used when Supabase isn't configured, so the
  whole app works with no backend.
- `supabase-api.ts` — **live mode.** Talks to Supabase with the publishable
  key under Row Level Security.

### Helpers (`src/lib/`)

| File | Purpose |
| --- | --- |
| `env.ts` | Reads and validates `.env`; rejects a secret key if one is pasted by mistake. |
| `supabase.ts` | Creates the Supabase client (or reports "not configured"). |
| `google-auth.ts` | Google sign-in via Supabase (PKCE) using the `lumio://auth/callback` link. |
| `updates.ts` | Checks `latest.json` for a newer Android build and hands off the install. |
| `dates.ts` | Local-date helpers for streaks. |
| `use-theme.ts` | Light/dark colours for components. |

Tests live next to the code in `__tests__/` folders; the root `__tests__/`
holds the app-level smoke test.

## `backend/` — lesson worker

A separate Node.js + TypeScript project (own `package.json`, own `.env`). It
runs natively — no build step.

```
backend/
├── src/
│   ├── worker/main.ts      Poll loop: enqueue → claim → generate → complete/fail
│   ├── lessons/            candidates.ts (valid choices + passages), planner.ts (AI picks what's next),
│   │                       prompt.ts, generate.ts,
│   │                       validate.ts, types.ts
│   ├── library/            catalog.ts (reading list), epub.ts, passages.ts,
│   │                       gutenberg-catalog.ts, curate.ts, book-files.ts, store.ts
│   ├── ollama.ts           Client for the local AI model
│   ├── ollama-health.ts    Is the local AI up and is the model installed?
│   ├── supabase-admin.ts   Service-role Supabase client
│   ├── env.ts              Loads and validates backend/.env
│   └── check-env.ts        `npm run check` — prints status, never secrets
├── scripts/
│   ├── ingest-library.ts       Add public-domain books to the library
│   ├── librarian.ts            Loop: AI picks new books → convert → save, forever
│   ├── discover-books.ts       Find books in Gutenberg's catalogue, AI picks, convert to files
│   ├── store-books.ts          Save converted books + AI concepts into Supabase
│   ├── plan-lessons.ts         Preview what lessons would be planned
│   ├── generate-preview.ts     Generate one lesson offline from a JSON file
│   ├── store-authored-lessons.ts  Store hand-authored lessons
│   ├── build-library-seed.mjs  Rebuild migration 11 from the Wikipedia snapshot
│   └── validate-migrations.ts  Parse every SQL migration with Postgres' real parser
└── test/                   Node test runner suites
```

## `supabase/` — database

| Path | Purpose |
| --- | --- |
| `migrations/` | Numbered SQL files (`01`–`16`) that build the schema. **Never edit one that has been applied — add a new one.** |
| `seed/wikipedia-extracts.json` | Frozen snapshot of seven Wikipedia articles used for the starter library (CC BY-SA 4.0). |

Migration groups:

| Migrations | Contents |
| --- | --- |
| 01–02 | Extensions, `set_updated_at`, `profiles` and the new-user hook. |
| 03 | Knowledge library: `sources`, `licensing_records`, `source_sections`, `passages`. |
| 04 | `categories`, `concepts`, relations, `passage_concepts`, `user_interests`. |
| 05 | `lessons`, `lesson_takeaways`, `lesson_sources`, `lesson_concepts`. |
| 06 | `lesson_queue`, `user_lesson_progress`, `user_covered_concepts`, `reading_activity`, `user_streaks`. |
| 07 | `jobs`, `job_events`, `review_items`. |
| 08, 14, 16 | Function hygiene, fixed search paths, security and index fixes. |
| 09 | Learning loop: completion trigger, `claim_jobs`, `complete_job`, `fail_job`, `enqueue_replenish_jobs`. |
| 10–11 | Starter subjects and seeded library. |
| 12 | `dead_letter_job`. |
| 13 | Owner-scoped read access to the sources behind a user's own lessons. |
| 15 | Public `app-releases` storage bucket for Android builds. |

## `web/` — landing page

A single static page with no build step, deployed to Vercel (Root Directory:
`web`). Contains `index.html`, the legal pages (`privacy.html`, `terms.html`,
`legal.css`), SEO and sharing files (`robots.txt`, `sitemap.xml`,
`site.webmanifest`, `llms.txt`, `og-image.png`), icons, and `vercel.json`
(security headers, clean URLs). See `web/README.md`.

## `webapp/` — the web app

The full app in the browser (sign in with email or Google, choose topics, Home,
reader, takeaways, Explore, Profile, sample mode). A separate Vite + React +
TypeScript project with its own `package.json`. **The phone app is not changed
by it and keeps working on its own.**

```
webapp/
├── src/
│   ├── App.tsx           Page shell, nav, who-may-see-what rules
│   ├── router.ts         Hash router (addresses look like /app/#/lesson/123)
│   ├── session.tsx       Sign-in state and data source (live or sample)
│   ├── ui.tsx            Buttons, cards, topic grid, loading/error states
│   ├── screens/          Welcome, Auth, Onboarding, Home, Lesson, Takeaways,
│   │                     Complete, Explore, Topics, Profile
│   ├── shims/            Browser versions of the two phone-only imports
│   └── styles.css        Light and dark mode, desktop and phone layouts
├── vite.config.ts        Shares the phone app's data code (see below)
└── .env.example          VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
```

**Shared with the phone app (read-only).** `src/data/*` (types, the Supabase
queries, sample lessons) and `src/lib/dates.ts` are imported straight from the
phone app, so both apps read and write the database through the *same* code.
Two phone-only imports are swapped for browser versions by a small Vite plugin
(`../lib/supabase` → `webapp/src/shims/supabase.ts`, and AsyncStorage →
`localStorage`). Fix a query once and both apps get the fix.

`npm run build` in `webapp/` (or `npm run web:build` from the root) writes the site
into `web/app/`, which **is committed** so the landing-page project can serve it
without a build step. Rebuild and commit it after changing the web app. The root
`vercel.json` lets a second Vercel project build it from source instead.

## `scripts/` — project tooling

| File | Purpose |
| --- | --- |
| `generate-icons.mjs` | Builds launcher icons and in-app logos from `public/` (`npm run icons`). |
| `generate-web-icons.mjs` | Builds the website's touch icons. |
| `og-image.html` | Source for the 1200×630 share card. |
| `publish-android-release.mjs` | Uploads an APK and `latest.json` (`npm run release:publish`). |
| `pod-install.js` | Runs CocoaPods after `npm install` on macOS. |

## `public/`, `docs/`, `ios/`, `android/`

- `public/` — master artwork (`LUMIO app icon.svg`, `LUMIO header logo.svg`).
- `docs/` — this documentation: `SETUP.md`, `STRUCTURE.md`, `RESOURCES.md`, `WORKFLOWS.md`.
- `ios/`, `android/` — native projects. Avoid hand-editing; Ship Studio builds
  them. The Android project holds the version (`app/build.gradle`) and the
  native updater module.

## Never committed

`.env` files, `node_modules/`, `android/keystore.properties`,
`android/app/lumio-release.keystore`, and build outputs are all gitignored.
Only the `.env.example` templates are committed.
