/**
 * Project Gutenberg's official catalogue (`pg_catalog.csv`), turned into a
 * list of book candidates for LUMIO.
 *
 * Everything on Project Gutenberg is public domain in the USA, and the
 * catalogue records each book's subjects and shelves. This module only reads
 * that data and sorts books into LUMIO's six categories with plain rules — no
 * AI is involved, so a candidate is always a real book. The AI later chooses
 * among these candidates (see `curate.ts`).
 *
 * Pure functions, unit tested without a network.
 */
import { CATEGORY_NAMES } from './catalog.ts';

export type LumioCategory = (typeof CATEGORY_NAMES)[number];

export type CatalogEntry = {
  gutenbergId: number;
  title: string;
  authors: string;
  /** ISO date the ebook was released on Gutenberg (not the original year). */
  issued: string;
  subjects: string[];
  shelves: string[];
};

/** Minimal CSV reader: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function splitList(value: string): string[] {
  return value
    .split(';')
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

/** English-language text books only (no audio, music, images or other languages). */
export function parseCatalog(csv: string): CatalogEntry[] {
  const rows = parseCsv(csv);
  const header = rows.shift() ?? [];
  const column = (name: string): number => header.indexOf(name);
  const idCol = column('Text#');
  const typeCol = column('Type');
  const issuedCol = column('Issued');
  const titleCol = column('Title');
  const languageCol = column('Language');
  const authorsCol = column('Authors');
  const subjectsCol = column('Subjects');
  const shelvesCol = column('Bookshelves');
  if ([idCol, typeCol, titleCol, languageCol, subjectsCol, shelvesCol].some(index => index < 0)) {
    throw new Error('Unexpected catalogue format: a required column is missing.');
  }

  const entries: CatalogEntry[] = [];
  for (const row of rows) {
    if (row[typeCol] !== 'Text' || row[languageCol] !== 'en') {
      continue;
    }
    const gutenbergId = Number(row[idCol]);
    if (!Number.isInteger(gutenbergId)) {
      continue;
    }
    entries.push({
      gutenbergId,
      // Multi-line titles are "Title\nSubtitle": keep the first line.
      title: (row[titleCol] ?? '').split('\n')[0].trim(),
      authors: (row[authorsCol] ?? '').trim(),
      issued: (row[issuedCol] ?? '').trim(),
      subjects: splitList(row[subjectsCol] ?? ''),
      shelves: splitList(row[shelvesCol] ?? ''),
    });
  }
  return entries;
}

/** Shelves/subjects that mean "not a learning text" (stories, verse, kids' books...). */
const EXCLUDED = new RegExp(
  [
    'novels?',
    'fiction',
    'poetry',
    'poems?',
    'plays?\\b',
    'drama',
    'short stories',
    'children',
    'juvenile',
    'young adult',
    'humou?r',
    'romance',
    'adventure',
    'crime',
    'thrillers?',
    'mythology',
    'folklore',
    'cooking',
    'cookbooks?',
    'fairy tales?',
    'sports',
    'periodicals?',
    'magazines?',
  ].join('|'),
  'i',
);

const SHELF_RULES: Array<{ category: LumioCategory; pattern: RegExp }> = [
  { category: 'Psychology', pattern: /psychiatry\/psychology|\bpsycholog/i },
  { category: 'Politics', pattern: /category: politics|\bpolitical (science|theory|philosophy)\b/i },
  { category: 'Science', pattern: /category: science - |category: engineering/i },
  { category: 'History', pattern: /category: history - (ancient|medieval|early modern|modern|european|warfare|other)/i },
];

const SUBJECT_RULES: Array<{ category: LumioCategory; pattern: RegExp }> = [
  { category: 'Islam', pattern: /\bislam|\bkoran\b|\bqur'?an|\bmuslims?\b|\bmohammed|\bmuhammad|\bcaliphate|\bsufism/i },
  { category: 'Geopolitics', pattern: /geopolitic|international relations|sea[- ]power|\bimperialism|world politics|balance of power|military geography/i },
];

/**
 * Which LUMIO category a book belongs to, or `null` if it should be ignored.
 * Islam and Geopolitics are decided from subjects first because Gutenberg has
 * no shelf for them.
 */
export function classifyEntry(entry: CatalogEntry): LumioCategory | null {
  const haystack = [...entry.shelves, ...entry.subjects];
  if (haystack.some(value => EXCLUDED.test(value))) {
    return null;
  }
  const subjectText = entry.subjects.join(' ; ');
  for (const rule of SUBJECT_RULES) {
    if (rule.pattern.test(subjectText) || rule.pattern.test(entry.title)) {
      return rule.category;
    }
  }
  const shelfText = entry.shelves.join(' ; ');
  for (const rule of SHELF_RULES) {
    if (rule.pattern.test(shelfText) || (rule.category === 'Psychology' && rule.pattern.test(subjectText))) {
      return rule.category;
    }
  }
  return null;
}

/** Gutenberg shelves that mark widely read, well-edited works. */
const QUALITY_SHELVES = /best books ever|harvard classics|classics of literature|nobel prize/i;

/** Higher is better. Used only to decide which books the AI gets to look at. */
export function qualityScore(entry: CatalogEntry): number {
  return entry.shelves.some(shelf => QUALITY_SHELVES.test(shelf)) ? 3 : 0;
}

/**
 * Group candidates by category. Within a category, books on a quality shelf
 * come first, then the rest in catalogue order (lower ids are mostly older
 * classics).
 */
export function candidatesByCategory(entries: CatalogEntry[]): Map<LumioCategory, CatalogEntry[]> {
  const grouped = new Map<LumioCategory, CatalogEntry[]>();
  for (const category of CATEGORY_NAMES) {
    grouped.set(category, []);
  }
  for (const entry of entries) {
    const category = classifyEntry(entry);
    if (category) {
      grouped.get(category)?.push(entry);
    }
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => qualityScore(b) - qualityScore(a) || a.gutenbergId - b.gutenbergId);
  }
  return grouped;
}
