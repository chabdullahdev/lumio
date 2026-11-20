/**
 * Types shared by the lesson-generation pipeline:
 *
 *   candidates.ts  — choose what to teach (grounded in the library)
 *   prompt.ts      — turn the plan into a model prompt
 *   validate.ts    — parse and strictly validate the model output
 *   generate.ts    — orchestrate and persist the lesson
 */

export type PlanConcept = {
  id: string;
  name: string;
  role: 'primary' | 'supporting';
};

export type PlanPassage = {
  id: number;
  content: string;
  words: number;
  sourceId: string;
  sourceTitle: string;
  authors: string[];
  publishedYear: number | null;
  licenseType: string | null;
  sourceUrl: string | null;
};

/** Everything a lesson needs to be grounded and traceable. */
export type LessonPlan = {
  categoryId: string;
  categoryName: string;
  concepts: PlanConcept[];
  passages: PlanPassage[];
  sourceWords: number;
};

/** The lesson as validated from the model output (before persistence). */
export type LessonExtras = {
  bigIdea: string | null;
  /** Copied verbatim from a plan passage; `source` is that passage's book. */
  pullQuote: { text: string; source: string } | null;
  whyItMatters: string | null;
  tryThis: string | null;
  reflectionQuestion: string | null;
};

export type GeneratedLesson = {
  extras: LessonExtras;
  title: string;
  summary: string | null;
  blocks: { type: 'heading' | 'paragraph'; text: string }[];
  takeaways: string[];
  conceptsCovered: string[];
};

export type GeneratedLessonStats = {
  /** Numbers (2+ digits) in the lesson that appear in none of the extracts. */
  ungroundedNumbers?: string[];
  words: number;
  blocks: number;
  headings: number;
  paragraphs: number;
};
