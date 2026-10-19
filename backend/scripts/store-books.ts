/**
 * Save the books converted by `discover-books.ts` into Supabase.
 *
 * For every folder in backend/library-data/books/<id>/ that has book.json and
 * concepts.json and has not been stored yet:
 *   1. store the source, its approved public-domain licence, chapters, passages;
 *   2. create the concepts the AI chose and attach them to the book's category;
 *   3. link each concept to its best-matching passages (using the AI's keywords).
 * A `stored.json` marker is then written so the book is never stored twice.
 *
 * Usage (from backend/):
 *   node scripts/store-books.ts                                  # dry run: lists what would be stored
 *   node --env-file-if-exists=.env scripts/store-books.ts --apply
 *   ... --dir <library-data folder>
 *
 * The `--apply` run needs backend/.env (service-role key).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBackendEnv } from '../src/env.ts';
import { parseConcept, type CuratedConcept } from '../src/library/curate.ts';
import {
  ensureConcept,
  findStoredSource,
  linkConcept,
  removeSource,
  storeBook,
  type BookFile,
} from '../src/library/store.ts';
import { getSupabaseAdmin } from '../src/supabase-admin.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

type ConceptsFile = { concepts: CuratedConcept[]; reason?: string; sha256?: string };

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function categoryIds(admin: SupabaseClient): Promise<Map<string, string>> {
  const result = await admin.from('categories').select('id, name').is('parent_id', null);
  if (result.error) {
    throw new Error(`Could not read categories: ${result.error.message}`);
  }
  return new Map(result.data.map(row => [String(row.name), String(row.id)]));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const dirFlag = argv.indexOf('--dir');
  const dir = dirFlag >= 0 ? (argv[dirFlag + 1] ?? '') : join(root, 'library-data');
  const booksDir = join(dir, 'books');
  const folders = await readdir(booksDir).catch(() => [] as string[]);

  const pending: Array<{ folder: string; book: BookFile; concepts: ConceptsFile }> = [];
  for (const name of folders) {
    const folder = join(booksDir, name);
    if (await readJson(join(folder, 'stored.json'))) {
      continue;
    }
    const book = await readJson<BookFile>(join(folder, 'book.json'));
    const concepts = await readJson<ConceptsFile>(join(folder, 'concepts.json'));
    // Older files list plain names; parseConcept accepts both shapes.
    const parsed = (Array.isArray(concepts?.concepts) ? concepts.concepts : [])
      .map(parseConcept)
      .filter((concept): concept is CuratedConcept => concept !== null);
    if (book && concepts && parsed.length > 0) {
      pending.push({ folder, book, concepts: { ...concepts, concepts: parsed } });
    }
  }

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${pending.length} converted book(s) waiting to be stored.`);
  if (!apply) {
    for (const { book, concepts } of pending) {
      console.log(`  #${book.gutenbergId} [${book.category}] ${book.title.slice(0, 50)} — ${book.passages.length} passages, concepts: ${concepts.concepts.map(concept => concept.name).join(', ')}`);
    }
    console.log('Nothing was written. Add --apply to store them.');
    return;
  }
  if (pending.length === 0) {
    return;
  }

  const admin = getSupabaseAdmin(loadBackendEnv());
  const categories = await categoryIds(admin);
  let stored = 0;
  let failed = 0;
  for (const { folder, book, concepts } of pending) {
    try {
      const categoryId = categories.get(book.category);
      if (!categoryId) {
        throw new Error(`category "${book.category}" does not exist in the database`);
      }
      const existing = await findStoredSource(admin, book.sourceUrl, book.title);
      if (existing && existing.status === 'ready') {
        await writeFile(join(folder, 'stored.json'), `${JSON.stringify({ sourceId: existing.id, note: 'already in the database' })}\n`);
        console.log(`  #${book.gutenbergId} ${book.title.slice(0, 50)} — already in the database`);
        continue;
      }
      if (existing) {
        await removeSource(admin, existing.id);
      }
      const result = await storeBook(admin, book, concepts.sha256 ?? null);
      let links = 0;
      for (const concept of concepts.concepts) {
        const ensured = await ensureConcept(
          admin,
          categoryId,
          concept,
          `Chosen automatically from "${book.title}"${concepts.reason ? `: ${concepts.reason}` : ''}`.slice(0, 500),
        );
        links += await linkConcept(admin, ensured.id, concept, result.passages);
      }
      await writeFile(join(folder, 'stored.json'), `${JSON.stringify({ sourceId: result.sourceId, links, storedAt: new Date().toISOString() })}\n`);
      stored += 1;
      console.log(`  #${book.gutenbergId} ${book.title.slice(0, 50)} — stored, ${result.passages.length} passages, ${links} concept links`);
    } catch (error) {
      failed += 1;
      console.log(`  #${book.gutenbergId} ${book.title.slice(0, 50)} — FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`Done: ${stored} stored, ${failed} failed.`);
  if (failed > 0) {
    process.exitCode = 2;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
