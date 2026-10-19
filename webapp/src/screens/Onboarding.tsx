import { useState } from 'react';
import { useSession } from '../session';
import { Button, ErrorView, Loading, Muted, TopicGrid, useLoad } from '../ui';

export function Onboarding() {
  const { api, markOnboarded } = useSession();
  const { data: topics, error, reload } = useLoad(() => api.getTopics(), [api]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (error) return <main className="page narrow"><ErrorView message={error} onRetry={reload} /></main>;
  if (!topics) return <main className="page narrow"><Loading message="Loading topics…" /></main>;
  if (topics.length === 0) {
    return <main className="page narrow"><ErrorView message="No approved topics are available yet. The knowledge library needs to be seeded before onboarding can continue." onRetry={reload} /></main>;
  }

  const minimum = topics.length >= 3 ? 3 : 1;
  const enough = selected.length >= minimum;
  const toggle = (id: string) => {
    setSelected(current => (current.includes(id) ? current.filter(x => x !== id) : [...current, id]));
    setSaveError(null);
  };
  const submit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await api.completeOnboarding(selected);
      markOnboarded();
    } catch (failure) {
      setSaveError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page">
      <h1>What do you want to learn about?</h1>
      <Muted>Pick at least {minimum} subjects. LUMIO prepares your lessons from these and adjusts as you read — you can change them any time.</Muted>
      <TopicGrid topics={topics} selectedIds={selected} onToggle={toggle} />
      <p className="muted counter">{selected.length === 0 ? 'Nothing selected yet' : `${selected.length} selected`}</p>
      {saveError ? <p className="error" role="alert">{saveError}</p> : null}
      <div className="action-bar">
        <Button onClick={() => void submit()} disabled={!enough} loading={saving}>{enough ? 'Start learning' : `Choose at least ${minimum}`}</Button>
      </div>
    </main>
  );
}
