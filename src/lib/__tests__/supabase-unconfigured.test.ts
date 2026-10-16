import { isSupabaseConfigured } from '../env';
import { getSupabase } from '../supabase';

// No mock for `@env` here: the default jest moduleNameMapper stub stands in,
// which means "app not configured yet" — the state a fresh checkout is in.

describe('unconfigured app', () => {
  it('reports that Supabase is not configured', () => {
    expect(isSupabaseConfigured).toBe(false);
  });

  it('throws a helpful error instead of returning a broken client', () => {
    expect(() => getSupabase()).toThrow(/not configured/);
  });
});
