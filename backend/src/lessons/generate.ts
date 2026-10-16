/**
 * Lesson generation orchestration.
 *
 * One call = one `generate_lesson` job for one user:
 *
 *   load plan -> build prompt -> ask Ollama -> validate -> store
 *
 * Storage is crash-safe. The lesson row is inserted as `generating` and the
 * job checkpoint records everything needed to finish it (`stored`), then the
 * child rows are written and the checkpoint advances to `children`. A retry
 * therefore never regenerates an expensive lesson, and every child write is an
 * idempotent upsert keyed by its natural key. The queue insert is
 * best-effort: partial unique indexes forbid a fourth or duplicate entry.
 *
 * Insufficient library material throws `InsufficientMaterialError`, which the
 * worker treats as terminal (dead-letter) rather than retrying forever: no
 * amount of retrying will invent approved sources.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { chatJson, type OllamaOptions } from '../ollama.ts';
import { chooseLessonPlan, loadCandidateData } from './candidates.ts';
import { PROMPT_VERSION, buildLessonPrompt } from './prompt.ts';
import { extractJsonObject, validateGeneratedLesson } from './validate.ts';
import type { GeneratedLesson, GeneratedLessonStats, LessonPlan } from './types.ts';

export class InsufficientMaterialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientMaterialError';
  }
}

type SourceRow = { passage_id: number; source_id: string; sort_order: number };
type ConceptRow = { id: string; role: 'primary' | 'supporting' };

/** Everything needed to (re)write a stored lesson's child rows. */
type ChildRows = {
  takeaways: string[];
  sources: SourceRow[];
  concepts: ConceptRow[];
};

export type GenerateLessonContext = {
  admin: SupabaseClient;
  ollama: OllamaOptions;
  workerId: string;
  jobId: string;
  /** Checkpoint from the claimed job row. */
  checkpoint: Record<string, unknown> | null;
  log: (message: string) => void;
};

export type GenerateLessonResult = { lessonId: string; created: boolean };

/** Reading-time estimate that matches the app (~200 wpm, min 4 minutes). */
export function estimateMinutes(words: number): number {
  return Math.max(4, Math.round(words / 200));
}

const WORKER_STAGE_KEY = 'stage';
const STAGE_STORED = 'stored';
const STAGE_CHILDREN = 'children';

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return typeof value === 'object' && value !== null ? (value as Row) : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unknown database error'}`);
}

function buildChildRows(lesson: GeneratedLesson, plan: LessonPlan): ChildRows {
  const planConceptByName = new Map(plan.concepts.map(concept => [concept.name, concept]));
  return {
    takeaways: lesson.takeaways,
    sources: plan.passages.map((passage, index) => ({
      passage_id: passage.id,
      source_id: passage.sourceId,
      sort_order: index,
    })),
    concepts: lesson.conceptsCovered
      .map(name => planConceptByName.get(name))
      .filter((concept): concept is NonNullable<typeof concept> => Boolean(concept))
      .map(concept => ({ id: concept.id, role: concept.role })),
  };
}

/** Read child rows back from a checkpoint; null when the shape is unusable. */
function parseChildRows(checkpoint: Record<string, unknown> | null): ChildRows | null {
  if (!checkpoint) {
    return null;
  }
  const rawTakeaways = checkpoint.takeaways;
  const rawSources = checkpoint.sources;
  const rawConcepts = checkpoint.concepts;
  if (!Array.isArray(rawTakeaways) || !Array.isArray(rawSources) || !Array.isArray(rawConcepts)) {
    return null;
  }
  const takeaways = rawTakeaways.filter((text): text is string => typeof text === 'string');
  const sources: SourceRow[] = [];
  for (const raw of rawSources) {
    const row = asRow(raw);
    const passageId = typeof row?.passage_id === 'number' ? row.passage_id : null;
    const sourceId = str(row?.source_id);
    const sortOrder = typeof row?.sort_order === 'number' ? row.sort_order : null;
    if (passageId === null || !sourceId || sortOrder === null) {
      return null;
    }
    sources.push({ passage_id: passageId, source_id: sourceId, sort_order: sortOrder });
  }
  const concepts: ConceptRow[] = [];
  for (const raw of rawConcepts) {
    const row = asRow(raw);
    const id = str(row?.id);
    const role = row?.role === 'primary' ? 'primary' : row?.role === 'supporting' ? 'supporting' : null;
    if (!id || !role) {
      return null;
    }
    concepts.push({ id, role });
  }
  if (takeaways.length === 0 || sources.length === 0) {
    return null;
  }
  return { takeaways, sources, concepts };
}

export async function generateLessonForUser(
  context: GenerateLessonContext,
  userId: string,
): Promise<GenerateLessonResult> {
  const { admin, log } = context;

  // --- Resume a checkpointed lesson -----------------------------------------
  const checkpointLessonId = str(context.checkpoint?.lesson_id);
  if (checkpointLessonId) {
    const { data, error } = await admin
      .from('lessons')
      .select('id')
      .eq('id', checkpointLessonId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      fail('Could not read the checkpointed lesson', error);
    }
    if (data) {
      log(`resuming checkpointed lesson ${checkpointLessonId}`);
      const stage = str(context.checkpoint?.[WORKER_STAGE_KEY]);
      const childRows = stage === STAGE_CHILDREN ? null : parseChildRows(context.checkpoint);
      if (stage !== STAGE_CHILDREN && !childRows) {
        throw new Error(
          `Checkpoint for lesson ${checkpointLessonId} is missing child-row data; cannot finish safely.`,
        );
      }
      await finishStoredLesson(context, userId, checkpointLessonId, childRows);
      return { lessonId: checkpointLessonId, created: false };
    }
    log(`checkpointed lesson ${checkpointLessonId} no longer exists; regenerating`);
  }

  // --- Plan, generate, validate ---------------------------------------------
  const plan = chooseLessonPlan(await loadCandidateData(admin, userId));
  if (!plan) {
    throw new InsufficientMaterialError(
      'Not enough approved library material for this user\u2019s interests (need >= 2 concepts with passages and >= 3 distinct passages).',
    );
  }
  log(
    `plan: ${plan.categoryName} \u2014 ${plan.concepts.map(c => c.name).join(', ')} ` +
      `(${plan.passages.length} passages, ${plan.sourceWords} source words)`,
  );

  const raw = await chatJson(context.ollama, buildLessonPrompt(plan));
  const parsed = extractJsonObject(raw);
  if (!parsed) {
    throw new Error(`Model output was not a JSON object: "${raw.slice(0, 200)}"`);
  }
  const validation = validateGeneratedLesson(parsed, plan);
  if (!validation.ok) {
    throw new Error(`Model output failed validation: ${validation.errors.join('; ')}`);
  }
  const lesson = validation.lesson;
  const stats: GeneratedLessonStats = validation.stats;
  log(`generated "${lesson.title}" (${stats.words} words, ${stats.paragraphs} paragraphs)`);

  // --- Store the lesson row (status: generating) ----------------------------
  const now = new Date().toISOString();
  const insertResult = await admin
    .from('lessons')
    .insert({
      user_id: userId,
      primary_category_id: plan.categoryId,
      title: lesson.title,
      summary: lesson.summary,
      content: lesson.blocks,
      estimated_minutes: estimateMinutes(stats.words),
      status: 'generating',
      generation_model: context.ollama.model,
      prompt_version: PROMPT_VERSION,
      quality_report: {
        words: stats.words,
        paragraphs: stats.paragraphs,
        headings: stats.headings,
        source_words: plan.sourceWords,
        passage_ids: plan.passages.map(passage => passage.id),
        concepts_covered: lesson.conceptsCovered,
        prompt_version: PROMPT_VERSION,
      },
    })
    .select('id')
    .single();
  if (insertResult.error || !insertResult.data) {
    fail('Could not store the lesson', insertResult.error);
  }
  const lessonId = String(insertResult.data.id);
  log(`stored lesson ${lessonId} (generating)`);

  const childRows = buildChildRows(lesson, plan);
  const checkpointResult = await admin
    .from('jobs')
    .update({
      checkpoint: { [WORKER_STAGE_KEY]: STAGE_STORED, lesson_id: lessonId, ...childRows },
      updated_at: now,
    })
    .eq('id', context.jobId)
    .eq('locked_by', context.workerId);
  if (checkpointResult.error) {
    throw new Error(`Could not checkpoint the job: ${checkpointResult.error.message}`);
  }

  await finishStoredLesson(context, userId, lessonId, childRows);
  return { lessonId, created: true };
}

/**
 * Complete a stored lesson: child rows, queue entry, and the flip to `ready`.
 * Safe to call repeatedly — every step is an idempotent upsert.
 */
async function finishStoredLesson(
  context: GenerateLessonContext,
  userId: string,
  lessonId: string,
  childRows: ChildRows | null,
): Promise<void> {
  const { admin, log } = context;

  if (childRows) {
    const takeawayResult = await admin.from('lesson_takeaways').upsert(
      childRows.takeaways.map((text, index) => ({
        lesson_id: lessonId,
        position: index + 1,
        text,
      })),
      { onConflict: 'lesson_id,position', ignoreDuplicates: true },
    );
    if (takeawayResult.error) {
      throw new Error(`Could not store takeaways: ${takeawayResult.error.message}`);
    }

    const sourceResult = await admin.from('lesson_sources').upsert(
      childRows.sources.map(row => ({
        lesson_id: lessonId,
        passage_id: row.passage_id,
        source_id: row.source_id,
        source_usage: 'synthesis' as const,
        sort_order: row.sort_order,
      })),
      { onConflict: 'lesson_id,passage_id', ignoreDuplicates: true },
    );
    if (sourceResult.error) {
      throw new Error(`Could not store lesson sources: ${sourceResult.error.message}`);
    }

    if (childRows.concepts.length > 0) {
      const conceptResult = await admin.from('lesson_concepts').upsert(
        childRows.concepts.map(concept => ({
          lesson_id: lessonId,
          concept_id: concept.id,
          role: concept.role,
        })),
        { onConflict: 'lesson_id,concept_id', ignoreDuplicates: true },
      );
      if (conceptResult.error) {
        throw new Error(`Could not store lesson concepts: ${conceptResult.error.message}`);
      }
    }

    // Advance the checkpoint: child rows are done; only the queue + ready
    // flip remain, and those are safe to repeat.
    const advance = await admin
      .from('jobs')
      .update({
        checkpoint: { [WORKER_STAGE_KEY]: STAGE_CHILDREN, lesson_id: lessonId },
      })
      .eq('id', context.jobId)
      .eq('locked_by', context.workerId);
    if (advance.error) {
      throw new Error(`Could not advance the job checkpoint: ${advance.error.message}`);
    }
  }

  // --- Queue (best effort: partial unique indexes guard the invariant) ------
  const queueResult = await admin
    .from('lesson_queue')
    .select('position')
    .eq('user_id', userId)
    .in('status', ['pending', 'active']);
  if (queueResult.error) {
    throw new Error(`Could not read the queue: ${queueResult.error.message}`);
  }
  const usedPositions = new Set(
    (queueResult.data ?? [])
      .map(row => asRow(row)?.position)
      .filter((position): position is number => typeof position === 'number'),
  );
  const freePosition = [1, 2, 3].find(position => !usedPositions.has(position));
  if (freePosition === undefined) {
    log('queue already has three lessons; lesson stays ready until a slot frees up');
  } else {
    const queueInsert = await admin.from('lesson_queue').insert({
      user_id: userId,
      lesson_id: lessonId,
      position: freePosition,
      status: 'pending',
    });
    if (queueInsert.error && queueInsert.error.code !== '23505') {
      throw new Error(`Could not queue the lesson: ${queueInsert.error.message}`);
    }
    if (!queueInsert.error) {
      log(`queued lesson ${lessonId} at position ${freePosition}`);
    }
  }

  // --- Ready -----------------------------------------------------------------
  const readyResult = await admin
    .from('lessons')
    .update({ status: 'ready', generated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .eq('user_id', userId)
    .neq('status', 'ready');
  if (readyResult.error) {
    throw new Error(`Could not mark the lesson ready: ${readyResult.error.message}`);
  }
}
