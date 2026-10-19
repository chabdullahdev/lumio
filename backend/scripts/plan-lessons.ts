/**
 * Build lesson plans for a user and write them to a JSON bundle.
 *
 * Uses the real candidate-selection code (interests, covered concepts, unused
 * passages, approved sources) so an authored lesson is grounded exactly like a
 * generated one. The bundle includes full passage text so lessons can be
 * written offline, then validated and stored by `store-authored-lessons.ts`.
 *
 * Plans are made distinct from each other: after each plan its passages are
 * excluded, its category is treated as already queued (variety across subjects)
 * and its concepts are treated as covered (the next plan picks new ones).
 *
 * Usage (from backend/):
 *   node --env-file-if-exists=.env scripts/plan-lessons.ts <user-id> [--count 3] [--out plans.json]
 */
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { getSupabaseAdmin } from '../src/supabase-admin.ts';
import { chooseLessonPlan, loadCandidateData, type CandidateData } from '../src/lessons/candidates.ts';

type BundlePassage = {
  id: number;
  sortOrder: number;
  sourceId: string;
  sourceTitle: string;
  authors: string[];
  publishedYear: number | null;
  licenseType: string | null;
  sourceUrl: string | null;
  words: number;
  content: string;
};

type BundlePlan = {
  categoryId: string;
  categoryName: string;
  concepts: { id: string; name: string; role: 'primary' | 'supporting' }[];
  passages: BundlePassage[];
  sourceWords: number;
};

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const userId = args.find(arg => !arg.startsWith('--'));
if (!userId) {
  fail('Usage: node --env-file-if-exists=.env scripts/plan-lessons.ts <user-id> [--count 3] [--out plans.json]');
}
const countIndex = args.indexOf('--count');
const count = countIndex >= 0 ? Number(args[countIndex + 1]) : 3;
if (!Number.isInteger(count) || count < 1 || count > 10) {
  fail('--count must be an integer between 1 and 10.');
}
const outIndex = args.indexOf('--out');
const outPath =
  outIndex >= 0 && args[outIndex + 1]
    ? resolve(args[outIndex + 1]!)
    : join(tmpdir(), 'lumio-lesson-plans.json');

const admin = getSupabaseAdmin();
const data: CandidateData = await loadCandidateData(admin, userId);

const plans: BundlePlan[] = [];
const takenAt = new Date().toISOString();
for (let index = 0; index < count; index += 1) {
  const plan = chooseLessonPlan(data);
  if (!plan) {
    console.error(
      `Stopped after ${plans.length} plan(s): no further plan is possible from this library.`,
    );
    break;
  }
  plans.push({
    categoryId: plan.categoryId,
    categoryName: plan.categoryName,
    concepts: plan.concepts,
    passages: plan.passages.map((passage, sortOrder) => ({
      id: passage.id,
      sortOrder,
      sourceId: passage.sourceId,
      sourceTitle: passage.sourceTitle,
      authors: passage.authors,
      publishedYear: passage.publishedYear,
      licenseType: passage.licenseType,
      sourceUrl: passage.sourceUrl,
      words: passage.words,
      content: passage.content,
    })),
    sourceWords: plan.sourceWords,
  });

  // Make the following plans different: no reused passages, a different
  // subject, and fresh concepts.
  const usedPassageIds = new Set(plan.passages.map(passage => passage.id));
  data.passages = data.passages.filter(passage => !usedPassageIds.has(passage.id));
  if (!data.queuedCategoryIds.includes(plan.categoryId)) {
    data.queuedCategoryIds = [...data.queuedCategoryIds, plan.categoryId];
  }
  for (const chosen of plan.concepts) {
    const row = data.concepts.find(concept => concept.id === chosen.id);
    if (row) {
      row.coveredTimes += 1;
      row.lastCoveredAt = takenAt;
    }
  }
}

if (plans.length === 0) {
  fail('No lesson plan can be built: the library has insufficient material for this user.');
}

await writeFile(
  outPath,
  `${JSON.stringify({ user_id: userId, generated_at: takenAt, plans }, null, 2)}\n`,
  'utf8',
);

console.log(`Wrote ${plans.length} plan(s) to ${outPath}`);
for (const [index, plan] of plans.entries()) {
  console.log(
    `  ${index + 1}. ${plan.categoryName} — ${plan.concepts.map(c => `${c.name} (${c.role})`).join(', ')}`,
  );
  console.log(
    `     passages: ${plan.passages.map(p => `#${p.id}`).join(', ')} (${plan.sourceWords} source words)`,
  );
}
