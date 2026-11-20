import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleContent } from '../src/lessons/content.ts';
import type { GeneratedLesson } from '../src/lessons/types.ts';

const base: GeneratedLesson = {
  title: 'A lesson',
  summary: null,
  blocks: [
    { type: 'heading', text: 'One' },
    { type: 'paragraph', text: 'First.' },
    { type: 'paragraph', text: 'Second.' },
  ],
  takeaways: ['a', 'b', 'c'],
  conceptsCovered: ['X'],
  extras: { bigIdea: null, pullQuote: null, whyItMatters: null, tryThis: null, reflectionQuestion: null },
};

test('without extras the content is just the body', () => {
  assert.deepEqual(assembleContent(base), base.blocks);
});

test('extras are placed in reading order', () => {
  const content = assembleContent({
    ...base,
    extras: {
      bigIdea: 'In this lesson you will learn X.',
      pullQuote: { text: 'A real line from the book.', source: 'The Prince' },
      whyItMatters: 'It still matters.',
      tryThis: 'Try it.',
      reflectionQuestion: 'What do you think?',
    },
  });
  assert.deepEqual(
    content.map(block => (block.type === 'callout' ? `callout:${block.kind}` : block.type)),
    ['callout:big_idea', 'heading', 'paragraph', 'quote', 'paragraph', 'heading', 'paragraph', 'callout:try_this', 'callout:reflection'],
  );
  const quote = content.find(block => block.type === 'quote');
  assert.equal(quote?.type === 'quote' && quote.attribution, 'The Prince');
});
