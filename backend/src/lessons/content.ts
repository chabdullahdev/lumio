/**
 * Turns a validated lesson into the ordered blocks stored in `lessons.content`
 * and rendered by the reader:
 *
 *   big idea (callout) -> body -> pull quote -> "why this matters" -> try this -> reflection
 *
 * The pull quote goes after the first body paragraph so it breaks up the page.
 * Every extra is optional; a lesson without any is just its body.
 */
import type { GeneratedLesson } from './types.ts';

export type StoredBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string; attribution?: string }
  | { type: 'callout'; kind: 'big_idea' | 'try_this' | 'reflection'; text: string };

export function assembleContent(lesson: GeneratedLesson): StoredBlock[] {
  const { extras } = lesson;
  const out: StoredBlock[] = [];
  if (extras.bigIdea) {
    out.push({ type: 'callout', kind: 'big_idea', text: extras.bigIdea });
  }
  let quotePlaced = !extras.pullQuote;
  for (const block of lesson.blocks) {
    out.push({ type: block.type, text: block.text });
    if (!quotePlaced && block.type === 'paragraph' && extras.pullQuote) {
      out.push({ type: 'quote', text: extras.pullQuote.text, attribution: extras.pullQuote.source });
      quotePlaced = true;
    }
  }
  if (extras.whyItMatters) {
    out.push({ type: 'heading', text: 'Why this matters today' });
    out.push({ type: 'paragraph', text: extras.whyItMatters });
  }
  if (extras.tryThis) {
    out.push({ type: 'callout', kind: 'try_this', text: extras.tryThis });
  }
  if (extras.reflectionQuestion) {
    out.push({ type: 'callout', kind: 'reflection', text: extras.reflectionQuestion });
  }
  return out;
}
