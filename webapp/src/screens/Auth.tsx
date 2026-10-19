import { useState, type FormEvent } from 'react';
import { useSession } from '../session';
import type { Route } from '../router';
import { Button, Muted } from '../ui';

export function Auth({ mode, go }: { mode: 'signIn' | 'signUp'; go: (route: Route, replace?: boolean) => void }) {
  const { signIn, signUp, signInWithGoogle } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const isSignUp = mode === 'signUp';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = isSignUp ? await signUp(email, password) : await signIn(email, password);
      if (!result.ok) setError(result.message);
      else if (result.needsConfirmation) setConfirmationSent(true);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setGoogleBusy(true);
    setError(null);
    const result = await signInWithGoogle();
    if (!result.ok) {
      setError(result.message);
      setGoogleBusy(false);
    }
  };

  if (confirmationSent) {
    return (
      <main className="page narrow">
        <h1>Check your inbox</h1>
        <Muted>We sent a confirmation link to {email.trim()}. Open it, then come back and sign in.</Muted>
        <Button onClick={() => go({ name: 'auth', mode: 'signIn' }, true)}>Back to sign in</Button>
      </main>
    );
  }

  return (
    <main className="page narrow">
      <button className="link-back" onClick={() => go({ name: 'welcome' })}>‹ Back</button>
      <h1>{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
      <Muted>{isSignUp ? 'Your lessons, progress and streak are tied to your account.' : 'Sign in to continue your streak and lessons.'}</Muted>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required />
        </label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <Button type="submit" loading={busy} disabled={googleBusy}>{isSignUp ? 'Create account' : 'Sign in'}</Button>
        <Button type="button" variant="secondary" loading={googleBusy} disabled={busy} onClick={() => void google()}>Continue with Google</Button>
      </form>
      <button className="link-plain" onClick={() => go({ name: 'auth', mode: isSignUp ? 'signIn' : 'signUp' }, true)}>
        {isSignUp ? 'I already have an account' : "I don't have an account yet"}
      </button>
    </main>
  );
}
