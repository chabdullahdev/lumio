/** Small shared building blocks. Styling lives in styles.css. */
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Topic } from '@shared/data/types';

const BASE = import.meta.env.BASE_URL;

export function Logo({ size = 32 }: { size?: number }) {
  return <img src={`${BASE}logo.svg`} width={size} height={size} alt="" className="logo" />;
}

export function Button({
  variant = 'primary',
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  return (
    <button {...rest} className={`btn btn-${variant} ${rest.className ?? ''}`} disabled={rest.disabled || loading}>
      {loading ? 'Please wait…' : children}
    </button>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warning' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Muted({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`muted ${className}`}>{children}</p>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>;
}

export function Loading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="center-state" role="status">
      <div className="spinner" aria-hidden="true" />
      <p className="muted">{message}</p>
    </div>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="center-state" role="alert">
      <h2>Something went wrong</h2>
      <p className="muted">{message}</p>
      {onRetry ? <Button variant="secondary" onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}

export function Empty({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p className="muted">{message}</p>
      {actionLabel && onAction ? <Button variant="secondary" onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  );
}

const TOPIC_EMOJI: Record<string, string> = {
  science: '🔬',
  history: '🏛️',
  psychology: '🧠',
  islam: '🕌',
  geopolitics: '🌍',
  politics: '⚖️',
};

export function topicEmoji(topic: Topic): string {
  return (topic.slug && TOPIC_EMOJI[topic.slug]) || '📚';
}

export function TopicGrid({ topics, selectedIds, onToggle }: { topics: Topic[]; selectedIds: string[]; onToggle: (id: string) => void }) {
  const selected = new Set(selectedIds);
  return (
    <div className="topic-grid">
      {topics.map(topic => {
        const on = selected.has(topic.id);
        return (
          <button key={topic.id} type="button" role="checkbox" aria-checked={on} className={`topic ${on ? 'topic-on' : ''}`} onClick={() => onToggle(topic.id)}>
            <span className="topic-emoji" aria-hidden="true">{topicEmoji(topic)}</span>
            <span className="topic-name">{topic.name}</span>
            {topic.description ? <span className="topic-desc">{topic.description}</span> : null}
            <span className="topic-check" aria-hidden="true">{on ? '✓' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Load data once (and again on demand) with the loading/error states every page needs. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    load().then(
      value => {
        if (!cancelled) setData(value);
      },
      failure => {
        if (!cancelled) setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: () => setTick(value => value + 1) };
}
