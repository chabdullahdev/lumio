/**
 * Supabase client for the mobile app.
 *
 * The client is created lazily so that merely importing this module never
 * touches native storage, and so the app can still boot when `.env` is not
 * configured yet (use `isSupabaseConfigured` from src/lib/env.ts to branch).
 *
 * Session state is persisted with AsyncStorage, which is the standard pattern
 * for bare React Native apps.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { configProblems, supabaseConfig } from './env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!supabaseConfig) {
      throw new Error(
        ['Supabase is not configured yet.', ...configProblems.map(problem => `- ${problem}`)].join('\n'),
      );
    }
    client = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
