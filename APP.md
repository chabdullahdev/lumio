# LUMIO

**Less scrolling. More understanding.**

LUMIO is an AI-powered personalized learning app for Android and iOS. It
replaces mindless scrolling with meaningful learning: short (~15 minute)
reading lessons chosen for each user from a curated, rights-reviewed
knowledge library.

## What the app does

- Users pick broad interests (for example Islam, history, politics, geopolitics, psychology, science).
- LUMIO's AI organizes the knowledge library into subjects, subcategories, and concepts.
- Three upcoming lessons are always prepared for each user; the home screen recommends the next one.
- Each lesson ends with 3–5 key takeaways. No quizzes or tests in v1.
- Reading consistency and daily streaks are tracked — encouraging, never guilt-driven.

## Who it is for

People who want to learn regularly but don't want to search for books, build a
curriculum, or feel bad about missing a day.

## Screens plan (built in later phases)

1. Welcome / sign in
2. Onboarding — choose broad interests
3. Home — next recommended lesson, streak, upcoming lessons
4. Reader — the lesson itself
5. Takeaways / completion — key takeaways and completion confirmation
6. Explore — selected topics and their next available lessons
7. Profile — interests, reading time, notifications, streak history

## Brand

- Accent: `#54E36E` (calm green)
- Tagline: "Less scrolling. More understanding."
- Light and dark mode both supported.

## Technical summary

- **Mobile app:** bare React Native + TypeScript (built and previewed by Ship Studio).
- **Backend workers:** Node.js + TypeScript in `backend/` — book ingestion, embeddings, concept extraction, lesson generation, queue replenishment.
- **Data:** Supabase (PostgreSQL + Storage). Schema lives in `supabase/migrations/`.
- **AI:** local Ollama models on the developer's machine, never exposed to the internet.

## Getting started

Full instructions live in [docs/SETUP.md](docs/SETUP.md). Short version:

```bash
npm install                      # mobile app dependencies
copy .env.example .env           # then fill in Supabase URL + publishable key

cd backend
npm install
copy .env.example .env           # then fill in Supabase URL + service-role key
npm run check                    # validates the backend environment
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
