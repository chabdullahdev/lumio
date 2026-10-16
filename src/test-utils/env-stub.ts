/**
 * Deterministic `@env` stand-in used by Jest (see jest.config.js
 * `moduleNameMapper`). By default it pretends the app is not configured, so
 * tests never depend on a developer's local `.env` file. Individual tests can
 * override it with `jest.mock('@env', () => ({ ... }))`.
 */
export const SUPABASE_URL: string | undefined = undefined;
export const SUPABASE_PUBLISHABLE_KEY: string | undefined = undefined;
