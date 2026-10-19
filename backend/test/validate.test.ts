import assert from 'node:assert/strict';
import test from 'node:test';
import { extractJsonObject, repairLessonShape, validateGeneratedLesson } from '../src/lessons/validate.ts';
import type { LessonPlan } from '../src/lessons/types.ts';

const plan: LessonPlan = {
  categoryId: 'cat-1',
  categoryName: 'Science',
  concepts: [
    { id: 'c-1', name: 'Photosynthesis', role: 'primary' },
    { id: 'c-2', name: 'Primary production', role: 'supporting' },
  ],
  passages: [],
  sourceWords: 0,
};

function paragraph(sentence: string, words: number): string {
  return `${sentence} ${Array.from({ length: words }, (_, i) => `w${i}`).join(' ')}`.trim();
}

function validLesson(): Record<string, unknown> {
  return {
    title: 'How plants make food',
    summary: 'An introduction to photosynthesis.',
    blocks: [
      { type: 'heading', text: 'Light into sugar' },
      ...Array.from({ length: 7 }, (_, i) => ({
        type: 'paragraph',
        text: paragraph(`Section ${i}.`, 100),
      })),
    ],
    takeaways: ['Plants convert light into chemical energy.', 'Chlorophyll absorbs light.', 'Oxygen is a by-product.'],
    concepts_covered: ['Photosynthesis', 'primary production'],
  };
}

test('extractJsonObject handles plain, fenced, and surrounded JSON', () => {
  const plain = '{"a":1}';
  const fenced = '```json\n{"a":1}\n```';
  const surrounded = 'Sure! Here you go:\n{"a":1}\nHope that helps.';

  assert.deepEqual(extractJsonObject(plain), { a: 1 });
  assert.deepEqual(extractJsonObject(fenced), { a: 1 });
  assert.deepEqual(extractJsonObject(surrounded), { a: 1 });
  assert.equal(extractJsonObject('not json at all'), null);
  assert.equal(extractJsonObject('[1,2,3]'), null);
});

test('accepts a well-formed lesson and normalizes concept names', () => {
  const result = validateGeneratedLesson(validLesson(), plan);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.lesson.title, 'How plants make food');
    assert.deepEqual(result.lesson.conceptsCovered, ['Photosynthesis', 'Primary production']);
    assert.equal(result.stats.paragraphs, 7);
    assert.equal(result.stats.headings, 1);
    assert.ok(result.stats.words >= 700);
  }
});

test('rejects output that does not claim the central concept', () => {
  const value = validLesson();
  value.concepts_covered = ['Primary production'];
  delete value.title;

  const result = validateGeneratedLesson(value, plan);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some(error => error.includes('central concept')));
  }
});

test('rejects markdown and links in prose (unknown concepts are dropped, not fatal)', () => {
  const value = validLesson();
  value.summary = 'See https://example.org for more.';
  value.concepts_covered = ['Photosynthesis', 'Quantum gravity'];
  (value.blocks as { type: string; text: string }[])[1] = {
    type: 'paragraph',
    text: `## Heading ${paragraph('', 100)}`,
  };

  const result = validateGeneratedLesson(value, plan);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some(error => error.includes('markdown')));
    assert.ok(result.errors.some(error => error.includes('URLs')));
  }
});

test('rejects wrong shape: too few paragraphs, takeaways, and words', () => {
  const value = {
    title: 'Tiny',
    summary: 'Too small.',
    blocks: [{ type: 'paragraph', text: 'One short paragraph.' }],
    takeaways: ['Only one takeaway here.'],
    concepts_covered: ['Photosynthesis'],
  };

  const result = validateGeneratedLesson(value, plan);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some(error => error.includes('paragraphs')));
    assert.ok(result.errors.some(error => error.includes('takeaways')));
    assert.ok(result.errors.some(error => error.includes('words')));
  }
});

test('rejects non-object output', () => {
  const result = validateGeneratedLesson('hello', plan);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some(error => error.includes('JSON object')));
  }
});

// --- shape repair (real failure: the model put takeaways inside blocks) -------

test('repairLessonShape moves takeaways and concepts out of the blocks list', () => {
  const repaired = repairLessonShape({
    title: 'T',
    blocks: [
      { type: 'heading', text: 'H' },
      { takeaways: ['a', 'b', 'c'] },
      { concepts_covered: ['X'] },
    ],
  }) as { blocks: unknown[]; takeaways: string[]; concepts_covered: string[] };
  assert.deepEqual(repaired.blocks, [{ type: 'heading', text: 'H' }]);
  assert.deepEqual(repaired.takeaways, ['a', 'b', 'c']);
  assert.deepEqual(repaired.concepts_covered, ['X']);
});

test('repairLessonShape renames common block-type synonyms and leaves real errors alone', () => {
  const repaired = repairLessonShape({
    blocks: [{ type: 'Subheading', text: 'a' }, { type: 'text', text: 'b' }, { type: 'list', text: 'c' }],
  }) as { blocks: { type: string }[] };
  assert.deepEqual(repaired.blocks.map(block => block.type), ['heading', 'paragraph', 'list']);
});

test('repairLessonShape never overwrites top-level takeaways that already exist', () => {
  const repaired = repairLessonShape({
    takeaways: ['real'],
    blocks: [{ takeaways: ['stray'] }],
  }) as { takeaways: string[] };
  assert.deepEqual(repaired.takeaways, ['real']);
});

test('a lesson whose takeaways and concepts were nested in blocks now validates (the real failure)', () => {
  const lesson = validLesson();
  const broken = {
    title: lesson.title,
    summary: lesson.summary,
    blocks: [...(lesson.blocks as unknown[]), { takeaways: lesson.takeaways }, { concepts_covered: lesson.concepts_covered }],
  };
  const result = validateGeneratedLesson(broken, plan);
  assert.equal(result.ok, true);
});
