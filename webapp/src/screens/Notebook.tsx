import { useMemo, useState } from 'react';
import type { NotebookEntry } from '@shared/data/types';
import { useSession } from '../session';
import type { Route } from '../router';
import { Card, Empty, ErrorView, Loading, Muted, Pill, useLoad } from '../ui';

function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Keep the entries that mention the search text in the title, subject or any takeaway. */
export function filterNotebook(entries: NotebookEntry[], query: string): NotebookEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter(entry =>
    [entry.title, entry.categoryName ?? '', entry.reflection, ...entry.takeaways].some(text => text.toLowerCase().includes(needle)),
  );
}

export function Notebook({ go }: { go: (route: Route) => void }) {
  const { api } = useSession();
  const { data, error, reload } = useLoad(() => api.getNotebook(), [api]);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => (data ? filterNotebook(data, query) : []), [data, query]);

  if (error && !data) return <main className="page"><ErrorView message={error} onRetry={reload} /></main>;
  if (!data) return <main className="page"><Loading message="Opening your notebook…" /></main>;

  const takeawayCount = data.reduce((total, entry) => total + entry.takeaways.length, 0);
  return (
    <main className="page">
      <h1>Your notebook</h1>
      <Muted>Every idea you have kept, from every lesson you finished, plus any notes you wrote. LUMIO fills it for you.</Muted>
      {data.length === 0 ? (
        <Card>
          <Empty title="Your notebook is empty" message="Finish a lesson and its key takeaways are saved here, ready to revisit whenever you want." actionLabel="Go to today’s lesson" onAction={() => go({ name: 'home' })} />
        </Card>
      ) : (
        <>
          <p className="muted small">{takeawayCount} ideas from {data.length} lesson{data.length === 1 ? '' : 's'}</p>
          <label className="field">
            <span className="sr-only">Search your notebook</span>
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your ideas…" />
          </label>
          {shown.length === 0 ? <Muted>Nothing matches “{query.trim()}”.</Muted> : null}
          {shown.map(entry => (
            <Card key={entry.lessonId}>
              <div className="row spread">
                {entry.categoryName ? <Pill tone="accent">{entry.categoryName}</Pill> : <span />}
                <span className="muted small">{formatDay(entry.completedAt)}</span>
              </div>
              <h2 className="hero-title">{entry.title}</h2>
              <ol className="takeaways">
                {entry.takeaways.map((text, index) => (
                  <li key={index}><span className="num">{index + 1}</span><span>{text}</span></li>
                ))}
              </ol>
              {entry.reflection ? (
                <div className="my-note">
                  <span className="muted small">Your note</span>
                  <p>{entry.reflection}</p>
                </div>
              ) : null}
              <button className="link-plain small" onClick={() => go({ name: 'lesson', id: entry.lessonId })}>Read the lesson again</button>
            </Card>
          ))}
        </>
      )}
    </main>
  );
}
