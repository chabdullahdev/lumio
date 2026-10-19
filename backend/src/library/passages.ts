/**
 * Turn parsed book sections into storable sections and ~250-word passages,
 * and score passages against concept keywords.
 *
 * Everything here is pure so it can be unit tested without a network or DB.
 */
import type { RawSection } from './epub.ts';

export const TARGET_WORDS = 250;
const SOFT_MAX_WORDS = 330;
const MIN_WORDS = 90;
const MIN_SECTION_WORDS = 200;

export type BookSection = {
  title: string | null;
  paragraphs: string[];
  words: number;
};

export type StoredPassage = {
  /** Index into the book's section list. */
  sectionIndex: number;
  content: string;
  words: number;
};

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

const LEGAL = /project gutenberg|gutenberg-tm|gutenberg™|\bfull license\b|transcriber'?s? note|\bproduced by\b|\bonline distributed proofreading\b/i;
const FRONT_MATTER_TITLE =
  /^(contents|table of contents|list of illustrations|illustrations|title page|copyright|colophon|imprint|the project gutenberg|index|footnotes?|errata|bibliography|chapter summary)\.?$|\bcontents\b/i;

/**
 * True for paragraphs that are apparatus rather than reading: footnote
 * blocks, index entries, and tables of contents.
 */
export function isNoiseParagraph(paragraph: string): boolean {
  if (/^\d+\s*\(\s*return\s*\)/i.test(paragraph)) {
    return true;
  }
  const tokens = paragraph.split(/\s+/);
  if (tokens.length < 8) {
    return false;
  }
  const digits = (paragraph.match(/\d/g) ?? []).length;
  if (digits / paragraph.length > 0.06) {
    return true;
  }
  const pageRefs = (paragraph.match(/\b\d{1,4}\s*,/g) ?? []).length;
  if (pageRefs >= 5) {
    return true;
  }
  const numerals = tokens.filter(token => /^[IVXLC]{1,6}\.$/.test(token)).length;
  return numerals >= 3;
}

/**
 * Group raw sections into chapters: drop front matter/legal text, merge tiny
 * sections into the one before them, and optionally keep only titles that
 * match `include` (for very large omnibus books).
 */
export function buildSections(raw: RawSection[], include?: RegExp): BookSection[] {
  const sections: BookSection[] = [];
  for (const section of raw) {
    const paragraphs = section.paragraphs.filter(
      paragraph => !LEGAL.test(paragraph) && !isNoiseParagraph(paragraph),
    );
    const words = paragraphs.reduce((total, paragraph) => total + countWords(paragraph), 0);
    if (section.title && FRONT_MATTER_TITLE.test(section.title)) {
      continue;
    }
    if (words === 0) {
      continue;
    }
    const previous = sections[sections.length - 1];
    if (words < MIN_SECTION_WORDS && previous) {
      previous.paragraphs.push(...(section.title ? [section.title] : []), ...paragraphs);
      previous.words += words;
      continue;
    }
    sections.push({ title: section.title, paragraphs: [...paragraphs], words });
  }
  if (!include) {
    return sections;
  }
  return sections.filter(section => section.title !== null && include.test(section.title));
}

/** Split an over-long paragraph on sentence boundaries into ~TARGET_WORDS pieces. */
function splitLongParagraph(paragraph: string): string[] {
  const sentences = paragraph.match(/[^.!?]+(?:[.!?]+["”’')\]]*|$)\s*/g) ?? [paragraph];
  const pieces: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && countWords(current) + countWords(sentence) > SOFT_MAX_WORDS) {
      pieces.push(current.trim());
      current = '';
    }
    current += sentence;
    if (countWords(current) >= TARGET_WORDS) {
      pieces.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) {
    pieces.push(current.trim());
  }
  return pieces;
}

/** Cut one section's paragraphs into passages that never cross a section. */
export function splitIntoPassages(sectionIndex: number, paragraphs: string[]): StoredPassage[] {
  const units: string[] = [];
  for (const paragraph of paragraphs) {
    if (countWords(paragraph) > SOFT_MAX_WORDS) {
      units.push(...splitLongParagraph(paragraph));
    } else {
      units.push(paragraph);
    }
  }

  const passages: StoredPassage[] = [];
  let buffer: string[] = [];
  let bufferWords = 0;
  const emit = (): void => {
    if (buffer.length === 0) {
      return;
    }
    passages.push({ sectionIndex, content: buffer.join('\n\n'), words: bufferWords });
    buffer = [];
    bufferWords = 0;
  };
  for (const unit of units) {
    const unitWords = countWords(unit);
    if (bufferWords > 0 && bufferWords + unitWords > SOFT_MAX_WORDS) {
      emit();
    }
    buffer.push(unit);
    bufferWords += unitWords;
    if (bufferWords >= TARGET_WORDS) {
      emit();
    }
  }
  if (bufferWords > 0) {
    const last = passages[passages.length - 1];
    if (bufferWords < MIN_WORDS && last) {
      last.content += `\n\n${buffer.join('\n\n')}`;
      last.words += bufferWords;
    } else {
      emit();
    }
  }
  return passages;
}

export type Keyword = {
  /** Case-insensitive regular expression source. */
  pattern: string;
  weight?: number;
};

export type ScoredPassage = { index: number; score: number };

/**
 * Score passages for a concept: keyword hits (capped per keyword so a repeated
 * word does not dominate), plus a bonus when the chapter title matches.
 */
export function scorePassages(
  passages: { content: string; sectionTitle: string | null }[],
  keywords: Keyword[],
  sectionPattern?: string,
): ScoredPassage[] {
  const compiled = keywords.map(keyword => ({
    regex: new RegExp(keyword.pattern, 'gi'),
    weight: keyword.weight ?? 1,
  }));
  const titleRegex = sectionPattern ? new RegExp(sectionPattern, 'i') : null;
  return passages.map((passage, index) => {
    let score = 0;
    let distinct = 0;
    for (const { regex, weight } of compiled) {
      const hits = passage.content.match(regex)?.length ?? 0;
      if (hits > 0) {
        distinct += 1;
        score += Math.min(hits, 3) * weight;
      }
    }
    if (distinct >= 2) {
      score += distinct;
    }
    if (titleRegex && passage.sectionTitle && titleRegex.test(passage.sectionTitle)) {
      score += 4;
    }
    return { index, score };
  });
}

/** Best `limit` passages scoring at least `minScore`, highest first. */
export function pickTopPassages(
  scored: ScoredPassage[],
  limit: number,
  minScore: number,
): ScoredPassage[] {
  return scored
    .filter(entry => entry.score >= minScore)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit);
}
