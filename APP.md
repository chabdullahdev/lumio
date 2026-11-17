# LUMIO

**Less scrolling. More understanding.**

LUMIO is an installable web app (PWA) that swaps your scroll for the world's best
ideas. One ~15 minute lesson a day, chosen for you from classic books in a
curated, rights-reviewed library, and every takeaway you finish is saved into
your own searchable **notebook**.

**Positioning (restarted November 2026):** "Swap your scroll for the world's best
ideas." The benefit to the reader is not just reading: they keep something. Each
session leaves them with ideas in a notebook they can search and revisit, with
sources they can trace, a streak that never nags, and nothing to choose or
install from a store.

**Delivery:** a PWA at `/app/` on the website. Android and desktop show an Install
button; iPhone uses Share, then Add to Home Screen. The old APK download and
in-app updater were removed.

## What the app does

- Users pick broad interests (for example Islam, history, politics, geopolitics, psychology, science).
- LUMIO's AI organizes the knowledge library into subjects, subcategories, and concepts.
- Three upcoming lessons are always prepared for each user; the home screen recommends the next one.
- Each lesson ends with 3–5 key takeaways. No quizzes or tests in v1.
- Reading consistency and daily streaks are tracked — encouraging, never guilt-driven.

## Who it is for

People who want to learn regularly but don't want to search for books, build a
curriculum, or feel bad about missing a day.

## Screens (built)

1. Welcome / sign in — email + password, or explore sample lessons
2. Onboarding — choose broad interests
3. Home — next recommended lesson, streak, upcoming lessons
4. Reader — block-by-block reading, progress saved as you go
5. Takeaways / completion — key takeaways, sources, completion summary
6. Explore — selected topics and their next available lessons
7. Notebook — every takeaway from finished lessons, searchable
8. Profile — interests, reading time, reminders, streak history, install prompt

The app has two data modes. **Sample mode** (bundled, clearly-labelled
placeholder lessons) runs when Supabase is not configured, so the whole flow
is usable without any backend. **Live mode** talks to Supabase with the
publishable key under Row Level Security; lesson generation happens in the
backend worker, never in the app.

## Brand

- Accent: `#54E36E` (calm green)
- Tagline: "Less scrolling. More understanding."
- Light and dark mode both supported.

## Technical summary

- **Web app (the product):** React + Vite in `webapp/`, installable PWA, shares the data layer in `src/data`.
- **Native projects:** bare React Native in `src/`, `ios/`, `android/` (kept for a possible store release; no APK distribution).
- **Backend workers:** Node.js + TypeScript in `backend/` — lesson generation, queue replenishment. Runs alongside the developer's machine; holds the service-role key.
- **Data:** Supabase (PostgreSQL + Storage). Schema lives in `supabase/migrations/`.
- **AI:** local Ollama models on the developer's machine, never exposed to the internet. The model only ever receives the extracts handed to it by the worker, and everything it returns is validated before storage.

## Getting started

Full instructions live in [docs/SETUP.md](docs/SETUP.md). Short version:

```bash
npm install                      # mobile app dependencies
copy .env.example .env           # then fill in Supabase URL + publishable key

cd backend
npm install
copy .env.example .env           # then fill in Supabase URL + service-role key
npm run check                    # validates the backend environment
npm run worker                   # generates lessons for onboarded users
```

## Checks

```bash
npm run typecheck                # mobile app typecheck
npm run lint                     # mobile app lint
npm test                         # mobile app tests

cd backend
npm run typecheck
npm test
npm run validate:migrations      # parses all SQL migrations with PostgreSQL's real parser
```
