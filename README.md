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
| `App.tsx`, `src/` | The React Native app (screens, theme, Supabase client, config) |
| `__tests__/`, `src/**/__tests__/` | Jest tests |
| `backend/` | Node.js background workers (ingestion, embeddings, lesson generation) |
| `backend/scripts/` | Tooling, e.g. SQL migration validation |
| `supabase/migrations/` | Versioned PostgreSQL schema (applied and verified on the development project) |
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

Phase 1 (foundation) is in place: app shell with configuration + Supabase
client, backend environment tooling, and the database schema. All eight
migrations are **applied and verified** on the development Supabase project
(16 Oct 2026): RLS policies in place, private storage buckets created, no
high-risk advisor findings ([docs/SETUP.md](docs/SETUP.md) has the record).
Next: fill the `.env` files, then the auth and onboarding screens.
