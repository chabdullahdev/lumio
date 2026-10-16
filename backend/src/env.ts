/**
 * Backend environment configuration.
 *
 * The backend runs LUMIO's background workers on the developer's machine (and
 * later on a server). It needs the Supabase service-role key, which bypasses
 * Row Level Security and must therefore never leave the server side. This key
 * deliberately has no home in the mobile app.
 */
export type BackendConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  ollamaBaseUrl: string;
};

export type ParseBackendEnvResult =
  | { ok: true; config: BackendConfig; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1']);

/** Validate raw environment values. Pure — safe to unit test. */
export function parseBackendEnv(
  env: Record<string, string | undefined>,
): ParseBackendEnvResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const supabaseUrl = env.SUPABASE_URL?.trim() ?? '';
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  const ollamaBaseUrl = env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL;

  if (!supabaseUrl) {
    errors.push(
      'SUPABASE_URL is missing. Copy backend/.env.example to backend/.env and fill it in.',
    );
  } else if (!/^https:\/\/\S+$/.test(supabaseUrl)) {
    errors.push(`SUPABASE_URL must be an https:// URL (got "${supabaseUrl}").`);
  }

  if (!supabaseServiceRoleKey) {
    errors.push(
      'SUPABASE_SERVICE_ROLE_KEY is missing. Copy backend/.env.example to backend/.env and fill it in.',
    );
  } else if (isPublishableOrAnonKey(supabaseServiceRoleKey)) {
    errors.push(
      'SUPABASE_SERVICE_ROLE_KEY looks like a publishable/anon key. The backend requires the service-role (secret) key — the publishable key has no backend privileges.',
    );
  }

  if (!/^https?:\/\/\S+$/.test(ollamaBaseUrl)) {
    errors.push(`OLLAMA_BASE_URL must be an http(s):// URL (got "${ollamaBaseUrl}").`);
  } else if (!isLoopbackUrl(ollamaBaseUrl)) {
    warnings.push(
      `OLLAMA_BASE_URL points at "${ollamaBaseUrl}", which is not loopback (127.0.0.1/localhost). The local AI server must never be reachable from the public internet.`,
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }
  return { ok: true, config: { supabaseUrl, supabaseServiceRoleKey, ollamaBaseUrl }, warnings };
}

/** Load and validate `process.env`, throwing a readable error when invalid. */
export function loadBackendEnv(env: Record<string, string | undefined> = process.env): BackendConfig {
  const result = parseBackendEnv(env);
  if (!result.ok) {
    throw new Error(['Invalid backend environment:', ...result.errors.map(e => `- ${e}`)].join('\n'));
  }
  for (const warning of result.warnings) {
    console.warn(`warning: ${warning}`);
  }
  return result.config;
}

export function isPublishableOrAnonKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) {
    return true;
  }
  return decodeJwtPayload(key)?.role === 'anon';
}

function isLoopbackUrl(url: string): boolean {
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function decodeJwtPayload(token: string): { role?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded)) as { role?: string };
  } catch {
    return null;
  }
}
