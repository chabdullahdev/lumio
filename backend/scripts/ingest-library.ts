/**
 * Ingest the public-domain reading list into the knowledge library.
 *
 *   download EPUB (Project Gutenberg) -> parse -> chapters -> ~250-word passages
 *   -> sources + licensing_records (approved, public domain) + source_sections + passages
 *   -> concepts + category_concepts -> passage_concepts (best keyword matches)
 *
 * Safe to re-run: books already stored (same Gutenberg URL or file hash) are
 * skipped, concepts are matched by name, and keyword links are replaced rather
 * than duplicated. The licence record is written before any passage, and the
 * source only becomes `ready` once everything else has been stored.
 *
 * Usage (from backend/):
 *   node scripts/ingest-library.ts                 # dry run: parse + report, no database
 *   node --env-file-if-exists=.env scripts/ingest-library.ts --apply
 *   ... --only 3207,1232      restrict to some Gutenberg ids
 *   ... --cache <dir>         where downloaded EPUBs are kept
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBackendEnv } from '../src/env.ts';
import { getSupabaseAdmin } from '../src/supabase-admin.ts';
import { BOOKS, CONCEPTS, type CatalogBook } from '../src/library/catalog.ts';
import { parseEpub } from '../src/library/epub.ts';
import {
  buildSections,
  pickTopPassages,
  scorePassages,
  splitIntoPassages,
  type BookSection,
  type StoredPassage,
} from '../src/library/passages.ts';

const LINKS_PER_CONCEPT = 12;
const MIN_LINK_SCORE = 4;
const MIN_LINKS_WARNING = 6;
const INSERT_BATCH = 200;
const LINK_METHOD = 'keyword_match';

type Args = { apply: boolean; show: boolean; only: Set<number> | null; cache: string };

function parseArgs(argv: string[]): Args {
  const only = argv.indexOf('--only');
  const cache = argv.indexOf('--cache');
  return {
    apply: argv.includes('--apply'),
    show: argv.includes('--show'),
    only: only >= 0 ? new Set((argv[only + 1] ?? '').split(',').map(Number)) : null,
    cache: cache >= 0 ? (argv[cache + 1] ?? '') : join(tmpdir(), 'lumio-epubs'),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unknown database error'}`);
}

function sourceUrl(book: CatalogBook): string {
  return `https://www.gutenberg.org/ebooks/${book.gutenbergId}`;
}

async function fetchEpub(book: CatalogBook, cache: string): Promise<Buffer> {
  const file = join(cache, `${book.gutenbergId}.epub`);
  try {
    return await readFile(file);
  } catch {
    // not cached yet
  }
  const response = await fetch(`https://www.gutenberg.org/ebooks/${book.gutenbergId}.epub.noimages`, {
    headers: { 'user-agent': 'LUMIO-library-ingest/1.0 (public-domain reading list)' },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Download of #${book.gutenbergId} failed with HTTP ${response.status}.`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(cache, { recursive: true });
  await writeFile(file, buffer);
  await sleep(2000); // be polite to Project Gutenberg
  return buffer;
}

type PreparedBook = {
  book: CatalogBook;
  sha256: string;
  size: number;
  sections: BookSection[];
  passages: StoredPassage[];
};

async function prepareBook(book: CatalogBook, cache: string): Promise<PreparedBook> {
  const buffer = await fetchEpub(book, cache);
  const parsed = parseEpub(buffer);
  const sections = buildSections(parsed.sections, book.include ? new RegExp(book.include, 'i') : undefined);
  const passages = sections.flatMap((section, index) => splitIntoPassages(index, section.paragraphs));
  if (passages.length < 10) {
    throw new Error(`#${book.gutenbergId} "${book.title}" produced only ${passages.length} passages; check the parser.`);
  }
  return {
    book,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    size: buffer.length,
    sections,
    passages,
  };
}

async function findExistingSource(
  admin: SupabaseClient,
  prepared: PreparedBook,
): Promise<{ id: string; status: string } | null> {
  const byUrl = await admin
    .from('sources')
    .select('id, processing_status')
    .eq('source_url', sourceUrl(prepared.book))
    .maybeSingle();
  if (byUrl.error) {
    fail('Duplicate check by URL failed', byUrl.error);
  }
  if (byUrl.data) {
    return { id: String(byUrl.data.id), status: String(byUrl.data.processing_status) };
  }
  const byHash = await admin
    .from('sources')
    .select('id, processing_status')
    .eq('file_sha256', prepared.sha256)
    .maybeSingle();
  if (byHash.error) {
    fail('Duplicate check by hash failed', byHash.error);
  }
  return byHash.data
    ? { id: String(byHash.data.id), status: String(byHash.data.processing_status) }
    : null;
}

/** Store one book. Returns the source id (existing or new) and whether it was new. */
async function storeBook(admin: SupabaseClient, prepared: PreparedBook): Promise<{ id: string; created: boolean }> {
  const { book } = prepared;
  const existing = await findExistingSource(admin, prepared);
  if (existing && existing.status === 'ready') {
    return { id: existing.id, created: false };
  }
  if (existing) {
    // A previous run died half way: remove the partial source (cascades) and redo it.
    const removed = await admin.from('sources').delete().eq('id', existing.id);
    if (removed.error) {
      fail('Could not clear a partial source', removed.error);
    }
  }

  const inserted = await admin
    .from('sources')
    .insert({
      kind: 'book',
      title: book.title,
      authors: book.authors,
      edition: book.edition,
      publisher: 'Project Gutenberg',
      published_year: book.publishedYear,
      language: 'en',
      source_url: sourceUrl(book),
      acquisition_notes: `Project Gutenberg ebook #${book.gutenbergId} (EPUB, no images), downloaded ${new Date().toISOString().slice(0, 10)}.`,
      file_sha256: prepared.sha256,
      file_format: 'epub',
      file_size_bytes: prepared.size,
      processing_status: 'extracting',
    })
    .select('id')
    .single();
  if (inserted.error || !inserted.data) {
    fail(`Could not insert source "${book.title}"`, inserted.error);
  }
  const sourceId = String(inserted.data.id);

  // Licence first: nothing is usable without an approved record.
  const licence = await admin.from('licensing_records').insert({
    source_id: sourceId,
    license_type: 'public_domain',
    rights_holder: null,
    license_url: sourceUrl(book),
    status: 'approved',
    reviewed_at: new Date().toISOString(),
    notes: `Project Gutenberg lists ebook #${book.gutenbergId} as public domain in the USA. Approved automatically under the owner's public-domain-only ingestion rule.`,
  });
  if (licence.error) {
    fail('Could not record the licence', licence.error);
  }

  const sectionRows = prepared.sections.map((section, index) => ({
    source_id: sourceId,
    kind: 'chapter',
    title: section.title ? section.title.slice(0, 300) : null,
    ordinal: index + 1,
    depth: 0,
  }));
  const sectionIds: string[] = [];
  for (let start = 0; start < sectionRows.length; start += INSERT_BATCH) {
    const result = await admin
      .from('source_sections')
      .insert(sectionRows.slice(start, start + INSERT_BATCH))
      .select('id, ordinal');
    if (result.error || !result.data) {
      fail('Could not insert sections', result.error);
    }
    for (const row of result.data) {
      sectionIds[Number(row.ordinal) - 1] = String(row.id);
    }
  }

  const passageRows = prepared.passages.map((passage, index) => ({
    source_id: sourceId,
    section_id: sectionIds[passage.sectionIndex] ?? null,
    ordinal: index + 1,
    content: passage.content,
    language: 'en',
    token_count: Math.round(passage.words * 1.35),
  }));
  for (let start = 0; start < passageRows.length; start += INSERT_BATCH) {
    const result = await admin.from('passages').insert(passageRows.slice(start, start + INSERT_BATCH));
    if (result.error) {
      fail(`Could not insert passages (from ${start})`, result.error);
    }
  }

  const ready = await admin.from('sources').update({ processing_status: 'ready' }).eq('id', sourceId);
  if (ready.error) {
    fail('Could not mark the source ready', ready.error);
  }
  return { id: sourceId, created: true };
}

type LinkablePassage = { id: number | null; content: string; sectionTitle: string | null };

async function loadStoredPassages(admin: SupabaseClient, sourceId: string): Promise<LinkablePassage[]> {
  const sections = new Map<string, string | null>();
  for (let from = 0; ; from += 1000) {
    const result = await admin.from('source_sections').select('id, title').eq('source_id', sourceId).range(from, from + 999);
    if (result.error) {
      fail('Could not read sections', result.error);
    }
    for (const row of result.data) {
      sections.set(String(row.id), row.title ? String(row.title) : null);
    }
    if (result.data.length < 1000) {
      break;
    }
  }
  const out: LinkablePassage[] = [];
  for (let from = 0; ; from += 1000) {
    const result = await admin
      .from('passages')
      .select('id, section_id, content')
      .eq('source_id', sourceId)
      .order('ordinal')
      .range(from, from + 999);
    if (result.error) {
      fail('Could not read passages', result.error);
    }
    for (const row of result.data) {
      out.push({
        id: Number(row.id),
        content: String(row.content),
        sectionTitle: row.section_id ? (sections.get(String(row.section_id)) ?? null) : null,
      });
    }
    if (result.data.length < 1000) {
      break;
    }
  }
  return out;
}

async function ensureConcept(
  admin: SupabaseClient,
  categoryId: string,
  concept: (typeof CONCEPTS)[number],
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
    const inserted = await admin
      .from('concepts')
      .insert({
        name: concept.name,
        description: concept.description,
        difficulty: concept.difficulty,
        status: 'approved',
      })
      .select('id')
      .single();
    if (inserted.error || !inserted.data) {
      fail(`Could not insert concept "${concept.name}"`, inserted.error);
    }
    id = String(inserted.data.id);
    created = true;
  }
  const link = await admin
    .from('category_concepts')
    .upsert(
      { category_id: categoryId, concept_id: id, relevance: concept.relevance },
      { onConflict: 'category_id,concept_id', ignoreDuplicates: true },
    );
  if (link.error) {
    fail(`Could not attach "${concept.name}" to its category`, link.error);
  }
  return { id, created };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const books = BOOKS.filter(book => !args.only || args.only.has(book.gutenbergId));
  const admin = args.apply ? getSupabaseAdmin(loadBackendEnv()) : null;
  console.log(`${args.apply ? 'APPLY' : 'DRY RUN'}: ${books.length} book(s), cache ${args.cache}`);

  // 1) Books -> passages.
  const stored = new Map<number, LinkablePassage[]>();
  let newBooks = 0;
  let skippedBooks = 0;
  for (const book of books) {
    const prepared = await prepareBook(book, args.cache);
    const words = prepared.passages.reduce((total, passage) => total + passage.words, 0);
    let note = 'parsed';
    let passages: LinkablePassage[];
    if (admin) {
      const result = await storeBook(admin, prepared);
      note = result.created ? 'stored' : 'already stored, skipped';
      if (result.created) {
        newBooks += 1;
      } else {
        skippedBooks += 1;
      }
      passages = await loadStoredPassages(admin, result.id);
    } else {
      passages = prepared.passages.map(passage => ({
        id: null,
        content: passage.content,
        sectionTitle: prepared.sections[passage.sectionIndex]?.title ?? null,
      }));
    }
    stored.set(book.gutenbergId, passages);
    console.log(
      `  #${book.gutenbergId} ${book.title.slice(0, 48).padEnd(48)} ${String(prepared.sections.length).padStart(4)} ch ${String(prepared.passages.length).padStart(5)} passages ${String(words).padStart(7)} words  [${note}]`,
    );
  }

  // 2) Concepts -> links.
  const categoryIds = new Map<string, string>();
  if (admin) {
    const categories = await admin.from('categories').select('id, name').is('parent_id', null);
    if (categories.error) {
      fail('Could not read categories', categories.error);
    }
    for (const row of categories.data) {
      categoryIds.set(String(row.name), String(row.id));
    }
  }

  let newConcepts = 0;
  let totalLinks = 0;
  const weak: string[] = [];
  const concepts = CONCEPTS.filter(concept => concept.books.every(id => stored.has(id)) || !args.only);
  for (const concept of concepts) {
    const pool: LinkablePassage[] = concept.books.flatMap(id => stored.get(id) ?? []);
    const scored = scorePassages(pool, concept.keywords, concept.sectionPattern);
    const top = pickTopPassages(scored, LINKS_PER_CONCEPT, MIN_LINK_SCORE);
    if (top.length < MIN_LINKS_WARNING) {
      weak.push(`${concept.category} / ${concept.name} (${top.length} links)`);
    }
    if (args.show) {
      console.log('  * ' + concept.category + ' / ' + concept.name);
      for (const entry of top.slice(0, 3)) {
        const passage = pool[entry.index];
        console.log('      [' + entry.score.toFixed(1) + '] ' + (passage?.sectionTitle ?? '-').slice(0, 30) + ' :: ' + (passage?.content ?? '').slice(0, 170).replace(/\s+/g, ' '));
      }
    }
    if (!admin) {
      continue;
    }
    const categoryId = categoryIds.get(concept.category);
    if (!categoryId) {
      throw new Error(`Category "${concept.category}" does not exist in the database.`);
    }
    const ensured = await ensureConcept(admin, categoryId, concept);
    if (ensured.created) {
      newConcepts += 1;
    }
    const cleared = await admin
      .from('passage_concepts')
      .delete()
      .eq('concept_id', ensured.id)
      .eq('method', LINK_METHOD);
    if (cleared.error) {
      fail('Could not replace old links', cleared.error);
    }
    const best = top[0]?.score ?? 1;
    const rows = top.flatMap(entry => {
      const passage = pool[entry.index];
      return passage?.id == null
        ? []
        : [
            {
              passage_id: passage.id,
              concept_id: ensured.id,
              confidence: Math.round(Math.min(1, entry.score / best) * 100) / 100,
              method: LINK_METHOD,
            },
          ];
    });
    if (rows.length > 0) {
      const linked = await admin.from('passage_concepts').upsert(rows, { onConflict: 'passage_id,concept_id' });
      if (linked.error) {
        fail(`Could not link passages to "${concept.name}"`, linked.error);
      }
    }
    totalLinks += rows.length;
    console.log(`  concept ${concept.category.padEnd(11)} ${concept.name.slice(0, 52).padEnd(52)} ${String(rows.length).padStart(2)} links`);
  }

  console.log(
    admin
      ? `Done: ${newBooks} book(s) stored, ${skippedBooks} skipped, ${newConcepts} concept(s) created, ${totalLinks} passage links.`
      : 'Dry run complete; nothing was written.',
  );
  if (weak.length > 0) {
    console.log(`WARNING: ${weak.length} concept(s) with fewer than ${MIN_LINKS_WARNING} links:`);
    for (const line of weak) {
      console.log(`  - ${line}`);
    }
    process.exitCode = 2;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
