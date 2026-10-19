# Notices

## Code

The LUMIO source code is released under the [MIT License](LICENSE).

## Content that is not under the MIT License

Some files hold third-party *text*, which keeps its own licence:

| Where | What | Licence |
| --- | --- | --- |
| `supabase/seed/wikipedia-extracts.json` and `supabase/migrations/20261017090200_11_seed_library.sql` | Short extracts of seven Wikipedia articles used as starter lessons | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Credit: Wikipedia contributors. If you reuse these extracts you must keep the credit and share them under the same licence. |
| Sample lessons in `src/data/sample-lessons.ts` | Placeholder lessons that cite OpenStax and Wikipedia | Each cites its source and licence (CC BY 4.0, CC BY-SA 4.0). |
| Books downloaded by the library tools | Public-domain books from Project Gutenberg | Public domain in the USA. The books themselves are **not** stored in this repository; the tools download them when you run them. |

The lesson tools only ever use sources that have an approved licensing record in
the database. If you add your own sources, record their licence the same way.

## Name and logo

"LUMIO", its logo and its app icon are this project's branding. The code is free
to use, fork and adapt, but if you publish your own app based on it, please give
it your own name and logo so people do not confuse it with the original.

## Third-party software

LUMIO depends on open-source packages (React, React Native, Supabase's JavaScript
client, Vite and others), each under its own licence. See `package-lock.json`
in each folder.
