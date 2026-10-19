# Contributing to LUMIO

Thank you for helping. LUMIO turns scrolling time into short, source-grounded
reading lessons. The code is MIT-licensed (see [LICENSE](LICENSE) and
[NOTICE.md](NOTICE.md)).

## Ground rules

- **Accuracy and sources come first.** Lessons must be grounded in sources with
  an approved licence. Do not add text you do not have the right to use.
- **Public domain or openly licensed only** for the knowledge library.
- **No secrets in git.** Never commit `.env` files, keys or signing files.
- Be kind. Assume good intent.

## Getting set up

See [docs/SETUP.md](docs/SETUP.md) and [docs/WORKFLOWS.md](docs/WORKFLOWS.md).
The short version:

```bash
npm install                        # phone app
cd backend && npm install          # lesson worker and library tools
cd ../webapp && npm install        # web app
cd .. && npm run doctor            # tells you what is still missing
```

You need your own Supabase project for live mode. Without one, the apps run in
sample mode with placeholder lessons.

## Before you open a pull request

Run the checks for the parts you changed:

```bash
npm run typecheck && npm run lint && npm test                          # phone app
(cd backend && npm run typecheck && npm test)                           # backend
(cd webapp && npm run typecheck && npm test && npm run build)           # web app
```

Notes:
- The web app reuses `src/data` from the phone app. If you change it, run both
  apps' checks.
- Never edit a database migration that has been applied; add a new numbered one.
- Keep pull requests small and explain **why** the change is needed, not only
  what changed.

## Ideas that would help

- More public-domain books and better concept coverage.
- Translations and accessibility improvements.
- iOS release tooling.
- A hosted way to run the lesson worker.
