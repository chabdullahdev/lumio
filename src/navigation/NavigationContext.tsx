/**
 * Lightweight in-app navigation.
 *
 * LUMIO's screen flow is small and linear (welcome -> onboarding -> tabs ->
 * lesson -> takeaways -> complete), so a typed stack held in React state is
 * enough — no navigation dependency, no native rebuild.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CompletionSummary } from '../data/types';

export type MainTab = 'home' | 'explore' | 'profile';

export type Route =
  | { name: 'welcome' }
  | { name: 'auth'; mode: 'signIn' | 'signUp' }
  | { name: 'onboarding' }
  | { name: 'main'; tab: MainTab }
  | { name: 'topics' }
  | { name: 'lesson'; lessonId: string }
  | { name: 'takeaways'; lessonId: string }
  | { name: 'complete'; lessonId: string; summary: CompletionSummary };

export type NavigationState = {
  route: Route;
  canGoBack: boolean;
  push: (route: Route) => void;
  replace: (route: Route) => void;
  pop: () => void;
  /** Clear the stack back to the main tabs (used after finishing a lesson). */
  toMain: (tab?: MainTab) => void;
  setTab: (tab: MainTab) => void;
};

const NavigationContext = createContext<NavigationState | null>(null);

export function NavigationProvider({
  initial,
  children,
}: {
  initial: Route;
  children: React.ReactNode;
}) {
  const [stack, setStack] = useState<Route[]>([initial]);

  const push = useCallback((route: Route) => {
    setStack(current => [...current, route]);
  }, []);

  const replace = useCallback((route: Route) => {
    setStack(current => [...current.slice(0, -1), route]);
  }, []);

  const pop = useCallback(() => {
    setStack(current => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const toMain = useCallback((tab: MainTab = 'home') => {
    setStack([{ name: 'main', tab }]);
  }, []);

  const setTab = useCallback((tab: MainTab) => {
    setStack(current => {
      const last = current[current.length - 1];
      if (last?.name === 'main' && last.tab === tab) {
        return current;
      }
      return [current[0] ?? { name: 'main', tab }, { name: 'main', tab }];
    });
  }, []);

  const route = stack[stack.length - 1];

  const value = useMemo<NavigationState>(
    () => ({
      route,
      canGoBack: stack.length > 1,
      push,
      replace,
      pop,
      toMain,
      setTab,
    }),
    [route, stack.length, push, replace, pop, toMain, setTab],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationState {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used inside NavigationProvider');
  }
  return context;
}
