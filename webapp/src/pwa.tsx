/**
 * Install-to-home-screen support (a Progressive Web App).
 *
 *  - Chrome / Edge / Android fire `beforeinstallprompt`; we keep the event and
 *    offer a real one-tap Install button.
 *  - iPhone / iPad Safari have no such event, so we show the manual steps.
 *  - Once installed (standalone display) the prompt disappears for good.
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Card } from './ui';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

export function isIos(userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /iphone|ipad|ipod/i.test(userAgent);
}

const DISMISS_KEY = 'lumio.install.dismissed';

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function useInstall() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(wasDismissed);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setEvent(null);
  }, [event]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: the card simply comes back next visit */
    }
  }, []);

  const canPrompt = event !== null;
  const showIosSteps = isIos() && !installed;
  return { installed, canPrompt, showIosSteps, dismissed, install, dismiss };
}

/** A friendly "add LUMIO to your home screen" card. Renders nothing when not useful. */
export function InstallCard({ allowDismiss = true }: { allowDismiss?: boolean }) {
  const { installed, canPrompt, showIosSteps, dismissed, install, dismiss } = useInstall();
  if (installed || (dismissed && allowDismiss) || (!canPrompt && !showIosSteps)) return null;
  return (
    <Card className="install-card">
      <strong>Install LUMIO on your phone</strong>
      {canPrompt ? (
        <>
          <p className="muted">One tap puts LUMIO on your home screen. It opens full screen, like any app — no app store, no download file.</p>
          <Button onClick={() => void install()}>Install LUMIO</Button>
        </>
      ) : (
        <p className="muted">In Safari tap the Share button, then <strong>Add to Home Screen</strong>. LUMIO then opens full screen, like any app.</p>
      )}
      {allowDismiss ? <Button variant="ghost" onClick={dismiss}>Not now</Button> : null}
    </Card>
  );
}

/** Registers the offline service worker (production only) and reports connectivity. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      /* offline support is a bonus; the app works without it */
    });
  });
}

export function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online ? null : <div className="offline-banner" role="status">You’re offline. Lessons you already opened may still work.</div>;
}
