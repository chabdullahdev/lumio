import { describe, expect, it } from 'vitest';
import type { NotebookEntry } from '@shared/data/types';
import { filterNotebook } from './screens/Notebook';
import { isIos } from './pwa';

const entries: NotebookEntry[] = [
  { lessonId: '1', title: 'The plague of Athens', categoryName: 'History', completedAt: '2026-11-01T10:00:00Z', takeaways: ['Crowding spreads disease'] },
  { lessonId: '2', title: 'Natural selection', categoryName: 'Science', completedAt: '2026-11-02T10:00:00Z', takeaways: ['Small variations add up'] },
];

describe('notebook search', () => {
  it('returns everything for an empty search', () => {
    expect(filterNotebook(entries, '  ')).toHaveLength(2);
  });
  it('matches titles, subjects and takeaways without caring about case', () => {
    expect(filterNotebook(entries, 'ATHENS').map(e => e.lessonId)).toEqual(['1']);
    expect(filterNotebook(entries, 'science').map(e => e.lessonId)).toEqual(['2']);
    expect(filterNotebook(entries, 'variations').map(e => e.lessonId)).toEqual(['2']);
    expect(filterNotebook(entries, 'nothing like this')).toEqual([]);
  });
});

describe('install help', () => {
  it('spots iPhone and iPad but not Android', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIos('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(false);
  });
});
