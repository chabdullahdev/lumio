# Security

## Reporting a problem

Please **do not** open a public issue for a security problem. Instead, use
GitHub's private reporting: the **Security** tab of this repository, then
**Report a vulnerability**. You will get a reply as soon as possible.

## What is safe to see in this repository

LUMIO's data is protected by Supabase Row Level Security, not by hiding the code.
This repository therefore contains things that are public by design:

- the database schema and security policies (`supabase/migrations/`);
- the project URL and the **publishable** key shown on the landing page and in
  the apps. Publishable keys only work within what Row Level Security allows.

## What must never be committed

- the Supabase **service-role / secret** key (only ever in `backend/.env`);
- `.env` files, the Android signing key (`android/app/lumio-release.keystore`,
  `android/keystore.properties`), or any other credential.

These are in `.gitignore`. If you ever commit one by mistake, treat it as leaked:
rotate it first, then remove it from the repository.

## Running your own copy

Create your own Supabase project, apply the migrations, and use your own keys.
Never point a fork at someone else's project.
