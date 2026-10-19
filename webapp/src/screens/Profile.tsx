import { useEffect, useState } from 'react';
import { useSession } from '../session';
import type { Route } from '../router';
import { Button, Card, ErrorView, Loading, Muted, SectionTitle, topicEmoji, useLoad } from '../ui';

export function Profile({ go }: { go: (route: Route) => void }) {
  const { api, useSample, liveConfigured, email, signOut, exitSampleMode } = useSession();
  const { data: profile, error, reload } = useLoad(() => api.getProfile(), [api]);
  const [name, setName] = useState('');
  const [reminders, setReminders] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (profile) {
      setName(profile.displayName ?? '');
      setReminders(profile.remindersEnabled);
    }
  }, [profile]);

  if (error) return <main className="page"><ErrorView message={error} onRetry={reload} /></main>;
  if (!profile) return <main className="page"><Loading /></main>;

  const maxActivity = Math.max(1, ...profile.activity.map(day => day.lessons));
  const saveName = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updateSettings({ displayName: name.trim() || null });
      setMessage('Saved.');
      reload();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(false);
    }
  };
  const toggleReminders = async (value: boolean) => {
    setReminders(value);
    try {
      await api.updateSettings({ remindersEnabled: value });
    } catch (failure) {
      setReminders(!value);
      setMessage(failure instanceof Error ? failure.message : String(failure));
    }
  };

  return (
    <main className="page">
      <h1>You</h1>
      <Muted>{useSample ? 'Sample mode — progress is stored in this browser.' : email ?? 'Signed in'}</Muted>
      <Card>
        <div className="stats">
          <div><strong>{profile.streak.current}</strong><span>current streak</span></div>
          <div><strong>{profile.lessonsCompleted}</strong><span>lessons read</span></div>
          <div><strong>{profile.conceptsCovered}</strong><span>concepts covered</span></div>
        </div>
        <p className="muted small">Last 14 days</p>
        <div className="chart">
          {profile.activity.map(day => (
            <div
              key={day.date}
              title={`${day.date}: ${day.lessons} lesson${day.lessons === 1 ? '' : 's'}`}
              className={day.lessons > 0 ? 'bar on' : 'bar'}
              style={{ height: day.lessons > 0 ? 8 + (day.lessons / maxActivity) * 40 : 4 }}
            />
          ))}
        </div>
      </Card>

      <SectionTitle>Your topics</SectionTitle>
      <div className="chips">{profile.interests.map(topic => <span key={topic.id} className="chip">{topicEmoji(topic)} {topic.name}</span>)}</div>
      <button className="link-plain" onClick={() => go({ name: 'topics' })}>Edit topics</button>

      <SectionTitle>Settings</SectionTitle>
      <Card>
        <label className="field">
          <span>Display name</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="How should LUMIO greet you?" autoComplete="name" />
        </label>
        <Button variant="secondary" onClick={() => void saveName()} loading={saving}>Save name</Button>
        <label className="switch-row">
          <span>
            <strong>Streak reminders</strong>
            <span className="muted block">Encouragement only — LUMIO never uses guilt-driven notifications.</span>
          </span>
          <input type="checkbox" role="switch" checked={reminders} onChange={e => void toggleReminders(e.target.checked)} />
        </label>
        {message ? <p className="muted small" role="status">{message}</p> : null}
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card>
        <Muted>Time zone: {profile.timezone}</Muted>
        {!useSample ? (
          <Button variant="danger" onClick={() => void signOut()}>Sign out</Button>
        ) : liveConfigured ? (
          <Button variant="secondary" onClick={() => void exitSampleMode()}>Exit sample mode</Button>
        ) : (
          <Muted>Connect the Supabase backend to create a real account and generate real lessons.</Muted>
        )}
      </Card>
      <p className="muted small center">Less scrolling. More understanding.</p>
    </main>
  );
}
