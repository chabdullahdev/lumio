/**
 * Generate one lesson offline and write the result to a JSON file.
 *
 * This runs the exact production pipeline (candidate selection, prompt,
 * Ollama, validation) but performs no database access, so it works without a
 * service-role key. Candidate data is exported from the live library as JSON
 * (see docs/SETUP.md, "Preparing a lesson offline").
 *
 * Usage:
 *   node scripts/generate-preview.ts <candidate-data.json> [--out <lesson.json>]
 *
 * Exit codes: 0 = lesson generated and validated; 2 = insufficient material;
 * 3 = generation or validation failed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { chatJson } from '../src/ollama.ts';
import { chooseLessonPlan, type CandidateData } from '../src/lessons/candidates.ts';
import { PROMPT_VERSION, buildLessonPrompt } from '../src/lessons/prompt.ts';
import { extractJsonObject, validateGeneratedLesson } from '../src/lessons/validate.ts';

function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const inputPath = args.find(arg => !arg.startsWith('--'));
  if (!inputPath) {
    console.error('Usage: node scripts/generate-preview.ts <candidate-data.json> [--out <lesson.json>]');
    return 1;
  }
  const outIndex = args.indexOf('--out');
  const outPath = resolve(
    outIndex >= 0 && args[outIndex + 1]
      ? args[outIndex + 1]!
      : join(dirname(inputPath), 'generated-lesson.json'),
  );

  const candidateData = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as CandidateData;
  const plan = chooseLessonPlan(candidateData);
  if (!plan) {
    console.error('Insufficient material: no lesson plan can be built from this data.');
    return 2;
  }
  console.log(
    `Plan: ${plan.categoryName} — ${plan.concepts.map(c => `${c.name} (${c.role})`).join(', ')}`,
  );
  console.log(`Passages: ${plan.passages.map(p => `#${p.id}`).join(', ')} (${plan.sourceWords} words)`);

  const model = env('OLLAMA_MODEL', 'qwen3.5:9b');
  const startedAt = Date.now();
  console.log(`Asking ${model}…`);
  const raw = await chatJson(
    {
      baseUrl: env('OLLAMA_BASE_URL', 'http://127.0.0.1:11434'),
      model,
      timeoutMs: Number(env('OLLAMA_TIMEOUT_MS', '600000')),
    },
    buildLessonPrompt(plan),
  );
  console.log(`Model responded in ${Math.round((Date.now() - startedAt) / 1000)}s (${raw.length} chars)`);

  const parsed = extractJsonObject(raw);
  if (!parsed) {
    console.error(`Model output was not JSON:\n${raw.slice(0, 2000)}`);
    return 3;
  }
  const validation = validateGeneratedLesson(parsed, plan);
  if (!validation.ok) {
    console.error(`Validation failed:\n- ${validation.errors.join('\n- ')}`);
    console.error(`Raw output (first 2000 chars):\n${raw.slice(0, 2000)}`);
    return 3;
  }

  const output = {
    prompt_version: PROMPT_VERSION,
    model,
    generated_at: new Date().toISOString(),
    plan: {
      category_id: plan.categoryId,
      category_name: plan.categoryName,
      concepts: plan.concepts,
      passages: plan.passages.map((passage, index) => ({
        id: passage.id,
        source_id: passage.sourceId,
        sort_order: index,
        words: passage.words,
      })),
      source_words: plan.sourceWords,
    },
    lesson: validation.lesson,
    stats: validation.stats,
  };
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Lesson: "${validation.lesson.title}" (${validation.stats.words} words)`);
  console.log(`Takeaways: ${validation.lesson.takeaways.length}; concepts: ${validation.lesson.conceptsCovered.join(', ')}`);
  console.log(`Written to ${outPath}`);
  return 0;
}

process.exitCode = await main();
