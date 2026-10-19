/**
 * Save a converted book (see `book-files.ts`) into Supabase and link its
 * passages to the concepts the AI chose for it.
 *
 * Order matters and mirrors `scripts/ingest-library.ts`: the source is
 * inserted as `extracting`, the approved public-domain licence record is
 * written before any passage, and the source only becomes `ready` once
 * everything else is stored. A half-stored source from a crashed run is
 * removed and redone.
 *
 * `keywordsFor` is pure and unit tested; the rest needs a database.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CuratedConcept } from './curate.ts';
import { pickTopPassages, scorePassages, type Keyword } from './passages.ts';

export const LINKS_PER_CONCEPT = 12;
export const MIN_LINK_SCORE = 4;
export const LINK_METHOD = 'ai_keywords';
const INSERT_BATCH = 200;

/** The `book.json` written by `discover-books.ts`. */
export type BookFile = {
  gutenbergId: number;
  title: string;
  authors: string;
  category: string;
  sourceUrl: string;
  chapters: Array<{ ordinal: number; title: string | null; words: number }>;
  passages: Array<{ ordinal: number; chapter: number; words: number; content: string }>;
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Turn the AI's words into passage-scoring rules. The concept's own name
 * counts triple (a passage that says it outright is a strong match).
 */
export function keywordsFor(concept: CuratedConcept): Keyword[] {
  const rules: Keyword[] = [{ pattern: `\\b${escapeRegex(concept.name.toLowerCase())}\\b`, weight: 3 }];
  for (const word of concept.keywords) {
    rules.push({ pattern: `\\b${escapeRegex(word.toLowerCase())}\\b`, weight: 1 });
  }
  return rules;
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unknown database error'}`);
}

/**
 * Is this book already stored? Matches the Gutenberg URL, or the exact same
 * title (Gutenberg often has several editions of one work).
 */
export async function findStoredSource(
  admin: SupabaseClient,
  sourceUrl: string,
  title: string,
): Promise<{ id: string; status: string } | null> {
  for (const [column, value] of [
    ['source_url', sourceUrl],
    ['title', title],
  ] as const) {
    const found = await admin.from('sources').select('id, processing_status').eq(column, value).limit(1);
    if (found.error) {
      fail('Duplicate check failed', found.error);
    }
    const row = found.data[0];
    if (row) {
      return { id: String(row.id), status: String(row.processing_status) };
    }
  }
  return null;
}

/** Store the book. Returns the new source id and its passages with database ids. */
export async function storeBook(
  admin: SupabaseClient,
  book: BookFile,
  sha256: string | null,
): Promise<{ sourceId: string; passages: Array<{ id: number; content: string; sectionTitle: string | null }> }> {
  const inserted = await admin
    .from('sources')
    .insert({
      kind: 'book',
      title: book.title,
      authors: book.authors ? [book.authors] : [],
      publisher: 'Project Gutenberg',
      language: 'en',
      source_url: book.sourceUrl,
      acquisition_notes: `Project Gutenberg ebook #${book.gutenbergId} (EPUB, no images), found automatically by the librarian on ${new Date().toISOString().slice(0, 10)}.`,
      file_sha256: sha256,
      file_format: 'epub',
      processing_status: 'extracting',
    })
    .select('id')
    .single();
  if (inserted.error || !inserted.data) {
    fail(`Could not insert source "${book.title}"`, inserted.error);
  }
  const sourceId = String(inserted.data.id);

  const licence = await admin.from('licensing_records').insert({
    source_id: sourceId,
    license_type: 'public_domain',
    rights_holder: null,
    license_url: book.sourceUrl,
    status: 'approved',
    reviewed_at: new Date().toISOString(),
    notes: `Project Gutenberg catalogue lists ebook #${book.gutenbergId} as public domain in the USA. Approved automatically under the owner's public-domain-only ingestion rule.`,
  });
  if (licence.error) {
    fail('Could not record the licence', licence.error);
  }

  const sectionRows = book.chapters.map(chapter => ({
    source_id: sourceId,
    kind: 'chapter',
    title: chapter.title ? chapter.title.slice(0, 300) : null,
    ordinal: chapter.ordinal,
    depth: 0,
  }));
  const sectionIds = new Map<number, string>();
  for (let start = 0; start < sectionRows.length; start += INSERT_BATCH) {
    const result = await admin
      .from('source_sections')
      .insert(sectionRows.slice(start, start + INSERT_BATCH))
      .select('id, ordinal');
    if (result.error || !result.data) {
      fail('Could not insert sections', result.error);
    }
    for (const row of result.data) {
      sectionIds.set(Number(row.ordinal), String(row.id));
    }
  }

  const passageRows = book.passages.map(passage => ({
    source_id: sourceId,
    section_id: sectionIds.get(passage.chapter) ?? null,
    ordinal: passage.ordinal,
    content: passage.content,
    language: 'en',
    token_count: Math.round(passage.words * 1.35),
  }));
  const stored: Array<{ id: number; content: string; sectionTitle: string | null }> = [];
  const titles = new Map(book.chapters.map(chapter => [chapter.ordinal, chapter.title]));
  for (let start = 0; start < passageRows.length; start += INSERT_BATCH) {
    const result = await admin
      .from('passages')
      .insert(passageRows.slice(start, start + INSERT_BATCH))
      .select('id, ordinal');
    if (result.error || !result.data) {
      fail(`Could not insert passages (from ${start})`, result.error);
    }
    const byOrdinal = new Map(book.passages.map(passage => [passage.ordinal, passage]));
    for (const row of result.data) {
      const source = byOrdinal.get(Number(row.ordinal));
      if (source) {
        stored.push({ id: Number(row.id), content: source.content, sectionTitle: titles.get(source.chapter) ?? null });
      }
    }
  }

  const ready = await admin.from('sources').update({ processing_status: 'ready' }).eq('id', sourceId);
  if (ready.error) {
    fail('Could not mark the source ready', ready.error);
  }
  return { sourceId, passages: stored };
}

/** Remove a source left half-stored by a crashed run (cascades to its rows). */
export async function removeSource(admin: SupabaseClient, sourceId: string): Promise<void> {
  const removed = await admin.from('sources').delete().eq('id', sourceId);
  if (removed.error) {
    fail('Could not clear a partial source', removed.error);
  }
}

/** Create the concept if new, attach it to the category, and return its id. */
export async function ensureConcept(
  admin: SupabaseClient,
  categoryId: string,
  concept: CuratedConcept,
  description: string,
): Promise<{ id: string; created: boolean }> {
  const found = await admin.from('concepts').select('id').ilike('name', concept.name).maybeSingle();
  if (found.error) {
    fail(`Concept lookup for "${concept.name}" failed`, found.error);
  }
  let id: string;
  let created = false;
  if (found.data) {
    id = String(found.data.id);
  } else {
    const insertedConcept = await admin
      .from('concepts')
      .insert({ name: concept.name, description, difficulty: 3, status: 'approved' })
      .select('id')
      .single();
    if (insertedConcept.error || !insertedConcept.data) {
      fail(`Could not insert concept "${concept.name}"`, insertedConcept.error);
    }
    id = String(insertedConcept.data.id);
    created = true;
  }
  const link = await admin
    .from('category_concepts')
    .upsert(
      { category_id: categoryId, concept_id: id, relevance: 3 },
      { onConflict: 'category_id,concept_id', ignoreDuplicates: true },
    );
  if (link.error) {
    fail(`Could not attach "${concept.name}" to its category`, link.error);
  }
  return { id, created };
}

/** Link the best-matching passages to a concept. Returns how many links were written. */
export async function linkConcept(
  admin: SupabaseClient,
  conceptId: string,
  concept: CuratedConcept,
  passages: Array<{ id: number; content: string; sectionTitle: string | null }>,
): Promise<number> {
  const scored = scorePassages(passages, keywordsFor(concept));
  const top = pickTopPassages(scored, LINKS_PER_CONCEPT, MIN_LINK_SCORE);
  if (top.length === 0) {
    return 0;
  }
  const best = top[0]?.score ?? 1;
  const rows = top.map(entry => ({
    passage_id: passages[entry.index].id,
    concept_id: conceptId,
    confidence: Math.round(Math.min(1, entry.score / best) * 100) / 100,
    method: LINK_METHOD,
  }));
  const linked = await admin.from('passage_concepts').upsert(rows, { onConflict: 'passage_id,concept_id' });
  if (linked.error) {
    fail(`Could not link passages to "${concept.name}"`, linked.error);
  }
  return rows.length;
}
