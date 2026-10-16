import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_SOURCE_WORDS,
  chooseLessonPlan,
  countWords,
  type CandidateData,
} from '../src/lessons/candidates.ts';

function passage(id: number, conceptId: string, words: number) {
  return {
    id,
    conceptId,
    content: Array.from({ length: words }, (_, i) => `word${i}`).join(' '),
    sourceId: `source-${id % 3}`,
    sourceTitle: `Source ${id % 3}`,
    authors: ['A. Author'],
    publishedYear: 2020,
    licenseType: 'cc_by_sa',
    sourceUrl: `https://example.org/${id}`,
  };
}

const SCIENCE = { categoryId: 'cat-science', categoryName: 'Science', weight: 5 };
const HISTORY = { categoryId: 'cat-history', categoryName: 'History', weight: 3 };

function baseData(overrides: Partial<CandidateData> = {}): CandidateData {
  return {
    interests: [SCIENCE, HISTORY],
    queuedCategoryIds: [],
    completedAtByCategory: {},
    concepts: [
      { categoryId: 'cat-science', id: 'c-photo', name: 'Photosynthesis', relevance: 5, coveredTimes: 0, lastCoveredAt: null },
      { categoryId: 'cat-science', id: 'c-primary', name: 'Primary production', relevance: 4, coveredTimes: 0, lastCoveredAt: null },
      { categoryId: 'cat-history', id: 'c-rosetta', name: 'The Rosetta Stone', relevance: 5, coveredTimes: 0, lastCoveredAt: null },
      { categoryId: 'cat-history', id: 'c-hiero', name: 'Decipherment of hieroglyphs', relevance: 4, coveredTimes: 0, lastCoveredAt: null },
    ],
    passages: [
      // Science: dense cluster on two concepts.
      passage(1, 'c-photo', 200),
      passage(2, 'c-photo', 210),
      passage(3, 'c-photo', 220),
      passage(4, 'c-primary', 230),
      passage(5, 'c-primary', 240),
      // History: two concepts with passages.
      passage(6, 'c-rosetta', 200),
      passage(7, 'c-rosetta', 200),
      passage(8, 'c-hiero', 200),
      passage(9, 'c-hiero', 200),
    ],
    ...overrides,
  };
}

test('prefers a category that is not already queued', () => {
  const plan = chooseLessonPlan(baseData({ queuedCategoryIds: ['cat-science'] }));

  assert.equal(plan?.categoryId, 'cat-history');
});

test('falls back to any interest when every category is queued', () => {
  const plan = chooseLessonPlan(
    baseData({ queuedCategoryIds: ['cat-science', 'cat-history'] }),
  );

  assert.ok(plan);
  assert.ok(['cat-science', 'cat-history'].includes(plan.categoryId));
});

test('selects the primary concept first and demands at least two concepts', () => {
  const science = chooseLessonPlan(baseData({ interests: [SCIENCE] }));
  assert.ok(science);
  assert.equal(science.concepts[0]?.name, 'Photosynthesis');
  assert.equal(science.concepts[0]?.role, 'primary');
  assert.equal(science.concepts.length, 2);

  // History with only one concept that has passages -> insufficient.
  const historyOnly = chooseLessonPlan(
    baseData({
      interests: [HISTORY],
      concepts: baseData().concepts.filter(c => c.id === 'c-rosetta'),
      passages: [passage(6, 'c-rosetta', 200), passage(7, 'c-rosetta', 200), passage(8, 'c-rosetta', 200)],
    }),
  );
  assert.equal(historyOnly, null);
});

test('prefers never-covered concepts over previously covered ones', () => {
  const plan = chooseLessonPlan(
    baseData({
      interests: [SCIENCE],
      concepts: [
        { categoryId: 'cat-science', id: 'c-photo', name: 'Photosynthesis', relevance: 5, coveredTimes: 3, lastCoveredAt: '2026-01-01T00:00:00Z' },
        { categoryId: 'cat-science', id: 'c-primary', name: 'Primary production', relevance: 4, coveredTimes: 0, lastCoveredAt: null },
      ],
    }),
  );

  assert.equal(plan?.concepts[0]?.name, 'Primary production');
});

test('respects the source word budget', () => {
  const plan = chooseLessonPlan(baseData());

  assert.ok(plan);
  assert.ok(plan.sourceWords <= MAX_SOURCE_WORDS + 250);
  assert.ok(plan.passages.length <= 8);
  assert.equal(
    plan.sourceWords,
    plan.passages.reduce((total, p) => total + countWords(p.content), 0),
  );
});

test('returns null when there are too few passages for the minimum', () => {
  const plan = chooseLessonPlan(
    baseData({
      interests: [SCIENCE],
      passages: [passage(1, 'c-photo', 200), passage(2, 'c-photo', 200)],
    }),
  );

  assert.equal(plan, null);
});

test('each chosen concept is represented by at least one passage', () => {
  const data = baseData({ interests: [SCIENCE] });
  const plan = chooseLessonPlan(data);

  assert.ok(plan);
  const selectedConceptIds = new Set(
    data.passages.filter(p => plan.passages.some(pp => pp.id === p.id)).map(p => p.conceptId),
  );
  for (const concept of plan.concepts) {
    assert.ok(selectedConceptIds.has(concept.id), `no passage for concept ${concept.name}`);
  }
});

test('no interests means no plan', () => {
  assert.equal(chooseLessonPlan(baseData({ interests: [] })), null);
});
