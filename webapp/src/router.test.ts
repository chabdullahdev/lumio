import { describe, expect, it } from 'vitest';
import { hashFor, parseHash } from './router';
import { effectiveRoute } from './App';

describe('router', () => {
  it('reads and writes the same addresses', () => {
    for (const hash of ['#/', '#/home', '#/explore', '#/profile', '#/topics', '#/onboarding', '#/auth/signin', '#/auth/signup', '#/lesson/abc-123', '#/takeaways/x', '#/complete/y']) {
      expect(hashFor(parseHash(hash))).toBe(hash);
    }
  });
  it('falls back safely on junk', () => {
    expect(parseHash('')).toEqual({ name: 'welcome' });
    expect(parseHash('#/nope/1')).toEqual({ name: 'welcome' });
    expect(parseHash('#/lesson')).toEqual({ name: 'home' });
  });
  it('decodes ids with special characters', () => {
    expect(parseHash('#/lesson/a%2Fb')).toEqual({ name: 'lesson', id: 'a/b' });
  });
});

describe('who may see which page', () => {
  it('sends signed-out visitors to the welcome page', () => {
    expect(effectiveRoute('signedOut', { name: 'home' })).toEqual({ name: 'welcome' });
    expect(effectiveRoute('signedOut', { name: 'auth', mode: 'signUp' })).toEqual({ name: 'auth', mode: 'signUp' });
  });
  it('forces onboarding until it is done', () => {
    expect(effectiveRoute('needsOnboarding', { name: 'lesson', id: '1' })).toEqual({ name: 'onboarding' });
  });
  it('keeps signed-in users out of the welcome and sign-in pages', () => {
    expect(effectiveRoute('ready', { name: 'welcome' })).toEqual({ name: 'home' });
    expect(effectiveRoute('ready', { name: 'lesson', id: '1' })).toEqual({ name: 'lesson', id: '1' });
  });
});
