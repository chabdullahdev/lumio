# LUMIO

**Less scrolling. More understanding.**

AI-powered personalized learning for Android and iOS: short, source-grounded
reading lessons selected for each user from a growing, rights-reviewed
knowledge library.

- Product overview, screens plan, and brand: [APP.md](APP.md)
- Full development setup: [docs/SETUP.md](docs/SETUP.md)

## Project layout

| Path | What it is |
| --- | --- |
| `App.tsx`, `src/` | The React Native app (screens, state, Supabase client, theme) |
| `__tests__/`, `src/**/__tests__/` | Jest tests |
| `backend/` | Node.js background workers (lesson generation, queue replenishment) |
| `backend/scripts/` | Tooling: migration validation, library seed generation, offline lesson preview |
| `supabase/migrations/` | Versioned PostgreSQL schema (applied and verified on the development project) |
| `supabase/seed/` | Frozen source snapshot behind the seeded library (CC BY-SA; see `docs/SETUP.md`) |
| `docs/` | Setup and architecture notes |
| `ios/`, `android/` | Native projects — managed by Ship Studio, avoid hand-editing |
| `agent.md` | Development working agreement |

## Quick start

```bash
npm install                      # mobile app dependencies
copy .env.example .env           # fill in Supabase URL + publishable key

cd backend
npm install
copy .env.example .env           # fill in Supabase URL + service-role key
npm run check                    # validates the backend environment
```

The app builds and previews inside Ship Studio; see [docs/SETUP.md](docs/SETUP.md)
for details, including how the database migrations were applied and verified.

## Checks

```bash
npm run typecheck                # mobile app typecheck
npm run lint                     # mobile app lint
npm test                         # mobile app tests (jest)

cd backend
npm run typecheck
npm test                         # node --test (TypeScript runs natively)
npm run validate:migrations      # parse all SQL migrations with PostgreSQL's real parser
```

## Status

The core journey is built end to end: welcome → sign in → interest onboarding →
home with three prepared lessons → reader with progress saving → takeaways →
completion (streak, activity, concepts, queue replenishment). The app runs in
**sample mode** (labelled placeholder lessons) until Supabase is configured,
then switches to **live mode** against the real database.

Database: migrations 01–14 are **applied and verified** on the development
Supabase project (16–17 Oct 2026), including the seeded starter library
(6 subjects, 7 rights-reviewed sources, 12 concepts, 69 passages) and the
server-side learning loop (completion trigger + durable job protocol). The
loop was exercised end to end: a real lesson was generated with local Ollama,
stored, read through RLS as a test user, completed, and the next generation
job was enqueued. Running the worker itself needs the service-role key in
`backend/.env` ([docs/SETUP.md](docs/SETUP.md) has the record and
instructions).
