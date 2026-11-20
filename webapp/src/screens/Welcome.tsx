import { useSession } from '../session';
import type { Route } from '../router';
import { InstallCard } from '../pwa';
import { Button, Logo } from '../ui';

const PROMISES = [
  { icon: '🧭', text: 'No choosing, no curriculum: LUMIO picks today’s lesson for you' },
  { icon: '📓', text: 'A notebook that fills itself with every idea you keep' },
  { icon: '📖', text: 'Straight from classic books, with sources you can trace' },
  { icon: '🔥', text: 'A streak that encourages you and never nags' },
];

export function Welcome({ go }: { go: (route: Route) => void }) {
  const { liveConfigured, enterSampleMode } = useSession();
  const startSample = async () => {
    await enterSampleMode();
    go({ name: 'onboarding' });
  };
  return (
    <main className="page narrow hero-page">
      <Logo size={72} />
      <h1 className="brand-name">LUMIO</h1>
      <p className="tagline">Less scrolling. More understanding.</p>
      <p className="muted">The best books ever written, 15 minutes at a time. Swap one scroll session a day for one real idea you will still remember next week.</p>
      <ul className="promises">
        {PROMISES.map(item => (
          <li key={item.text}>
            <span aria-hidden="true">{item.icon}</span> {item.text}
          </li>
        ))}
      </ul>
      {liveConfigured ? (
        <div className="stack">
          <Button onClick={() => go({ name: 'auth', mode: 'signUp' })}>Create free account</Button>
          <Button variant="secondary" onClick={() => go({ name: 'auth', mode: 'signIn' })}>I already have an account</Button>
          <Button variant="ghost" onClick={() => void startSample()}>Explore sample lessons</Button>
          <p className="muted small">Sample lessons are a quick preview. Create a free account to get lessons chosen for you from the real library.</p>
        </div>
      ) : (
        <div className="stack">
          <Button onClick={() => void startSample()}>Get started</Button>
          <p className="muted small">Preview: you will see a small set of sample lessons, clearly labelled inside.</p>
        </div>
      )}
      <InstallCard />
    </main>
  );
}
