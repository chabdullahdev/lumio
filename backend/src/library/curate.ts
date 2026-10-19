/**
 * AI curation of book candidates.
 *
 * The AI is shown a numbered list of REAL books (from the Gutenberg
 * catalogue) for one category and chooses the ones most worth turning into
 * ~15-minute lessons, plus the concepts each one is good for. It can only
 * pick from the list: any id it returns that is not in the list is thrown
 * away, so a made-up or copyrighted book can never get through.
 *
 * Pure functions (prompt building and reply validation) so they are unit
 * tested; the Ollama call itself lives in the script.
 */
import type { OllamaMessage } from '../ollama.ts';
import type { CatalogEntry, LumioCategory } from './gutenberg-catalog.ts';

/** A teachable idea plus the words that signal it in the book's text. */
export type CuratedConcept = {
  name: string;
  keywords: string[];
};

export type CuratedPick = {
  gutenbergId: number;
  reason: string;
  concepts: CuratedConcept[];
};

const MAX_CONCEPTS_PER_BOOK = 6;
const MAX_KEYWORDS_PER_CONCEPT = 8;

export function buildCuratePrompt(
  category: LumioCategory,
  candidates: CatalogEntry[],
  pick: number,
): OllamaMessage[] {
  const list = candidates
    .map(entry => {
      const subjects = entry.subjects.slice(0, 3).join('; ');
      return `${entry.gutenbergId} | ${entry.title} | ${entry.authors || 'Unknown'} | ${subjects}`;
    })
    .join('\n');

  return [
    {
      role: 'system',
      content: [
        'You choose books for LUMIO, a learning app that turns public-domain books into short reading lessons.',
        'You may ONLY choose books from the numbered list you are given. Never invent a book or an id.',
        'Prefer serious, well-known, readable works that teach ideas. Avoid dictionaries, catalogues, minor pamphlets, reports, and books that are mostly lists, letters, or tables.',
        'Reply with JSON only.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Category: ${category}`,
        `Choose up to ${pick} books from the list below. For each, give 3 to ${MAX_CONCEPTS_PER_BOOK} concepts (names of 2-4 words) that lessons could teach from it, and for each concept 4 to ${MAX_KEYWORDS_PER_CONCEPT} single words or short phrases likely to appear in the book's own text when it discusses that concept.`,
        'Reply as: {"picks":[{"id":123,"reason":"one short sentence","concepts":[{"name":"Concept one","keywords":["word","another phrase"]}]}]}',
        '',
        'id | title | author | subjects',
        list,
      ].join('\n'),
    },
  ];
}

/**
 * Validate the model's reply. Unknown ids, duplicates, and malformed entries
 * are dropped silently; the result is never longer than `pick`.
 */
export function parseCurateReply(
  raw: string,
  candidates: CatalogEntry[],
  pick: number,
): CuratedPick[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const picks = typeof data === 'object' && data !== null ? (data as { picks?: unknown }).picks : null;
  if (!Array.isArray(picks)) {
    return [];
  }
  const allowed = new Set(candidates.map(entry => entry.gutenbergId));
  const seen = new Set<number>();
  const out: CuratedPick[] = [];
  for (const item of picks) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { id, reason, concepts } = item as { id?: unknown; reason?: unknown; concepts?: unknown };
    const gutenbergId = typeof id === 'number' ? id : Number(id);
    if (!Number.isInteger(gutenbergId) || !allowed.has(gutenbergId) || seen.has(gutenbergId)) {
      continue;
    }
    const cleanConcepts = (Array.isArray(concepts) ? concepts : [])
      .map(parseConcept)
      .filter((value): value is CuratedConcept => value !== null)
      .slice(0, MAX_CONCEPTS_PER_BOOK);
    if (cleanConcepts.length === 0) {
      continue;
    }
    seen.add(gutenbergId);
    out.push({
      gutenbergId,
      reason: typeof reason === 'string' ? reason.trim().slice(0, 300) : '',
      concepts: cleanConcepts,
    });
    if (out.length >= pick) {
      break;
    }
  }
  return out;
}

/** Accepts {name, keywords} or a bare name; keywords fall back to the name's words. */
export function parseConcept(value: unknown): CuratedConcept | null {
  const raw =
    typeof value === 'string'
      ? { name: value, keywords: [] as unknown[] }
      : typeof value === 'object' && value !== null
        ? (value as { name?: unknown; keywords?: unknown })
        : null;
  if (raw === null || typeof raw.name !== 'string') {
    return null;
  }
  const name = raw.name.trim();
  if (name.length < 3 || name.length > 60) {
    return null;
  }
  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : [])
    .filter((word): word is string => typeof word === 'string')
    .map(word => word.trim().toLowerCase())
    .filter(word => word.length >= 3 && word.length <= 40)
    .slice(0, MAX_KEYWORDS_PER_CONCEPT);
  return { name, keywords: keywords.length > 0 ? keywords : fallbackKeywords(name) };
}

function fallbackKeywords(name: string): string[] {
  const words = name
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter(word => word.length >= 4);
  return words.length > 0 ? words : [name.toLowerCase()];
}
