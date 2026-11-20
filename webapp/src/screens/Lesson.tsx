import { useEffect, useMemo, useRef, useState } from 'react';
import type { LessonBlock, ReportReason } from '@shared/data/types';
import { listenText, minutesFor, shortVersion } from '@shared/lib/lesson-tools';
import { useSession } from '../session';
import type { Route } from '../router';
import { Button, ErrorView, Loading, Pill, useLoad } from '../ui';

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
  if (block.type === 'callout') {
    const label = block.kind === 'big_idea' ? 'The big idea' : block.kind === 'try_this' ? 'Try this today' : 'Think about it';
    return (
      <aside className={`l-callout l-callout-${block.kind}`}>
        <strong>{label}</strong>
        <p>{block.text}</p>
      </aside>
    );
  }
  return <p className="l-paragraph">{block.text}</p>;
}

const TEXT_SIZES = [1, 1.15, 1.3] as const;
const SIZE_KEY = 'lumio.textSize';

function readSize(): number {
  try {
    const stored = Number(localStorage.getItem(SIZE_KEY));
    return stored >= 0 && stored < TEXT_SIZES.length && Number.isInteger(stored) ? stored : 0;
  } catch {
    return 0;
  }
}

const REPORT_LABELS: Record<ReportReason, string> = {
  inaccurate: 'Something looks wrong or untrue',
  confusing: 'It is confusing',
  offensive: 'It is offensive',
  other: 'Something else',
};

function ReportProblem({ lessonId }: { lessonId: string }) {
  const { api } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('inaccurate');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  if (state === 'sent') return <p className="muted small">Thank you — we will take a look.</p>;
  if (!open) return <button className="link-plain small" onClick={() => setOpen(true)}>Report a problem with this lesson</button>;
  const send = async () => {
    setState('sending');
    try {
      await api.reportLesson(lessonId, reason, details);
      setState('sent');
    } catch {
      setState('failed');
    }
  };
  return (
    <div className="report">
      <label className="field">
        <span>What is the problem?</span>
        <select value={reason} onChange={e => setReason(e.target.value as ReportReason)}>
          {(Object.keys(REPORT_LABELS) as ReportReason[]).map(key => <option key={key} value={key}>{REPORT_LABELS[key]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Tell us more (optional)</span>
        <textarea rows={3} maxLength={1000} value={details} onChange={e => setDetails(e.target.value)} />
      </label>
      {state === 'failed' ? <p className="error" role="alert">Could not send. Please try again.</p> : null}
      <div className="row">
        <Button variant="secondary" loading={state === 'sending'} onClick={() => void send()}>Send report</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
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

  const [quick, setQuick] = useState(false);
  const [size, setSize] = useState(readSize);
  const [listening, setListening] = useState(false);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
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

  // Stop reading aloud when leaving the page or switching version.
  useEffect(() => () => { if (canSpeak) window.speechSynthesis.cancel(); }, [canSpeak]);
  useEffect(() => { if (canSpeak) { window.speechSynthesis.cancel(); setListening(false); } }, [quick, canSpeak]);

  const shown = useMemo(() => (lesson ? (quick ? shortVersion(lesson.blocks) : lesson.blocks) : []), [lesson, quick]);

  const toggleListen = () => {
    if (!lesson || !canSpeak) return;
    if (listening) {
      window.speechSynthesis.cancel();
      setListening(false);
      return;
    }
    const parts = listenText(lesson.title, shown);
    parts.forEach((text, index) => {
      const utterance = new SpeechSynthesisUtterance(text);
      if (index === parts.length - 1) utterance.onend = () => setListening(false);
      utterance.onerror = () => setListening(false);
      window.speechSynthesis.speak(utterance);
    });
    setListening(true);
  };
  const changeSize = () => {
    const next = (size + 1) % TEXT_SIZES.length;
    setSize(next);
    try { localStorage.setItem(SIZE_KEY, String(next)); } catch { /* the preference just is not remembered */ }
  };

  const back = <button className="link-back" onClick={() => go({ name: 'home' })}>‹ Back</button>;
  if (error) return <main className="page reader">{back}<ErrorView message={error} onRetry={reload} /></main>;
  if (!lesson) return <main className="page reader">{back}<Loading message="Opening lesson…" /></main>;

  const total = shown.length;
  const ratio = total > 0 ? Math.min(1, (furthest + 1) / total) : 0;
  const fullMinutes = lesson.estimatedMinutes;
  const minutes = quick ? Math.min(fullMinutes, minutesFor(shown)) : fullMinutes;
  const minutesLeft = Math.max(1, Math.round(minutes * (1 - ratio)));

  return (
    <>
      <div className="progress-top" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <main className="page reader" style={{ fontSize: `${TEXT_SIZES[size]}rem` }}>
        <div className="row spread">{back}<span className="muted">{minutesLeft} min left</span></div>
        <div className="reader-tools" role="group" aria-label="Reading options">
          <button className={`chip ${quick ? 'on' : ''}`} aria-pressed={quick} onClick={() => { setQuick(value => !value); furthestRef.current = 0; setFurthest(0); }}>
            {quick ? 'Full lesson' : 'Short version'}
          </button>
          {canSpeak ? <button className={`chip ${listening ? 'on' : ''}`} aria-pressed={listening} onClick={toggleListen}>{listening ? 'Stop listening' : 'Listen'}</button> : null}
          <button className="chip" onClick={changeSize} aria-label={`Text size, now ${['normal', 'large', 'largest'][size]}. Tap to change.`}>Aa</button>
        </div>
        <header className="l-title">
          {lesson.categoryName ? <Pill tone="accent">{lesson.categoryName}</Pill> : null}
          <h1>{lesson.title}</h1>
          {lesson.isSample ? <p className="muted small">Sample lesson</p> : null}
        </header>
        {shown.map((block, index) => (
          <div key={index} ref={node => { blockRefs.current[index] = node; }}>
            <Block block={block} />
          </div>
        ))}
        {lesson.isSample ? null : <ReportProblem lessonId={id} />}
        <div className="action-bar">
          <button className="btn btn-primary" onClick={() => go({ name: 'takeaways', id })}>I’ve finished — review takeaways</button>
        </div>
      </main>
    </>
  );
}
