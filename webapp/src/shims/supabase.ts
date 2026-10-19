/**
 * Browser Supabase client. Replaces src/lib/supabase.ts (phone) for the shared
 * data layer; same `getSupabase()` name and behaviour. Uses the public
 * (publishable) key only.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? '';

/** The same safety check the phone app does: never ship a secret key. */
export function looksLikeSecretKey(value: string): boolean {
  if (value.startsWith('sb_secret_')) {
    return true;
  }
  const parts = value.split('.');
  if (parts.length !== 3) {
    return false;
  }
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = /^https:\/\/\S+$/.test(url) && key.length > 0 && !looksLikeSecretKey(key);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }
  return client;
}
