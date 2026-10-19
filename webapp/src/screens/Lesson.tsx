import { useEffect, useRef, useState } from 'react';
import type { LessonBlock } from '@shared/data/types';
import { useSession } from '../session';
import type { Route } from '../router';
import { ErrorView, Loading, Pill, useLoad } from '../ui';

function Block({ block }: { block: LessonBlock }) {
  if (block.type === 'heading') return <h2 className="l-heading">{block.text}</h2>;
  if (block.type === 'quote') {
    return (
      <blockquote className="l-quote">
        <p>{block.text}</p>
        {block.attribution ? <cite>— {block.attribution}</cite> : null}
      </blockquote>
    );
  }
  return <p className="l-paragraph">{block.text}</p>;
}

export function Lesson({ id, go }: { id: string; go: (route: Route) => void }) {
  const { api } = useSession();
  const { data: lesson, error, reload } = useLoad(async () => {
    const [content] = await Promise.all([
      api.getLesson(id),
      // Opening must never block reading; progress saves will retry later.
      api.markOpened(id).catch(() => undefined),
    ]);
    return content;
  }, [api, id]);

  const [furthest, setFurthest] = useState(0);
  const furthestRef = useRef(0);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the furthest block scrolled past; save it (throttled) like the phone app.
  useEffect(() => {
    if (!lesson) return undefined;
    const onScroll = () => {
      const cutoff = window.scrollY + window.innerHeight * 0.8;
      let index = 0;
      blockRefs.current.forEach((node, i) => {
        if (node && node.offsetTop <= cutoff) index = i;
      });
      if (index > furthestRef.current) {
        furthestRef.current = index;
        setFurthest(index);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void api.saveProgress(id, index).catch(() => undefined), 1200);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [lesson, api, id]);

  const back = <button className="link-back" onClick={() => go({ name: 'home' })}>‹ Back</button>;
  if (error) return <main className="page reader">{back}<ErrorView message={error} onRetry={reload} /></main>;
  if (!lesson) return <main className="page reader">{back}<Loading message="Opening lesson…" /></main>;

  const total = lesson.blocks.length;
  const ratio = total > 0 ? (furthest + 1) / total : 0;
  const minutesLeft = Math.max(1, Math.round(lesson.estimatedMinutes * (1 - ratio)));

  return (
    <>
      <div className="progress-top" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <main className="page reader">
        <div className="row spread">{back}<span className="muted">{minutesLeft} min left</span></div>
        <header className="l-title">
          {lesson.categoryName ? <Pill tone="accent">{lesson.categoryName}</Pill> : null}
          <h1>{lesson.title}</h1>
          {lesson.isSample ? <p className="muted small">Sample lesson</p> : null}
        </header>
        {lesson.blocks.map((block, index) => (
          <div key={index} ref={node => { blockRefs.current[index] = node; }}>
            <Block block={block} />
          </div>
        ))}
        <div className="action-bar">
          <button className="btn btn-primary" onClick={() => go({ name: 'takeaways', id })}>I’ve finished — review takeaways</button>
        </div>
      </main>
    </>
  );
}
