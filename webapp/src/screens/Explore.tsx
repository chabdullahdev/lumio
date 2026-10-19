import { useSession } from '../session';
import type { Route } from '../router';
import { Card, ErrorView, Loading, Muted, Pill, SectionTitle, topicEmoji, useLoad } from '../ui';

export function Explore({ go }: { go: (route: Route) => void }) {
  const { api } = useSession();
  const { data, error, reload } = useLoad(() => Promise.all([api.getHome(), api.getProfile()]), [api]);
  if (error) return <main className="page"><ErrorView message={error} onRetry={reload} /></main>;
  if (!data) return <main className="page"><Loading /></main>;
  const [home, profile] = data;
  const items = [...(home.next ? [home.next] : []), ...home.upcoming];
  return (
    <main className="page">
      <h1>Explore</h1>
      <Muted>Everything LUMIO has prepared for you, and the subjects shaping it.</Muted>
      <SectionTitle>Your topics</SectionTitle>
      <div className="chips">
        {profile.interests.map(topic => <span key={topic.id} className="chip">{topicEmoji(topic)} {topic.name}</span>)}
      </div>
      <button className="link-plain" onClick={() => go({ name: 'topics' })}>Adjust your topics</button>
      <SectionTitle>In your queue</SectionTitle>
      {items.length === 0 ? (
        <Card>
          <h3>Nothing prepared right now</h3>
          <Muted>LUMIO keeps up to three lessons ready. New ones appear here as they are generated for your topics.</Muted>
        </Card>
      ) : (
        <div className="list">
          {items.map(item => (
            <button key={item.queueId ?? item.position} className="list-row" onClick={() => go({ name: 'lesson', id: item.lesson.id })}>
              <span className="grow">
                <strong>{item.lesson.title}</strong>
                <span className="muted block">{item.lesson.categoryName ?? 'Lesson'} · {item.lesson.estimatedMinutes} min</span>
              </span>
              {item.status === 'active' ? <Pill tone="accent">Reading</Pill> : null}
              <span aria-hidden="true" className="chev">›</span>
            </button>
          ))}
        </div>
      )}
      <SectionTitle>Reading history</SectionTitle>
      <Card>
        <p>
          {profile.lessonsCompleted === 0
            ? 'No lessons completed yet. Your first one is waiting on the home page.'
            : `${profile.lessonsCompleted} lesson${profile.lessonsCompleted === 1 ? '' : 's'} completed · ${profile.conceptsCovered} concepts covered`}
        </p>
        {profile.streak.lastCompletedOn ? <Muted>Last completed {profile.streak.lastCompletedOn}</Muted> : null}
      </Card>
    </main>
  );
}
