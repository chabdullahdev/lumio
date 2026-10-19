import { recallSummary, type Route } from '../router';
import { Button, Card, Muted, Pill } from '../ui';

export function Complete({ id, go }: { id: string; go: (route: Route, replace?: boolean) => void }) {
  const summary = recallSummary(id);
  if (!summary) {
    // Opened directly (for example after a refresh): nothing to celebrate twice.
    return (
      <main className="page narrow">
        <h1>Lesson complete</h1>
        <Muted>Your progress is saved.</Muted>
        <Button onClick={() => go({ name: 'home' }, true)}>Back to home</Button>
      </main>
    );
  }
  const { streak, lessonsCompleted, nextLesson } = summary;
  const streakLine = streak.current <= 1 ? 'Streak started — come back tomorrow to keep it going.' : `${streak.current} days in a row. Nicely done.`;
  return (
    <main className="page narrow">
      <div className="check" aria-hidden="true">✓</div>
      <h1 className="center">Lesson complete</h1>
      <Muted className="center">{streakLine}</Muted>
      <Card>
        <div className="stats">
          <div><strong>{streak.current}</strong><span>current streak</span></div>
          <div><strong>{streak.longest}</strong><span>longest streak</span></div>
          <div><strong>{lessonsCompleted}</strong><span>lessons read</span></div>
        </div>
      </Card>
      <Card>
        <Pill tone="accent">Next up</Pill>
        {nextLesson ? (
          <>
            <h2 className="next-title">{nextLesson.title}</h2>
            <Muted>{nextLesson.categoryName ?? 'Lesson'} · {nextLesson.estimatedMinutes} min</Muted>
          </>
        ) : (
          <>
            <h2 className="next-title">Your next lesson is being prepared</h2>
            <Muted>It will appear on your home screen once it is ready.</Muted>
          </>
        )}
      </Card>
      <p className="muted small center">LUMIO is designed for a steady pace, not bingeing — one lesson a day is enough.</p>
      <div className="action-bar"><Button onClick={() => go({ name: 'home' }, true)}>Back to home</Button></div>
    </main>
  );
}
