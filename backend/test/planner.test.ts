import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseLessonPlan, listPlanOptions, type CandidateData } from '../src/lessons/candidates.ts';
import { buildPlannerPrompt, parsePlannerReply } from '../src/lessons/planner.ts';

function passage(id: number, conceptId: string) {
  return {
    id,
    conceptId,
    content: Array.from({ length: 200 }, (_, i) => `w${i}`).join(' '),
    sourceId: `s${id}`,
    sourceTitle: `Source ${id}`,
    authors: ['A'],
    publishedYear: 1900,
    licenseType: 'public_domain',
    sourceUrl: null,
  };
}

const concept = (categoryId: string, id: string, name: string, coveredTimes = 0) => ({
  categoryId,
  id,
  name,
  relevance: 4,
  coveredTimes,
  lastCoveredAt: coveredTimes > 0 ? '2026-10-01T00:00:00Z' : null,
});

function data(overrides: Partial<CandidateData> = {}): CandidateData {
  return {
    interests: [
      { categoryId: 'sci', categoryName: 'Science', weight: 5 },
      { categoryId: 'his', categoryName: 'History', weight: 3 },
    ],
    queuedCategoryIds: [],
    completedAtByCategory: {},
    concepts: [
      concept('sci', 'c1', 'Photosynthesis'),
      concept('sci', 'c2', 'Evolution'),
      concept('sci', 'c3', 'Relativity'),
      concept('his', 'h1', 'Roman Republic'),
      concept('his', 'h2', 'Peloponnesian War'),
    ],
    passages: ['c1', 'c2', 'c3', 'h1', 'h2'].flatMap((id, i) => [passage(i * 10 + 1, id), passage(i * 10 + 2, id)]),
    recentLessonTitles: ['How plants make food'],
    ...overrides,
  };
}

test('listPlanOptions interleaves categories and numbers the options from 1', () => {
  const options = listPlanOptions(data());
  assert.deepEqual(options.map(option => option.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(options.slice(0, 2).map(option => option.categoryName).sort(), ['History', 'Science']);
});

test('listPlanOptions leaves out a category with too little material', () => {
  const options = listPlanOptions(data({ concepts: [concept('sci', 'c1', 'Photosynthesis'), concept('sci', 'c2', 'Evolution'), concept('his', 'h1', 'Roman Republic')] }));
  assert.ok(options.every(option => option.categoryName === 'Science'));
});

test("chooseLessonPlan follows the AI's lead concept, even in another category", () => {
  const plan = chooseLessonPlan(data(), 'h2');
  assert.equal(plan?.categoryName, 'History');
  assert.equal(plan?.concepts[0].id, 'h2');
  assert.equal(plan?.concepts[0].role, 'primary');
});

test('chooseLessonPlan ignores an invalid lead and falls back to the rules', () => {
  const rules = chooseLessonPlan(data());
  assert.deepEqual(chooseLessonPlan(data(), 'does-not-exist')?.concepts, rules?.concepts);
});

test('chooseLessonPlan will not let the AI pick a category that is already queued', () => {
  const plan = chooseLessonPlan(data({ queuedCategoryIds: ['his'] }), 'h1');
  assert.equal(plan?.categoryName, 'Science');
});

test('parsePlannerReply accepts only a listed option number', () => {
  const options = listPlanOptions(data());
  assert.equal(parsePlannerReply('{"choice":2,"reason":"variety"}', options)?.option.id, 2);
  assert.equal(parsePlannerReply('{"choice":"3"}', options)?.option.id, 3);
  assert.equal(parsePlannerReply('{"choice":99}', options), null);
  assert.equal(parsePlannerReply('{"choice":"Photosynthesis"}', options), null);
  assert.equal(parsePlannerReply('not json', options), null);
});

test('the planner prompt lists every option, the interests and recent lessons', () => {
  const options = listPlanOptions(data());
  const text = buildPlannerPrompt(data(), options)[1].content;
  assert.ok(text.includes('Science, History'));
  assert.ok(text.includes('How plants make food'));
  assert.ok(text.includes('1. [') && text.includes('Peloponnesian War'));
  assert.ok(text.includes('new to this reader'));
});

test('finishing a lesson in a subject brings the next lesson in that same subject', () => {
  // The reader has three subjects and three slots. They just finished History, so
  // Science and Politics are still queued and History is the only subject free.
  const base = data({
    interests: [
      { categoryId: 'sci', categoryName: 'Science', weight: 5 },
      { categoryId: 'his', categoryName: 'History', weight: 3 },
      { categoryId: 'pol', categoryName: 'Politics', weight: 3 },
    ],
    concepts: [
      concept('sci', 'c1', 'Photosynthesis'), concept('sci', 'c2', 'Evolution'),
      concept('his', 'h1', 'Roman Republic'), concept('his', 'h2', 'Peloponnesian War'),
      concept('pol', 'p1', 'Separation of Powers'), concept('pol', 'p2', 'Social Contract'),
    ],
    passages: ['c1', 'c2', 'h1', 'h2', 'p1', 'p2'].flatMap((id, i) => [passage(i * 10 + 1, id), passage(i * 10 + 2, id)]),
    queuedCategoryIds: ['sci', 'pol'],
  });
  assert.deepEqual(listPlanOptions(base).map(option => option.categoryName), ['History', 'History']);
  assert.equal(chooseLessonPlan(base)?.categoryName, 'History');
  // Even if the AI asks for another subject, a subject already in the queue is refused.
  assert.equal(chooseLessonPlan(base, 'p1')?.categoryName, 'History');
});
