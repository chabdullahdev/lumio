/**
 * Who is signed in, and which data source is used. Mirrors the phone app's
 * session logic (src/state/session.tsx): live mode against Supabase, or sample
 * mode with the bundled placeholder lessons.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sampleApi } from '@shared/data/sample-api';
import { supabaseApi } from '@shared/data/supabase-api';
import type { LumioApi } from '@shared/data/types';
import { getSupabase, isSupabaseConfigured } from './shims/supabase';

const SAMPLE_MODE_KEY = 'lumio.sampleMode.v1';

export type SessionStatus = 'loading' | 'signedOut' | 'needsOnboarding' | 'ready' | 'error';
export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; message: string };

export type SessionState = {
  status: SessionStatus;
  errorMessage: string | null;
  email: string | null;
  useSample: boolean;
  liveConfigured: boolean;
  api: LumioApi;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  enterSampleMode: () => Promise<void>;
  exitSampleMode: () => Promise<void>;
  markOnboarded: () => void;
  retry: () => void;
};

const SessionContext = createContext<SessionState | null>(null);

export function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (lower.includes('email not confirmed')) return 'Please confirm your email first — check your inbox for the confirmation link.';
  if (lower.includes('already registered')) return 'An account with this email already exists. Sign in instead.';
  if (lower.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  if (lower.includes('password')) return 'That password does not meet the requirements (at least 6 characters).';
  return message;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [bootKey, setBootKey] = useState(0);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [useSample, setUseSample] = useState(!isSupabaseConfigured);

  const evaluateProfile = useCallback(async (uid: string, userEmail: string | null) => {
    setEmail(userEmail);
    const { data, error } = await getSupabase().from('profiles').select('onboarding_completed_at').eq('id', uid).maybeSingle();
    if (error) {
      setStatus('error');
      setErrorMessage(`Could not load your profile: ${error.message}`);
      return;
    }
    setStatus(data && typeof data.onboarding_completed_at === 'string' ? 'ready' : 'needsOnboarding');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setStatus('loading');
      setErrorMessage(null);
      const sampleFlag = isSupabaseConfigured ? await AsyncStorage.getItem(SAMPLE_MODE_KEY) : '1';
      if (sampleFlag === '1') {
        const profile = await sampleApi.getProfile();
        if (!cancelled) {
          setUseSample(true);
          setStatus(profile.interests.length > 0 ? 'ready' : 'needsOnboarding');
        }
        return;
      }
      const { data, error } = await getSupabase().auth.getSession();
      if (cancelled) return;
      if (error) {
        setStatus('error');
        setErrorMessage(`Could not restore your session: ${error.message}`);
        return;
      }
      setUseSample(false);
      if (!data.session) {
        setStatus('signedOut');
        return;
      }
      await evaluateProfile(data.session.user.id, data.session.user.email ?? null);
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [bootKey, evaluateProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setEmail(null);
        setStatus('signedOut');
      } else if (event === 'SIGNED_IN' && session && !useSample) {
        // Deferred: Supabase advises against awaiting calls inside this callback.
        setTimeout(() => void evaluateProfile(session.user.id, session.user.email ?? null), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [evaluateProfile, useSample]);

  const signIn = useCallback(async (inputEmail: string, password: string): Promise<AuthResult> => {
    const value = inputEmail.trim();
    if (!value || !password) return { ok: false, message: 'Enter your email and password.' };
    const { data, error } = await getSupabase().auth.signInWithPassword({ email: value, password });
    if (error) return { ok: false, message: friendlyAuthError(error.message) };
    setUseSample(false);
    await AsyncStorage.removeItem(SAMPLE_MODE_KEY);
    if (data.user) await evaluateProfile(data.user.id, data.user.email ?? value);
    return { ok: true };
  }, [evaluateProfile]);

  const signUp = useCallback(async (inputEmail: string, password: string): Promise<AuthResult> => {
    const value = inputEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { ok: false, message: 'Enter a valid email address.' };
    if (password.length < 6) return { ok: false, message: 'Use a password with at least 6 characters.' };
    const { data, error } = await getSupabase().auth.signUp({
      email: value,
      password,
      options: { emailRedirectTo: `${window.location.origin}/app/` },
    });
    if (error) return { ok: false, message: friendlyAuthError(error.message) };
    setUseSample(false);
    await AsyncStorage.removeItem(SAMPLE_MODE_KEY);
    if (data.session && data.user) {
      await evaluateProfile(data.user.id, data.user.email ?? value);
      return { ok: true };
    }
    return { ok: true, needsConfirmation: true };
  }, [evaluateProfile]);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    await AsyncStorage.removeItem(SAMPLE_MODE_KEY);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/app/` },
    });
    // On success the browser leaves for Google and comes back signed in.
    return error ? { ok: false, message: error.message } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setEmail(null);
    setStatus('signedOut');
  }, []);

  const enterSampleMode = useCallback(async () => {
    await AsyncStorage.setItem(SAMPLE_MODE_KEY, '1');
    const profile = await sampleApi.getProfile();
    setUseSample(true);
    setEmail(null);
    setStatus(profile.interests.length > 0 ? 'ready' : 'needsOnboarding');
  }, []);

  const exitSampleMode = useCallback(async () => {
    await AsyncStorage.removeItem(SAMPLE_MODE_KEY);
    setBootKey(key => key + 1);
  }, []);

  const api = useSample || !isSupabaseConfigured ? sampleApi : supabaseApi;

  const value = useMemo<SessionState>(
    () => ({
      status,
      errorMessage,
      email,
      useSample,
      liveConfigured: isSupabaseConfigured,
      api,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      enterSampleMode,
      exitSampleMode,
      markOnboarded: () => setStatus('ready'),
      retry: () => setBootKey(key => key + 1),
    }),
    [status, errorMessage, email, useSample, api, signIn, signUp, signInWithGoogle, signOut, enterSampleMode, exitSampleMode],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
