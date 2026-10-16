/**
 * App environment configuration.
 *
 * Values come from a local `.env` file (never committed) via the
 * react-native-dotenv Babel plugin. This module validates them once at import
 * time and exposes either a ready-to-use config or a list of human-readable
 * problems, so the app can degrade gracefully when it is not configured yet.
 *
 * Security: only the Supabase project URL and publishable (anon) key belong
 * here. Service-role/secret keys must never be shipped in the mobile app; the
 * validator below rejects them.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@env';

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

export type SupabaseEnvInput = {
  url: string | undefined;
  publishableKey: string | undefined;
};

export type SupabaseEnvResult = {
  config: SupabaseConfig | null;
  problems: string[];
};

export function validateSupabaseEnv(input: SupabaseEnvInput): SupabaseEnvResult {
  const problems: string[] = [];
  const url = input.url?.trim() ?? '';
  const publishableKey = input.publishableKey?.trim() ?? '';

  if (!url) {
    problems.push('SUPABASE_URL is missing. Copy .env.example to .env and fill in your project URL.');
  } else if (!/^https:\/\/\S+$/.test(url)) {
    problems.push(
      'SUPABASE_URL must be an https:// URL, for example https://your-project-ref.supabase.co',
    );
  }

  if (!publishableKey) {
    problems.push(
      'SUPABASE_PUBLISHABLE_KEY is missing. Copy .env.example to .env and fill in your publishable (anon) key.',
    );
  } else if (isSecretKey(publishableKey)) {
    problems.push(
      'SUPABASE_PUBLISHABLE_KEY looks like a secret/service-role key. Never put secret keys in the mobile app — use the publishable (or legacy anon) key.',
    );
  }

  if (problems.length > 0) {
    return { config: null, problems };
  }

  return { config: { url, publishableKey }, problems };
}

/** Detect Supabase secret keys: new `sb_secret_...` format or legacy service-role JWTs. */
export function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) {
    return true;
  }
  const payload = decodeJwtPayload(key);
  return payload?.role === 'service_role';
}

function decodeJwtPayload(token: string): { role?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const atobFn = (globalThis as { atob?: (data: string) => string }).atob;
  if (!atobFn) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atobFn(padded)) as { role?: string };
  } catch {
    return null;
  }
}

const result = validateSupabaseEnv({
  url: SUPABASE_URL,
  publishableKey: SUPABASE_PUBLISHABLE_KEY,
});

/** Populated when both variables are present and valid; null otherwise. */
export const supabaseConfig = result.config;

/** Human-readable list of problems to show when configuration is incomplete. */
export const configProblems = result.problems;

export const isSupabaseConfigured = result.config !== null;
