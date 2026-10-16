import { isSecretKey, validateSupabaseEnv } from '../env';

// Pre-computed base64url payloads for JWTs used in tests.
const SERVICE_ROLE_JWT = `header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature`;
const ANON_JWT = `header.eyJyb2xlIjoiYW5vbiJ9.signature`;

describe('validateSupabaseEnv', () => {
  it('reports both missing variables when nothing is configured', () => {
    const result = validateSupabaseEnv({ url: undefined, publishableKey: undefined });

    expect(result.config).toBeNull();
    expect(result.problems).toHaveLength(2);
    expect(result.problems[0]).toMatch(/SUPABASE_URL is missing/);
    expect(result.problems[1]).toMatch(/SUPABASE_PUBLISHABLE_KEY is missing/);
  });

  it('accepts an https URL with a publishable key and trims whitespace', () => {
    const result = validateSupabaseEnv({
      url: '  https://demo-project.supabase.co  ',
      publishableKey: '  sb_publishable_demo123  ',
    });

    expect(result.problems).toEqual([]);
    expect(result.config).toEqual({
      url: 'https://demo-project.supabase.co',
      publishableKey: 'sb_publishable_demo123',
    });
  });

  it('rejects non-https URLs', () => {
    const result = validateSupabaseEnv({
      url: 'http://demo-project.supabase.co',
      publishableKey: 'sb_publishable_demo123',
    });

    expect(result.config).toBeNull();
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/https:\/\//);
  });

  it('rejects a new-format secret key', () => {
    const result = validateSupabaseEnv({
      url: 'https://demo-project.supabase.co',
      publishableKey: 'sb_secret_do_not_ship',
    });

    expect(result.config).toBeNull();
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/secret\/service-role/);
  });

  it('rejects a legacy service-role JWT', () => {
    const result = validateSupabaseEnv({
      url: 'https://demo-project.supabase.co',
      publishableKey: SERVICE_ROLE_JWT,
    });

    expect(result.config).toBeNull();
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatch(/secret\/service-role/);
  });

  it('accepts a legacy anon JWT', () => {
    const result = validateSupabaseEnv({
      url: 'https://demo-project.supabase.co',
      publishableKey: ANON_JWT,
    });

    expect(result.problems).toEqual([]);
    expect(result.config?.publishableKey).toBe(ANON_JWT);
  });
});

describe('isSecretKey', () => {
  it('flags sb_secret_ keys and service-role JWTs, but not publishable keys', () => {
    expect(isSecretKey('sb_secret_abc')).toBe(true);
    expect(isSecretKey(SERVICE_ROLE_JWT)).toBe(true);
    expect(isSecretKey('sb_publishable_abc')).toBe(false);
    expect(isSecretKey(ANON_JWT)).toBe(false);
    expect(isSecretKey('not-a-jwt')).toBe(false);
  });
});
