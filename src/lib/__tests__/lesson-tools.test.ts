import { listenText, minutesFor, pickReviewCard, shortVersion } from '../lesson-tools';
import type { LessonBlock, NotebookEntry } from '../../data/types';

const blocks: LessonBlock[] = [
  { type: 'callout', kind: 'big_idea', text: 'In this lesson you will learn about power.' },
  { type: 'heading', text: 'One' },
  { type: 'paragraph', text: 'First of one.' },
  { type: 'paragraph', text: 'Second of one.' },
  { type: 'quote', text: 'A real line.', attribution: 'The Prince' },
  { type: 'heading', text: 'Two' },
  { type: 'paragraph', text: 'First of two.' },
  { type: 'paragraph', text: 'Second of two.' },
  { type: 'callout', kind: 'try_this', text: 'Notice one thing.' },
];

describe('shortVersion', () => {
  it('keeps headings, the first paragraph of each section and the extras', () => {
    const texts = shortVersion(blocks).map(b => b.text);
    expect(texts).toEqual([
      'In this lesson you will learn about power.',
      'One',
      'First of one.',
      'A real line.',
      'Two',
      'First of two.',
      'Notice one thing.',
    ]);
  });
  it('is never longer than the full lesson', () => {
    expect(minutesFor(shortVersion(blocks))).toBeLessThanOrEqual(minutesFor(blocks));
  });
});

describe('listenText', () => {
  it('starts with the title and introduces extras', () => {
    const parts = listenText('Title', blocks);
    expect(parts[0]).toBe('Title');
    expect(parts).toContain('A line from The Prince: A real line.');
    expect(parts).toContain('Try this. Notice one thing.');
  });
});

describe('pickReviewCard', () => {
  const entry = (id: string, completedAt: string, takeaways: string[]): NotebookEntry => ({
    lessonId: id,
    title: `Lesson ${id}`,
    categoryName: null,
    completedAt,
    takeaways,
    reflection: '',
  });

  it('returns null for an empty notebook', () => {
    expect(pickReviewCard([], '2026-11-20')).toBeNull();
  });
  it('is stable within a day and prefers older lessons', () => {
    const entries = [
      entry('a', '2026-11-10T08:00:00Z', ['x1', 'x2']),
      entry('b', '2026-11-20T08:00:00Z', ['today only']),
    ];
    const first = pickReviewCard(entries, '2026-11-20');
    expect(first).toEqual(pickReviewCard(entries, '2026-11-20'));
    expect(first?.lessonId).toBe('a');
  });
  it('falls back to today’s lessons when nothing is older', () => {
    const card = pickReviewCard([entry('b', '2026-11-20T08:00:00Z', ['only one'])], '2026-11-20');
    expect(card?.takeaway).toBe('only one');
  });
});
