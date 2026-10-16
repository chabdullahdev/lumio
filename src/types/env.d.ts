/**
 * Type declarations for environment variables inlined by the
 * react-native-dotenv Babel plugin (see babel.config.js).
 *
 * Values may be undefined: validation lives in src/lib/env.ts so the app can
 * render a helpful "not configured yet" state instead of failing to bundle.
 */
declare module '@env' {
  export const SUPABASE_URL: string | undefined;
  export const SUPABASE_PUBLISHABLE_KEY: string | undefined;
}
