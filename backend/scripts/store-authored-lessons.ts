/**
 * Store lessons authored offline, exactly as the generation pipeline stores
 * generated ones.
 *
 * The bundle holds, per lesson: the plan it was written against (category,
 * concepts, passages, source words), the lesson object itself, and provenance.
 * Every lesson is re-validated here with the same `validate.ts` used for model
 * output, and then written through the same sequence as `generate.ts`:
 *
 *   lesson row (generating) -> takeaways -> sources -> concepts -> queue -> ready
 *
 * Usage (from backend/):
 *   node --env-file-if-exists=.env scripts/store-authored-lessons.ts <bundle.json>
 *
 * Exit codes: 0 = every lesson stored (or already present); 1 = a lesson failed
 * validation or storage.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getSupabaseAdmin } from '../src/supabase-admin.ts';
import { validateGeneratedLesson } from '../src/lessons/validate.ts';
import { estimateMinutes } from '../src/lessons/generate.ts';
import type { LessonPlan, PlanConcept } from '../src/lessons/types.ts';

type BundlePassage = { id: number; source_id: string; sort_order: number };

type BundleLesson = {
  category_id: string;
  category_name: string;
  concepts: PlanConcept[];
  passages: BundlePassage[];
  source_words: number;
  provenance: { generation_model: string; prompt_version: string };
  lesson: unknown;
};

type Bundle = { user_id: string; authored_at?: string; lessons: BundleLesson[] };

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const bundlePath = process.argv.slice(2).find(arg => !arg.startsWith('--'));
if (!bundlePath) {
  fail('Usage: node --env-file-if-exists=.env scripts/store-authored-lessons.ts <bundle.json>');
}

const bundle = JSON.parse(await readFile(resolve(bundlePath), 'utf8')) as Bundle;
if (!bundle.user_id || !Array.isArray(bundle.lessons) || bundle.lessons.length === 0) {
  fail('Bundle must contain a user_id and a non-empty lessons array.');
}

const admin = getSupabaseAdmin();

for (const [index, entry] of bundle.lessons.entries()) {
  const label = entry.lesson && typeof entry.lesson === 'object' && 'title' in entry.lesson
    ? String((entry.lesson as { title: unknown }).title)
    : `lesson ${index + 1}`;
  console.log(`\n[${index + 1}/${bundle.lessons.length}] ${label}`);

  // The validator only reads the plan's concepts, but build a full LessonPlan so
  // the same function is used unchanged.
  const plan: LessonPlan = {
    categoryId: entry.category_id,
    categoryName: entry.category_name,
    concepts: entry.concepts,
    passages: entry.passages.map(passage => ({
      id: passage.id,
      content: '',
      words: 0,
      sourceId: passage.source_id,
      sourceTitle: '',
      authors: [],
      publishedYear: null,
      licenseType: null,
      sourceUrl: null,
    })),
    sourceWords: entry.source_words,
  };

  const validation = validateGeneratedLesson(entry.lesson, plan);
  if (!validation.ok) {
    fail(`"${label}" failed validation:\n  - ${validation.errors.join('\n  - ')}`);
  }
  const lesson = validation.lesson;
  const stats = validation.stats;
  console.log(
    `  validated: ${stats.words} words, ${stats.paragraphs} paragraphs, ${stats.headings} headings, ` +
      `${lesson.takeaways.length} takeaways, ${stats.blocks} blocks`,
  );

  const existing = await admin
    .from('lessons')
    .select('id, status')
    .eq('user_id', bundle.user_id)
    .eq('title', lesson.title)
    .maybeSingle();
  if (existing.error) {
    fail(`Could not check for an existing lesson: ${existing.error.message}`);
  }
  if (existing.data) {
    console.log(`  already stored (${existing.data.id}, ${existing.data.status}); skipping`);
    continue;
  }

  const insertResult = await admin
    .from('lessons')
    .insert({
      user_id: bundle.user_id,
      primary_category_id: plan.categoryId,
      title: lesson.title,
      summary: lesson.summary,
      content: lesson.blocks,
      estimated_minutes: estimateMinutes(stats.words),
      status: 'generating',
      generation_model: entry.provenance.generation_model,
      prompt_version: entry.provenance.prompt_version,
      quality_report: {
        words: stats.words,
        paragraphs: stats.paragraphs,
        headings: stats.headings,
        source_words: plan.sourceWords,
        passage_ids: entry.passages.map(passage => passage.id),
        concepts_covered: lesson.conceptsCovered,
        prompt_version: entry.provenance.prompt_version,
        authored_offline: true,
      },
    })
    .select('id')
    .single();
  if (insertResult.error || !insertResult.data) {
    fail(`Could not store the lesson: ${insertResult.error?.message ?? 'no row returned'}`);
  }
  const lessonId = String(insertResult.data.id);
  console.log(`  stored lesson ${lessonId} (generating), ~${estimateMinutes(stats.words)} min`);

  const takeawayResult = await admin.from('lesson_takeaways').upsert(
    lesson.takeaways.map((text, position) => ({ lesson_id: lessonId, position: position + 1, text })),
    { onConflict: 'lesson_id,position', ignoreDuplicates: true },
  );
  if (takeawayResult.error) {
    fail(`Could not store takeaways: ${takeawayResult.error.message}`);
  }

  const planConceptByName = new Map(plan.concepts.map(concept => [concept.name, concept]));
  const concepts = lesson.conceptsCovered
    .map(name => planConceptByName.get(name))
    .filter((concept): concept is PlanConcept => Boolean(concept));

  const sourceResult = await admin.from('lesson_sources').upsert(
    entry.passages.map(passage => ({
      lesson_id: lessonId,
      passage_id: passage.id,
      source_id: passage.source_id,
      source_usage: 'synthesis' as const,
      sort_order: passage.sort_order,
    })),
    { onConflict: 'lesson_id,passage_id', ignoreDuplicates: true },
  );
  if (sourceResult.error) {
    fail(`Could not store lesson sources: ${sourceResult.error.message}`);
  }

  const conceptResult = await admin.from('lesson_concepts').upsert(
    concepts.map(concept => ({ lesson_id: lessonId, concept_id: concept.id, role: concept.role })),
    { onConflict: 'lesson_id,concept_id', ignoreDuplicates: true },
  );
  if (conceptResult.error) {
    fail(`Could not store lesson concepts: ${conceptResult.error.message}`);
  }
  console.log(`  child rows: ${lesson.takeaways.length} takeaways, ${entry.passages.length} sources, ${concepts.length} concepts`);

  const queueResult = await admin
    .from('lesson_queue')
    .select('position')
    .eq('user_id', bundle.user_id)
    .in('status', ['pending', 'active']);
  if (queueResult.error) {
    fail(`Could not read the queue: ${queueResult.error.message}`);
  }
  const usedPositions = new Set(
    (queueResult.data ?? [])
      .map(row => (typeof row === 'object' && row !== null ? (row as { position?: unknown }).position : null))
      .filter((position): position is number => typeof position === 'number'),
  );
  const freePosition = [1, 2, 3].find(position => !usedPositions.has(position));
  if (freePosition === undefined) {
    console.log('  queue already has three lessons; lesson stays ready until a slot frees up');
  } else {
    const queueInsert = await admin.from('lesson_queue').insert({
      user_id: bundle.user_id,
      lesson_id: lessonId,
      position: freePosition,
      status: 'pending',
    });
    if (queueInsert.error && queueInsert.error.code !== '23505') {
      fail(`Could not queue the lesson: ${queueInsert.error.message}`);
    }
    if (!queueInsert.error) {
      console.log(`  queued at position ${freePosition}`);
    }
  }

  const readyResult = await admin
    .from('lessons')
    .update({ status: 'ready', generated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .eq('user_id', bundle.user_id)
    .neq('status', 'ready');
  if (readyResult.error) {
    fail(`Could not mark the lesson ready: ${readyResult.error.message}`);
  }
  console.log('  status: ready');
}

// --- Verify -----------------------------------------------------------------
const queue = await admin
  .from('lesson_queue')
  .select('position, status, lesson_id')
  .eq('user_id', bundle.user_id)
  .order('position');
if (queue.error) {
  fail(`Could not verify the queue: ${queue.error.message}`);
}
console.log(`\nQueue for ${bundle.user_id}:`);
for (const row of queue.data ?? []) {
  console.log(`  position ${row.position}: ${row.lesson_id} (${row.status})`);
}
