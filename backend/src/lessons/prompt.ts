/**
 * Prompt construction for lesson generation.
 *
 * The prompt is deliberately rigid: it fixes the JSON shape, the length
 * target, the audience, and — most importantly — the grounding rule that the
 * model may only use the provided extracts, may not invent facts, and may not
 * add citations or quotations of its own. Everything the model returns is
 * validated afterwards in `validate.ts`.
 */
import type { LessonPlan } from './types.ts';
import type { OllamaMessage } from '../ollama.ts';

/** Stored on every lesson row so prompt changes are traceable. */
export const PROMPT_VERSION = 'lesson-writer-v1';

export const TARGET_WORDS_MIN = 800;
export const TARGET_WORDS_MAX = 1050;
const TARGET_TAKEAWAYS_MIN = 3;
const TARGET_TAKEAWAYS_MAX = 5;

const SYSTEM_PROMPT = [
  'You are the lesson writer for LUMIO, a personal learning app for busy adults.',
  'You write short, calm, factual reading lessons of roughly 12-15 minutes.',
  '',
  'Hard rules:',
  '- Use ONLY the information in the provided extracts. Never add outside facts, numbers, dates or names.',
  '- Never invent quotations and never include citations, links, or footnote markers in the prose.',
  '- Write in your own words (paraphrase). Do not copy sentences from the extracts verbatim.',
  '- Plain, warm, precise English. No hype, no filler, no questions to the reader.',
  '- No markdown formatting, no bullet lists, no bold or italics. Headings are plain short lines.',
  '- If the extracts disagree or leave gaps, simply leave those details out.',
  '',
  'Return ONE JSON object and nothing else, matching exactly this shape:',
  '{',
  '  "title": "short concrete title, at most 70 characters",',
  '  "summary": "one or two sentence summary, at most 200 characters",',
  '  "blocks": [',
  '    { "type": "heading", "text": "section heading" },',
  '    { "type": "paragraph", "text": "40-160 words of lesson prose" }',
  '  ],',
  '  "takeaways": ["3 to 5 short takeaways, one sentence each"],',
  '  "concepts_covered": ["names of the taught concepts, copied exactly from the provided concept list"]',
  '}',
].join('\n');

export function buildLessonPrompt(plan: LessonPlan): OllamaMessage[] {
  const conceptList = plan.concepts
    .map(concept => `- ${concept.name}${concept.role === 'primary' ? ' (central to this lesson)' : ''}`)
    .join('\n');

  const extracts = plan.passages
    .map((passage, index) => `--- EXTRACT ${index + 1} (${passage.sourceTitle}) ---\n${passage.content}`)
    .join('\n\n');

  const userPrompt = [
    `Write one lesson about these concepts for a curious adult who is new to the topic:`,
    conceptList,
    '',
    `Subject area: ${plan.categoryName}.`,
    `Length: between ${TARGET_WORDS_MIN} and ${TARGET_WORDS_MAX} words across the paragraphs (not counting takeaways).`,
    `Structure: 3 to 4 sections; each section starts with one heading and continues with one or more paragraphs.`,
    `Takeaways: ${TARGET_TAKEAWAYS_MIN} to ${TARGET_TAKEAWAYS_MAX}, each a single clear sentence.`,
    `concepts_covered: must include the central concept, using the exact names listed above.`,
    '',
    'Source extracts you may draw on:',
    '',
    extracts,
  ].join('\n');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];
}
