jest.mock('@env', () => ({
  SUPABASE_URL: 'https://demo-project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key',
}));

import { isSupabaseConfigured, supabaseConfig } from '../env';
import { getSupabase } from '../supabase';

describe('configured app', () => {
  it('validates the environment', () => {
    expect(isSupabaseConfigured).toBe(true);
    expect(supabaseConfig?.url).toBe('https://demo-project.supabase.co');
  });

  it('creates a working Supabase client and reuses it', () => {
    const client = getSupabase();

    expect(typeof client.auth.getSession).toBe('function');
    expect(client.from).toBeDefined();
    expect(getSupabase()).toBe(client);
  });
});
