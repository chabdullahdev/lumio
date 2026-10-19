/**
 * Tiny hash router: addresses look like /app/#/lesson/123. Hash routes need no
 * special server setup, so the app works on any static host.
 */
import { useCallback, useEffect, useState } from 'react';
import type { CompletionSummary } from '@shared/data/types';

export type Route =
  | { name: 'welcome' }
  | { name: 'auth'; mode: 'signIn' | 'signUp' }
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'explore' }
  | { name: 'profile' }
  | { name: 'topics' }
  | { name: 'lesson'; id: string }
  | { name: 'takeaways'; id: string }
  | { name: 'complete'; id: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [first, second] = parts;
  switch (first) {
    case 'auth':
      return { name: 'auth', mode: second === 'signup' ? 'signUp' : 'signIn' };
    case 'onboarding':
      return { name: 'onboarding' };
    case 'home':
      return { name: 'home' };
    case 'explore':
      return { name: 'explore' };
    case 'profile':
      return { name: 'profile' };
    case 'topics':
      return { name: 'topics' };
    case 'lesson':
    case 'takeaways':
    case 'complete':
      return second ? { name: first, id: second } : { name: 'home' };
    default:
      return { name: 'welcome' };
  }
}

export function hashFor(route: Route): string {
  switch (route.name) {
    case 'welcome':
      return '#/';
    case 'auth':
      return route.mode === 'signUp' ? '#/auth/signup' : '#/auth/signin';
    case 'lesson':
    case 'takeaways':
    case 'complete':
      return `#/${route.name}/${encodeURIComponent(route.id)}`;
    default:
      return `#/${route.name}`;
  }
}

/** The completion summary is handed from the takeaways page to the next page. */
let lastSummary: { lessonId: string; summary: CompletionSummary } | null = null;
export function rememberSummary(lessonId: string, summary: CompletionSummary): void {
  lastSummary = { lessonId, summary };
}
export function recallSummary(lessonId: string): CompletionSummary | null {
  return lastSummary?.lessonId === lessonId ? lastSummary.summary : null;
}

export function useRoute(): [Route, (route: Route, replace?: boolean) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((next: Route, replace = false) => {
    const hash = hashFor(next);
    if (replace) {
      window.history.replaceState(null, '', hash);
      setRoute(next);
      window.scrollTo(0, 0);
    } else {
      window.location.hash = hash;
    }
  }, []);
  return [route, navigate];
}
