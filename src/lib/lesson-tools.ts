/**
 * Small, pure helpers for reading a lesson, shared by the phone app and the
 * web app: the 5-minute version, text for read-aloud, and the daily
 * "remember this?" card picked from the notebook.
 */
import type { LessonBlock, NotebookEntry } from '../data/types';

/**
 * A shorter read of the same lesson, built only from its own text: the big
 * idea, every heading with the first paragraph under it, the pull quote, and
 * the closing "try this" / reflection. Nothing is rewritten or invented.
 */
export function shortVersion(blocks: LessonBlock[]): LessonBlock[] {
  const out: LessonBlock[] = [];
  let paragraphsSinceHeading = 0;
  for (const block of blocks) {
    if (block.type === 'heading') {
      paragraphsSinceHeading = 0;
      out.push(block);
    } else if (block.type === 'paragraph') {
      if (paragraphsSinceHeading === 0) {
        out.push(block);
      }
      paragraphsSinceHeading += 1;
    } else {
      out.push(block); // quote or callout
    }
  }
  return out;
}

/** Plain text of the blocks, in order, for text-to-speech. */
export function listenText(title: string, blocks: LessonBlock[]): string[] {
  const parts: string[] = [title];
  for (const block of blocks) {
    if (block.type === 'callout') {
      const lead =
        block.kind === 'try_this' ? 'Try this. ' : block.kind === 'reflection' ? 'Something to think about. ' : '';
      parts.push(lead + block.text);
    } else if (block.type === 'quote') {
      parts.push(block.attribution ? `A line from ${block.attribution}: ${block.text}` : block.text);
    } else {
      parts.push(block.text);
    }
  }
  return parts;
}

/** Estimated minutes for the given blocks (~200 words a minute, at least 1). */
export function minutesFor(blocks: LessonBlock[]): number {
  const words = blocks.reduce((total, block) => total + block.text.trim().split(/\s+/).length, 0);
  return Math.max(1, Math.round(words / 200));
}

export type ReviewCard = { lessonId: string; lessonTitle: string; takeaway: string };

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) % 4294967291;
  }
  return value;
}

/**
 * One takeaway to bring back today. It is stable for the whole day (same card
 * on every visit) and changes tomorrow. Lessons finished today are skipped when
 * anything older exists, so the card is a real "do you still remember this?".
 */
export function pickReviewCard(entries: NotebookEntry[], today: string): ReviewCard | null {
  const older = entries.filter(entry => entry.completedAt.slice(0, 10) < today);
  const pool = (older.length > 0 ? older : entries).filter(entry => entry.takeaways.length > 0);
  if (pool.length === 0) {
    return null;
  }
  const seed = hash(today);
  const entry = pool[seed % pool.length];
  const takeaway = entry.takeaways[Math.floor(seed / pool.length) % entry.takeaways.length];
  return { lessonId: entry.lessonId, lessonTitle: entry.title, takeaway };
}
