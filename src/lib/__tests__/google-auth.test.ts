/* eslint-env jest */
import { OAUTH_REDIRECT, parseAuthCallback } from '../google-auth';

describe('parseAuthCallback', () => {
  it('returns the code from the query', () => {
    expect(parseAuthCallback(`${OAUTH_REDIRECT}?code=abc-123`)).toEqual({ code: 'abc-123' });
  });

  it('ignores URLs that are not the sign-in redirect', () => {
    expect(parseAuthCallback('lumio://lesson/42?code=abc')).toBeNull();
    expect(parseAuthCallback('https://example.com/?code=abc')).toBeNull();
  });

  it('reports an error from the query or the fragment', () => {
    expect(
      parseAuthCallback(`${OAUTH_REDIRECT}?error=access_denied&error_description=User+cancelled`),
    ).toEqual({ error: 'User cancelled' });
    expect(parseAuthCallback(`${OAUTH_REDIRECT}#error=server_error`)).toEqual({
      error: 'server_error',
    });
  });

  it('reports a missing code', () => {
    expect(parseAuthCallback(OAUTH_REDIRECT)).toEqual({
      error: 'Google sign-in did not return a code.',
    });
  });
});
