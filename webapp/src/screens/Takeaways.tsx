import { useState } from 'react';
import type { LessonSourceRef } from '@shared/data/types';
import { useSession } from '../session';
import { rememberSummary, type Route } from '../router';
import { Button, Card, ErrorView, Loading, Muted, Pill, SectionTitle, useLoad } from '../ui';

const USAGE_LABELS: Record<LessonSourceRef['usage'], string> = {
  direct_quote: 'Direct quote',
  paraphrase: 'Paraphrased from',
  synthesis: 'Synthesised from',
};

function SourceRow({ source }: { source: LessonSourceRef }) {
  return (
    <Card className="source">
      <div className="row spread">
        <Pill>{USAGE_LABELS[source.usage]}</Pill>
        {source.pageLabel ? <span className="muted">{source.pageLabel}</span> : null}
      </div>
      <h3>{source.title}</h3>
      {source.authorLine ? <Muted>{source.authorLine}</Muted> : null}
      {source.quote ? <p className="source-quote">{source.quote}</p> : null}
      <div className="row spread">
        {source.licenseLabel ? <span className="license">{source.licenseLabel}</span> : <span />}
        {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">Open source ↗</a> : null}
      </div>
    </Card>
  );
}

export function Takeaways({ id, go }: { id: string; go: (route: Route, replace?: boolean) => void }) {
  const { api } = useSession();
  const { data: lesson, error, reload } = useLoad(() => api.getLesson(id), [api, id]);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  if (error) return <main className="page reader"><ErrorView message={error} onRetry={reload} /></main>;
  if (!lesson) return <main className="page reader"><Loading message="Collecting takeaways…" /></main>;

  const finish = async () => {
    setFinishing(true);
    setFinishError(null);
    try {
      const summary = await api.completeLesson(lesson.id);
      rememberSummary(lesson.id, summary);
      go({ name: 'complete', id: lesson.id }, true);
    } catch (failure) {
      setFinishError(failure instanceof Error ? failure.message : String(failure));
      setFinishing(false);
    }
  };

  return (
    <main className="page reader">
      <button className="link-back" onClick={() => go({ name: 'lesson', id })}>‹ Back to the lesson</button>
      <p className="eyebrow">Lesson complete when you’re ready</p>
      <h1>{lesson.title}</h1>
      <SectionTitle>Key takeaways</SectionTitle>
      <ol className="takeaways">
        {lesson.takeaways.map((text, index) => (
          <li key={index}><span className="num">{index + 1}</span><span>{text}</span></li>
        ))}
      </ol>
      <SectionTitle>Sources</SectionTitle>
      <Muted>Every lesson is grounded in the sources below. If a lesson ever seems to drift from them, tell us — accuracy comes before everything else.</Muted>
      {lesson.sources.map(source => <SourceRow key={source.id} source={source} />)}
      {lesson.isSample ? <p className="muted small">Sample lesson — replaces real generated lessons until the pipeline is connected.</p> : null}
      {finishError ? <p className="error" role="alert">{finishError}</p> : null}
      <div className="action-bar"><Button onClick={() => void finish()} loading={finishing}>Finish lesson</Button></div>
    </main>
  );
}
