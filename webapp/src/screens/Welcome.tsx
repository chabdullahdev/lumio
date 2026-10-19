import { useSession } from '../session';
import type { Route } from '../router';
import { Button, Logo } from '../ui';

const PROMISES = [
  { icon: '⏱️', text: '15-minute reading lessons that fit your day' },
  { icon: '🎯', text: 'Three lessons prepared ahead, chosen for your interests' },
  { icon: '🔍', text: 'Grounded in real sources you can trace' },
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
          <p className="muted small">Sample lessons are placeholders with real sources, shown while the lesson generator is being connected.</p>
        </div>
      ) : (
        <div className="stack">
          <Button onClick={() => void startSample()}>Get started</Button>
          <p className="muted small">Preview build: LUMIO is not connected to its backend yet, so it runs on a sample library (clearly labelled inside).</p>
        </div>
      )}
    </main>
  );
}
