/**
 * Google sign-in through Supabase Auth.
 *
 * Flow (PKCE, no Google SDK needed):
 *   1. Ask Supabase for the Google sign-in URL, with `lumio://auth/callback`
 *      as the place to come back to.
 *   2. Open that URL in the phone's browser; the user picks a Google account.
 *   3. Supabase sends the browser back to `lumio://auth/callback?code=...`,
 *      which the operating system hands to this app.
 *   4. Exchange the one-time code for a session.
 *
 * `lumio://auth/callback` must be listed under Authentication > URL
 * Configuration > Redirect URLs in the Supabase dashboard, otherwise Supabase
 * falls back to its Site URL and the app never receives the code.
 */
import { AppState, Linking } from 'react-native';
import { getSupabase } from './supabase';

export const OAUTH_REDIRECT = 'lumio://auth/callback';

/** How long to wait for the browser to hand control back before giving up. */
const WAIT_LIMIT_MS = 5 * 60 * 1000;
/** After the app returns to the foreground, how long the deep link may lag. */
const RETURN_GRACE_MS = 1500;

export type GoogleSignInResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; message: string };

export type AuthCallback = { code: string } | { error: string } | null;

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/** Read the code (or error) out of the redirect URL; null if it is not ours. */
export function parseAuthCallback(url: string): AuthCallback {
  if (!url.startsWith(OAUTH_REDIRECT)) {
    return null;
  }
  const params: Record<string, string> = {};
  const rest = url.slice(OAUTH_REDIRECT.length);
  // Supabase puts parameters in the query; error details can arrive in the fragment.
  for (const part of rest.split(/[?#&]/)) {
    const equals = part.indexOf('=');
    if (equals > 0) {
      params[decode(part.slice(0, equals))] = decode(part.slice(equals + 1));
    }
  }
  if (params.error || params.error_description) {
    return { error: params.error_description ?? params.error ?? 'Google sign-in failed.' };
  }
  return params.code ? { code: params.code } : { error: 'Google sign-in did not return a code.' };
}

type Waiter = { promise: Promise<string | null>; cancel: () => void };

/**
 * Wait for the redirect to arrive as a deep link. Resolves with the URL, or
 * with null if the user came back to the app without finishing (or took too long).
 */
function waitForRedirect(): Waiter {
  let finish: (url: string | null) => void = () => undefined;
  const promise = new Promise<string | null>(resolve => {
    let settled = false;
    let leftApp = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    const limitTimer = setTimeout(() => finish(null), WAIT_LIMIT_MS);

    const linkSubscription = Linking.addEventListener('url', event => {
      if (event.url.startsWith(OAUTH_REDIRECT)) {
        finish(event.url);
      }
    });
    const appSubscription = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        leftApp = true;
      } else if (state === 'active' && leftApp && graceTimer === null) {
        graceTimer = setTimeout(() => finish(null), RETURN_GRACE_MS);
      }
    });

    finish = url => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(limitTimer);
      if (graceTimer !== null) {
        clearTimeout(graceTimer);
      }
      linkSubscription.remove();
      appSubscription.remove();
      resolve(url);
    };
  });
  return { promise, cancel: () => finish(null) };
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: OAUTH_REDIRECT,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) {
    return { ok: false, message: error?.message ?? 'Could not start Google sign-in.' };
  }

  // Listen before leaving the app so a fast redirect cannot be missed.
  const waiter = waitForRedirect();
  try {
    await Linking.openURL(data.url);
  } catch {
    waiter.cancel();
    return { ok: false, message: 'Could not open the browser for Google sign-in.' };
  }

  const returnedUrl = await waiter.promise;
  if (!returnedUrl) {
    return { ok: false, cancelled: true, message: 'Google sign-in was cancelled.' };
  }
  const callback = parseAuthCallback(returnedUrl);
  if (!callback || 'error' in callback) {
    return { ok: false, message: callback?.error ?? 'Google sign-in failed.' };
  }
  const exchange = await supabase.auth.exchangeCodeForSession(callback.code);
  if (exchange.error) {
    return { ok: false, message: exchange.error.message };
  }
  return { ok: true };
}
