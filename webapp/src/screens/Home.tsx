import type { HomeSnapshot, QueueItem } from '@shared/data/types';
import { useSession } from '../session';
import type { Route } from '../router';
import { Button, Card, Empty, ErrorView, Loading, Logo, Muted, Pill, SectionTitle, useLoad } from '../ui';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function streakLabel(streak: HomeSnapshot['streak']): string {
  return streak.current <= 0 ? 'No streak yet' : `${streak.current}-day streak 🔥`;
}

export function Home({ go }: { go: (route: Route) => void }) {
  const { api, useSample } = useSession();
  const { data, error, reload } = useLoad(() => Promise.all([api.getHome(), api.getProfile()]), [api]);

  if (error && !data) return <main className="page"><ErrorView message={error} onRetry={reload} /></main>;
  if (!data) return <main className="page"><Loading message="Preparing your lessons…" /></main>;
  const [home, profile] = data;
  const firstName = profile.displayName?.trim().split(/\s+/)[0];

  return (
    <main className="page">
      <header className="home-header">
        <div className="row">
          <Logo size={34} />
          <div>
            <Muted>{greeting()}</Muted>
            <h1 className="home-name">{firstName ?? 'Welcome back'}</h1>
          </div>
        </div>
        <Pill tone={home.streak.current > 0 ? 'accent' : 'neutral'}>{streakLabel(home.streak)}</Pill>
      </header>

      {home.next ? (
        <Card className="hero-card">
          <div className="row spread">
            <Pill tone="accent">{home.next.lesson.categoryName ?? 'Lesson'}</Pill>
            <span className="muted">{home.next.lesson.estimatedMinutes} min read</span>
          </div>
          <h2 className="hero-title">{home.next.lesson.title}</h2>
          {home.next.lesson.summary ? <p className="hero-summary">{home.next.lesson.summary}</p> : null}
          <Button onClick={() => go({ name: 'lesson', id: home.next!.lesson.id })}>Start lesson</Button>
          {home.next.lesson.isSample ? <p className="muted small">Sample lesson</p> : null}
        </Card>
      ) : home.sampleLibraryExhausted ? (
        <Card>
          <Empty title="You finished the sample library" message="Every sample lesson is complete. Real lessons come from the generation pipeline — connect the backend and they will arrive in your queue." actionLabel="Review your topics" onAction={() => go({ name: 'topics' })} />
        </Card>
      ) : (
        <Card>
          <Empty
            title="Your next lessons are being prepared"
            message={useSample ? 'Sample lessons will appear here shortly.' : 'LUMIO is generating lessons from your topics. This usually takes a couple of minutes.'}
            actionLabel="Check again"
            onAction={reload}
          />
        </Card>
      )}

      {home.upcoming.length > 0 ? (
        <>
          <SectionTitle>Upcoming lessons</SectionTitle>
          <div className="list">
            {home.upcoming.map((item: QueueItem) => (
              <button key={item.queueId ?? item.position} className="list-row" onClick={() => go({ name: 'lesson', id: item.lesson.id })}>
                <span className="num">{item.position}</span>
                <span className="grow">
                  <strong>{item.lesson.title}</strong>
                  <span className="muted block">{item.lesson.categoryName ?? 'Lesson'} · {item.lesson.estimatedMinutes} min</span>
                </span>
                <span aria-hidden="true" className="chev">›</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <SectionTitle>Your progress</SectionTitle>
      <Card>
        <div className="stats">
          <div><strong>{home.lessonsCompleted}</strong><span>lessons read</span></div>
          <div><strong>{home.streak.longest}</strong><span>longest streak</span></div>
          <div><strong>{profile.conceptsCovered}</strong><span>concepts covered</span></div>
        </div>
      </Card>

      {useSample ? (
        <p className="sample-note"><Pill tone="warning">Sample library</Pill> <span className="muted">These lessons are placeholders with real source references. Progress made here is local to this browser.</span></p>
      ) : null}
    </main>
  );
}
