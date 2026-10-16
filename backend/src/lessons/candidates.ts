/**
 * Lesson candidate selection.
 *
 * The rule set, in one sentence: pick a topic the user chose and has not been
 * served recently, prefer concepts they have not covered yet, and ground the
 * lesson in approved passages that nothing else has used for this user.
 *
 * Splits cleanly into:
 *   * `loadCandidateData` — a handful of read-only queries as the service role;
 *   * `chooseLessonPlan`  — a pure function over that data (unit tested).
 *
 * When there is not enough approved material the plan is `null` and the
 * caller treats it as a terminal "insufficient material" condition rather
 * than retrying forever.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LessonPlan, PlanConcept, PlanPassage } from './types.ts';

/** How many source words one lesson may draw on, and passage limits. */
export const MAX_SOURCE_WORDS = 1400;
export const MAX_PASSAGES = 8;
export const MIN_PASSAGES = 3;

const MAX_CONCEPTS = 3;

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return typeof value === 'object' && value !== null ? (value as Row) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function unwrapRows(data: unknown, error: { message: string } | null, context: string): unknown[] {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
  return asArray(data);
}

/** Count words the same way the reader does (~200 wpm estimate). */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

export type CandidateInterest = {
  categoryId: string;
  categoryName: string;
  weight: number;
};

export type CandidateConcept = {
  categoryId: string;
  id: string;
  name: string;
  relevance: number;
  /** How many times the user has already covered it (0 = new). */
  coveredTimes: number;
  lastCoveredAt: string | null;
};

export type CandidatePassage = {
  id: number;
  conceptId: string;
  content: string;
  sourceId: string;
  sourceTitle: string;
  authors: string[];
  publishedYear: number | null;
  licenseType: string | null;
  sourceUrl: string | null;
};

export type CandidateData = {
  interests: CandidateInterest[];
  /** Categories of lessons currently in the user's queue (for variety). */
  queuedCategoryIds: string[];
  /** Category id -> ISO timestamp of the user's most recent completion. */
  completedAtByCategory: Record<string, string>;
  concepts: CandidateConcept[];
  passages: CandidatePassage[];
};

/**
 * Pure selection. Returns null when the user's interest graph plus approved
 * library cannot satisfy the minimums (>= 2 concepts, >= 3 passages).
 */
export function chooseLessonPlan(data: CandidateData): LessonPlan | null {
  if (data.interests.length === 0) {
    return null;
  }

  // 1) Category: avoid repeating what is already queued; then prefer the
  //    category served least recently (never served = earliest).
  const eligibleCategories = data.interests.filter(
    interest => !data.queuedCategoryIds.includes(interest.categoryId),
  );
  const categoryPool = eligibleCategories.length > 0 ? eligibleCategories : data.interests;
  const sortedCategories = [...categoryPool].sort((a, b) => {
    const aSeen = data.completedAtByCategory[a.categoryId] ?? '';
    const bSeen = data.completedAtByCategory[b.categoryId] ?? '';
    if (aSeen !== bSeen) {
      return aSeen < bSeen ? -1 : 1;
    }
    if (a.weight !== b.weight) {
      return b.weight - a.weight;
    }
    return a.categoryName.localeCompare(b.categoryName);
  });
  const category = sortedCategories[0]!;

  // 2) Passages that are eligible at all: linked to this category's concepts,
  //    from ready/approved sources, not already used in one of the user's
  //    lessons.
  const conceptIdsInCategory = new Set(
    data.concepts.filter(concept => concept.categoryId === category.categoryId).map(c => c.id),
  );
  const passagesByConcept = new Map<string, CandidatePassage[]>();
  for (const passage of data.passages) {
    if (!conceptIdsInCategory.has(passage.conceptId)) {
      continue;
    }
    const list = passagesByConcept.get(passage.conceptId) ?? [];
    list.push(passage);
    passagesByConcept.set(passage.conceptId, list);
  }

  // 3) Concepts: first those never covered (most relevant first), then
  //    previously covered ones (least recently covered first). Only concepts
  //    with at least one eligible passage can lead a lesson.
  const usableConcepts = data.concepts
    .filter(concept => concept.categoryId === category.categoryId)
    .filter(concept => (passagesByConcept.get(concept.id)?.length ?? 0) > 0)
    .sort((a, b) => {
      const aNew = a.coveredTimes === 0 ? 0 : 1;
      const bNew = b.coveredTimes === 0 ? 0 : 1;
      if (aNew !== bNew) {
        return aNew - bNew;
      }
      if (aNew === 1) {
        const aSeen = a.lastCoveredAt ?? '';
        const bSeen = b.lastCoveredAt ?? '';
        if (aSeen !== bSeen) {
          return aSeen < bSeen ? -1 : 1;
        }
      }
      if (a.relevance !== b.relevance) {
        return b.relevance - a.relevance;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, MAX_CONCEPTS);

  if (usableConcepts.length < 2) {
    return null;
  }

  const chosenConceptIds = new Set(usableConcepts.map(concept => concept.id));
  const chosenConcepts: PlanConcept[] = usableConcepts.map((concept, index) => ({
    id: concept.id,
    name: concept.name,
    role: index === 0 ? 'primary' : 'supporting',
  }));

  // 4) Passages: score by how many chosen concepts they touch, then by size
  //    (prefer substantial extracts), then stable order. Greedy fill up to
  //    the word budget; each chosen concept ends up represented.
  const candidates = data.passages.filter(
    passage => chosenConceptIds.has(passage.conceptId),
  );
  const uniqueById = new Map<number, CandidatePassage>();
  for (const passage of candidates) {
    if (!uniqueById.has(passage.id)) {
      uniqueById.set(passage.id, passage);
    }
  }
  const matchCount = new Map<number, number>();
  for (const passage of uniqueById.values()) {
    matchCount.set(passage.id, (matchCount.get(passage.id) ?? 0) + 1);
  }
  const ranked = [...uniqueById.values()].sort((a, b) => {
    const aMatches = matchCount.get(a.id) ?? 0;
    const bMatches = matchCount.get(b.id) ?? 0;
    if (aMatches !== bMatches) {
      return bMatches - aMatches;
    }
    const aDistance = Math.abs(countWords(a.content) - 220);
    const bDistance = Math.abs(countWords(b.content) - 220);
    if (aDistance !== bDistance) {
      return aDistance - bDistance;
    }
    return a.id - b.id;
  });

  const selected: CandidatePassage[] = [];
  const selectedIds = new Set<number>();
  let words = 0;
  const addPassage = (passage: CandidatePassage): void => {
    if (selectedIds.has(passage.id)) {
      return;
    }
    selectedIds.add(passage.id);
    selected.push(passage);
    words += countWords(passage.content);
  };

  // First pass: guarantee one passage per chosen concept.
  for (const concept of chosenConcepts) {
    const best = ranked.find(
      passage => passage.conceptId === concept.id && !selectedIds.has(passage.id),
    );
    if (best) {
      addPassage(best);
    }
  }
  // Second pass: widen with the best remaining passages inside the budget.
  for (const passage of ranked) {
    if (selected.length >= MAX_PASSAGES) {
      break;
    }
    const passageWords = countWords(passage.content);
    if (selected.length >= MIN_PASSAGES && words + passageWords > MAX_SOURCE_WORDS + 250) {
      continue;
    }
    if (words >= MAX_SOURCE_WORDS) {
      break;
    }
    addPassage(passage);
  }

  if (selected.length < MIN_PASSAGES) {
    return null;
  }

  const passages: PlanPassage[] = selected.map(passage => ({
    id: passage.id,
    content: passage.content,
    words: countWords(passage.content),
    sourceId: passage.sourceId,
    sourceTitle: passage.sourceTitle,
    authors: passage.authors,
    publishedYear: passage.publishedYear,
    licenseType: passage.licenseType,
    sourceUrl: passage.sourceUrl,
  }));

  return {
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    concepts: chosenConcepts,
    passages,
    sourceWords: words,
  };
}

/** Read-only data load for `chooseLessonPlan`, as the service role. */
export async function loadCandidateData(
  admin: SupabaseClient,
  userId: string,
): Promise<CandidateData> {
  const interestsResult = await admin
    .from('user_interests')
    .select('weight, category:categories(id, name)')
    .eq('user_id', userId);
  const interests: CandidateInterest[] = [];
  for (const rawRow of unwrapRows(interestsResult.data, interestsResult.error, 'Could not load user interests')) {
    const row = asRow(rawRow);
    const category = asRow(row?.category);
    const categoryId = str(category?.id);
    const categoryName = str(category?.name);
    if (categoryId && categoryName) {
      interests.push({ categoryId, categoryName, weight: num(row?.weight) ?? 3 });
    }
  }

  const [queueResult, completedResult, coveredResult, lessonsResult] = await Promise.all([
    admin
      .from('lesson_queue')
      .select('lesson:lessons(primary_category_id)')
      .eq('user_id', userId)
      .in('status', ['pending', 'active']),
    admin
      .from('user_lesson_progress')
      .select('completed_at, lesson:lessons(primary_category_id)')
      .eq('user_id', userId)
      .not('completed_at', 'is', null),
    admin
      .from('user_covered_concepts')
      .select('concept_id, last_covered_at, times_covered')
      .eq('user_id', userId),
    admin.from('lessons').select('id').eq('user_id', userId),
  ]);

  const queuedCategoryIds: string[] = [];
  for (const rawRow of unwrapRows(queueResult.data, queueResult.error, 'Could not load the lesson queue')) {
    const categoryId = str(asRow(asRow(rawRow)?.lesson)?.primary_category_id);
    if (categoryId) {
      queuedCategoryIds.push(categoryId);
    }
  }

  const completedAtByCategory: Record<string, string> = {};
  for (const rawRow of unwrapRows(completedResult.data, completedResult.error, 'Could not load completions')) {
    const row = asRow(rawRow);
    const categoryId = str(asRow(row?.lesson)?.primary_category_id);
    const completedAt = str(row?.completed_at);
    if (categoryId && completedAt) {
      const current = completedAtByCategory[categoryId];
      if (!current || completedAt > current) {
        completedAtByCategory[categoryId] = completedAt;
      }
    }
  }

  const coveredByConcept = new Map<string, { times: number; lastAt: string | null }>();
  for (const rawRow of unwrapRows(coveredResult.data, coveredResult.error, 'Could not load covered concepts')) {
    const row = asRow(rawRow);
    const conceptId = str(row?.concept_id);
    if (conceptId) {
      coveredByConcept.set(conceptId, {
        times: num(row?.times_covered) ?? 1,
        lastAt: str(row?.last_covered_at),
      });
    }
  }

  const interestIds = interests.map(interest => interest.categoryId);
  const concepts: CandidateConcept[] = [];
  if (interestIds.length > 0) {
    const conceptsResult = await admin
      .from('category_concepts')
      .select('category_id, relevance, concept:concepts(id, name)')
      .in('category_id', interestIds);
    for (const rawRow of unwrapRows(conceptsResult.data, conceptsResult.error, 'Could not load concepts')) {
      const row = asRow(rawRow);
      const concept = asRow(row?.concept);
      const conceptId = str(concept?.id);
      const conceptName = str(concept?.name);
      const categoryId = str(row?.category_id);
      if (conceptId && conceptName && categoryId) {
        const covered = coveredByConcept.get(conceptId);
        concepts.push({
          categoryId,
          id: conceptId,
          name: conceptName,
          relevance: num(row?.relevance) ?? 3,
          coveredTimes: covered?.times ?? 0,
          lastCoveredAt: covered?.lastAt ?? null,
        });
      }
    }
  }

  // Passages already used in any of the user's lessons must not repeat.
  const usedPassageIds = new Set<number>();
  const lessonIds = unwrapRows(lessonsResult.data, lessonsResult.error, 'Could not load lessons')
    .map(asRow)
    .map(row => str(row?.id))
    .filter((id): id is string => id !== null);
  if (lessonIds.length > 0) {
    const usedResult = await admin
      .from('lesson_sources')
      .select('passage_id')
      .in('lesson_id', lessonIds);
    for (const rawRow of unwrapRows(usedResult.data, usedResult.error, 'Could not load used passages')) {
      const passageId = num(asRow(rawRow)?.passage_id);
      if (passageId !== null) {
        usedPassageIds.add(passageId);
      }
    }
  }

  const passages: CandidatePassage[] = [];
  const conceptIds = concepts.map(concept => concept.id);
  if (conceptIds.length > 0) {
    const passagesResult = await admin
      .from('passage_concepts')
      .select(
        'concept_id, passage:passages(id, content, source:sources(id, title, authors, published_year, source_url, processing_status, licensing_records(license_type, status)))',
      )
      .in('concept_id', conceptIds);
    for (const rawRow of unwrapRows(passagesResult.data, passagesResult.error, 'Could not load passages')) {
      const row = asRow(rawRow);
      const conceptId = str(row?.concept_id);
      const passage = asRow(row?.passage);
      const source = asRow(passage?.source);
      const passageId = num(passage?.id);
      const content = str(passage?.content);
      const sourceId = str(source?.id);
      if (!conceptId || passageId === null || !content || !sourceId) {
        continue;
      }
      if (usedPassageIds.has(passageId)) {
        continue;
      }
      // Grounding gate: ready sources with an approved licensing record only.
      if (str(source?.processing_status) !== 'ready') {
        continue;
      }
      const licenseRows = asArray(source?.licensing_records).map(asRow);
      const approved = licenseRows.find(license => str(license?.status) === 'approved');
      if (!approved) {
        continue;
      }
      passages.push({
        id: passageId,
        conceptId,
        content,
        sourceId,
        sourceTitle: str(source?.title) ?? 'Untitled source',
        authors: asArray(source?.authors).filter(
          (author): author is string => typeof author === 'string',
        ),
        publishedYear: num(source?.published_year),
        licenseType: str(approved?.license_type),
        sourceUrl: str(source?.source_url),
      });
    }
  }

  return {
    interests,
    queuedCategoryIds,
    completedAtByCategory,
    concepts,
    passages,
  };
}
