/**
 * The AI decides what each reader learns next.
 *
 * The code first works out which choices are VALID for this user (concepts
 * that have licensed, unused passages — see `listPlanOptions`). The AI sees
 * that short numbered list, the user's interests and their recent lessons, and
 * picks one. Anything other than a clean pick of a listed number is ignored,
 * and the built-in rules choose instead, so the AI can steer the lesson but
 * can never cause an ungrounded or impossible one.
 *
 * Pure functions (prompt and reply parsing) are unit tested; `askPlanner`
 * performs the single small Ollama call and never throws.
 */
import { chatJson, type OllamaMessage, type OllamaOptions } from '../ollama.ts';
import { listPlanOptions, type CandidateData, type PlanOption } from './candidates.ts';

export type PlannerChoice = { option: PlanOption; reason: string };

const PLANNER_TIMEOUT_MS = 120_000;

function describeCoverage(option: PlanOption): string {
  if (option.timesCovered === 0) {
    return 'new to this reader';
  }
  const when = option.lastCoveredAt ? ` (last on ${option.lastCoveredAt.slice(0, 10)})` : '';
  return `covered ${option.timesCovered}x already${when}`;
}

export function buildPlannerPrompt(data: CandidateData, options: PlanOption[]): OllamaMessage[] {
  const interests = data.interests.map(interest => interest.categoryName).join(', ');
  const recent =
    data.recentLessonTitles && data.recentLessonTitles.length > 0
      ? data.recentLessonTitles.map(title => `- ${title}`).join('\n')
      : '- (none yet: this is one of the reader\'s first lessons)';
  const list = options
    .map(option => `${option.id}. [${option.categoryName}] ${option.conceptName} — ${describeCoverage(option)}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: [
        'You are the learning guide for LUMIO, an app that gives each reader short reading lessons.',
        'Choose the single best next lesson for this reader. Prefer ideas that are new to them, vary the subject from their recent lessons, and keep a sensible learning order.',
        'You may ONLY choose one of the numbered options. Reply with JSON only.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `The reader is interested in: ${interests}.`,
        '',
        'Their most recent lessons:',
        recent,
        '',
        'Options for the next lesson:',
        list,
        '',
        'Reply as: {"choice": <option number>, "reason": "one short sentence"}',
      ].join('\n'),
    },
  ];
}

/** The chosen option, or null for anything that is not a clean pick of a listed number. */
export function parsePlannerReply(raw: string, options: PlanOption[]): PlannerChoice | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const { choice, reason } = data as { choice?: unknown; reason?: unknown };
  const number = typeof choice === 'number' ? choice : Number(choice);
  const option = options.find(candidate => candidate.id === number);
  if (!option) {
    return null;
  }
  return { option, reason: typeof reason === 'string' ? reason.trim().slice(0, 300) : '' };
}

/** Ask the AI what to teach next. Returns null (rules decide) on any problem. */
export async function askPlanner(
  ollama: OllamaOptions,
  data: CandidateData,
  log: (message: string) => void,
): Promise<PlannerChoice | null> {
  const options = listPlanOptions(data);
  if (options.length < 2) {
    return null; // nothing to choose between
  }
  try {
    const raw = await chatJson(
      { ...ollama, timeoutMs: Math.min(ollama.timeoutMs, PLANNER_TIMEOUT_MS), numPredict: 200, temperature: 0.4 },
      buildPlannerPrompt(data, options),
    );
    const choice = parsePlannerReply(raw, options);
    if (!choice) {
      log(`the AI planner gave no valid choice; using the built-in rules ("${raw.slice(0, 80)}")`);
    }
    return choice;
  } catch (error) {
    log(`the AI planner failed (${error instanceof Error ? error.message : String(error)}); using the built-in rules`);
    return null;
  }
}
