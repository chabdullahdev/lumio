/**
 * Service-role Supabase client for background workers.
 *
 * Server side only: this client bypasses Row Level Security, so it must never
 * be imported by anything that ships to users. Queue/profile writes performed
 * by workers intentionally go through this client rather than user sessions.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadBackendEnv, type BackendConfig } from './env.ts';

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(config: BackendConfig = loadBackendEnv()): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}
