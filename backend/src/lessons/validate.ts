/**
 * Validation of model output.
 *
 * The model is never trusted: everything is re-checked here, and anything
 * structurally wrong fails the job (the worker retries, then dead-letters).
 * Concept claims are constrained to the concepts the plan actually selected,
 * and the lesson's central concept must be claimed — a lesson that silently
 * teaches nothing from its plan would corrupt progress tracking.
 */
import type { GeneratedLesson, GeneratedLessonStats, LessonPlan } from './types.ts';
import { TARGET_WORDS_MAX, TARGET_WORDS_MIN } from './prompt.ts';

const MIN_WORDS = Math.floor(TARGET_WORDS_MIN * 0.6);
const MAX_WORDS = Math.ceil(TARGET_WORDS_MAX * 1.5);
const MIN_PARAGRAPHS = 6;
const MAX_PARAGRAPHS = 30;
const MAX_HEADINGS = 8;
const MIN_TAKEAWAYS = 3;
const MAX_TAKEAWAYS = 5;
const MAX_PARAGRAPH_CHARS = 2200;
const MAX_TAKEAWAY_CHARS = 260;

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return typeof value === 'object' && value !== null ? (value as Row) : null;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

/**
 * Extract the first JSON object from raw model text. Tolerates code fences and
 * surrounding prose; returns null when no object can be parsed.
 */
export function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const candidates = [withoutFences];

  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start >= 0 && end > start) {
    candidates.push(withoutFences.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return value;
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

const MARKDOWN_PATTERNS: [RegExp, string][] = [
  [/^\s*#+\s/m, 'headings must not use markdown (#)'],
  [/\*\*|\*[^*]+\*/, 'text must not use markdown emphasis'],
  [/\[[^\]]+\]\([^)]+\)/, 'text must not contain links'],
  [/https?:\/\//i, 'text must not contain URLs'],
  [/\bhttps?:\/\b/, 'text must not contain URLs'],
];

export type ValidationResult =
  | { ok: true; lesson: GeneratedLesson; stats: GeneratedLessonStats }
  | { ok: false; errors: string[] };

export function validateGeneratedLesson(value: unknown, plan: LessonPlan): ValidationResult {
  const errors: string[] = [];
  const root = asRow(value);
  if (!root) {
    return { ok: false, errors: ['output is not a JSON object'] };
  }

  // --- title / summary -----------------------------------------------------
  const title = typeof root.title === 'string' ? root.title.trim() : '';
  if (title.length < 5 || title.length > 120) {
    errors.push(`title must be 5-120 characters (got ${title.length})`);
  }
  const summaryRaw = typeof root.summary === 'string' ? root.summary.trim() : '';
  const summary = summaryRaw.length > 0 ? summaryRaw : null;
  if (summary && summary.length > 320) {
    errors.push(`summary must be at most 320 characters (got ${summary.length})`);
  }

  // --- blocks --------------------------------------------------------------
  const blocks: GeneratedLesson['blocks'] = [];
  if (!Array.isArray(root.blocks)) {
    errors.push('blocks must be an array');
  } else {
    for (const [index, rawBlock] of root.blocks.entries()) {
      const block = asRow(rawBlock);
      const type = block?.type;
      const text = typeof block?.text === 'string' ? block.text.trim() : '';
      if (type !== 'heading' && type !== 'paragraph') {
        errors.push(`block ${index}: type must be "heading" or "paragraph"`);
        continue;
      }
      if (text.length === 0) {
        errors.push(`block ${index}: text is empty`);
        continue;
      }
      if (type === 'paragraph' && text.length > MAX_PARAGRAPH_CHARS) {
        errors.push(`block ${index}: paragraph is longer than ${MAX_PARAGRAPH_CHARS} characters`);
        continue;
      }
      blocks.push({ type, text });
    }
  }

  const headings = blocks.filter(block => block.type === 'heading').length;
  const paragraphs = blocks.filter(block => block.type === 'paragraph').length;
  const words = blocks.reduce(
    (total, block) => total + (block.type === 'paragraph' ? countWords(block.text) : 0),
    0,
  );

  if (paragraphs < MIN_PARAGRAPHS || paragraphs > MAX_PARAGRAPHS) {
    errors.push(`must contain ${MIN_PARAGRAPHS}-${MAX_PARAGRAPHS} paragraphs (got ${paragraphs})`);
  }
  if (headings < 1 || headings > MAX_HEADINGS) {
    errors.push(`must contain 1-${MAX_HEADINGS} headings (got ${headings})`);
  }
  if (words < MIN_WORDS || words > MAX_WORDS) {
    errors.push(`body must be ${MIN_WORDS}-${MAX_WORDS} words (got ${words})`);
  }

  // --- takeaways -----------------------------------------------------------
  const takeaways: string[] = [];
  if (!Array.isArray(root.takeaways)) {
    errors.push('takeaways must be an array');
  } else {
    for (const rawTakeaway of root.takeaways) {
      const text = typeof rawTakeaway === 'string' ? rawTakeaway.trim() : '';
      if (text.length === 0) {
        errors.push('takeaways must not contain empty entries');
        continue;
      }
      if (text.length > MAX_TAKEAWAY_CHARS) {
        errors.push(`takeaways must be at most ${MAX_TAKEAWAY_CHARS} characters`);
        continue;
      }
      takeaways.push(text);
    }
    if (takeaways.length < MIN_TAKEAWAYS || takeaways.length > MAX_TAKEAWAYS) {
      errors.push(`must contain ${MIN_TAKEAWAYS}-${MAX_TAKEAWAYS} takeaways (got ${takeaways.length})`);
    }
  }

  // No markdown, links, or URLs anywhere in the reader-facing prose.
  const proseTexts = [
    title,
    ...(summary ? [summary] : []),
    ...blocks.map(block => block.text),
    ...takeaways,
  ];
  for (const text of proseTexts) {
    for (const [pattern, message] of MARKDOWN_PATTERNS) {
      if (pattern.test(text)) {
        errors.push(message);
        break;
      }
    }
  }

  // --- concepts ------------------------------------------------------------
  const planByLowerName = new Map(plan.concepts.map(concept => [concept.name.toLowerCase(), concept.name]));
  const conceptsCovered: string[] = [];
  if (!Array.isArray(root.concepts_covered)) {
    errors.push('concepts_covered must be an array');
  } else {
    for (const rawName of root.concepts_covered) {
      const name = typeof rawName === 'string' ? rawName.trim().toLowerCase() : '';
      const canonical = planByLowerName.get(name);
      if (canonical && !conceptsCovered.includes(canonical)) {
        conceptsCovered.push(canonical);
      }
    }
    const primary = plan.concepts.find(concept => concept.role === 'primary');
    if (conceptsCovered.length === 0) {
      errors.push('concepts_covered must name at least one selected concept');
    } else if (primary && !conceptsCovered.includes(primary.name)) {
      errors.push(`concepts_covered must include the central concept "${primary.name}"`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    lesson: { title, summary, blocks, takeaways, conceptsCovered },
    stats: { words, blocks: blocks.length, headings, paragraphs },
  };
}
