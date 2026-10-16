import assert from 'node:assert/strict';
import test from 'node:test';
import { PROMPT_VERSION, buildLessonPrompt } from '../src/lessons/prompt.ts';
import type { LessonPlan } from '../src/lessons/types.ts';

const plan: LessonPlan = {
  categoryId: 'cat-1',
  categoryName: 'Science',
  concepts: [
    { id: 'c-1', name: 'Photosynthesis', role: 'primary' },
    { id: 'c-2', name: 'Primary production', role: 'supporting' },
  ],
  passages: [
    {
      id: 1,
      content: 'Plants convert light into chemical energy.',
      words: 7,
      sourceId: 's-1',
      sourceTitle: 'Photosynthesis',
      authors: ['Wikipedia contributors'],
      publishedYear: null,
      licenseType: 'cc_by_sa',
      sourceUrl: 'https://en.wikipedia.org/wiki/Photosynthesis',
    },
  ],
  sourceWords: 7,
};

test('prompt embeds concepts, extracts, and the grounding rules', () => {
  const [system, user] = buildLessonPrompt(plan);

  assert.equal(PROMPT_VERSION, 'lesson-writer-v1');
  assert.equal(system?.role, 'system');
  assert.match(system?.content ?? '', /Use ONLY the information in the provided extracts/);
  assert.match(system?.content ?? '', /never invent/i);

  assert.equal(user?.role, 'user');
  const text = user?.content ?? '';
  assert.match(text, /Photosynthesis \(central to this lesson\)/);
  assert.match(text, /Primary production/);
  assert.match(text, /Subject area: Science\./);
  assert.match(text, /EXTRACT 1 \(Photosynthesis\)/);
  assert.match(text, /Plants convert light into chemical energy\./);
  assert.match(text, /concepts_covered/);
});
