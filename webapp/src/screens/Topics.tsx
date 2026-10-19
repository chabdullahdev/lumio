import { useEffect, useState } from 'react';
import { useSession } from '../session';
import type { Route } from '../router';
import { Button, ErrorView, Loading, Muted, TopicGrid, useLoad } from '../ui';

export function Topics({ go }: { go: (route: Route) => void }) {
  const { api, useSample } = useSession();
  const { data, error, reload } = useLoad(() => Promise.all([api.getTopics(), api.getProfile()]), [api]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setSelected(data[1].interests.map(topic => topic.id));
  }, [data]);

  if (error) return <main className="page"><ErrorView message={error} onRetry={reload} /></main>;
  if (!data) return <main className="page"><Loading /></main>;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateInterests(selected);
      go({ name: 'explore' });
    } catch (failure) {
      setSaveError(failure instanceof Error ? failure.message : String(failure));
      setSaving(false);
    }
  };
  return (
    <main className="page">
      <button className="link-back" onClick={() => go({ name: 'explore' })}>‹ Back</button>
      <h1>Your topics</h1>
      <Muted>{useSample ? 'Sample mode: the sample library has one lesson per topic.' : 'New lessons for added topics arrive as the generator prepares them.'}</Muted>
      <TopicGrid
        topics={data[0]}
        selectedIds={selected}
        onToggle={id => { setSelected(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id])); setSaveError(null); }}
      />
      {saveError ? <p className="error" role="alert">{saveError}</p> : null}
      <div className="action-bar"><Button onClick={() => void save()} disabled={selected.length === 0} loading={saving}>Save topics</Button></div>
    </main>
  );
}
