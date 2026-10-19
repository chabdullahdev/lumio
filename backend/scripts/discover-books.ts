/**
 * Find new public-domain books for the LUMIO library, let the local AI choose
 * the best ones, and convert them to Markdown + JSON files for review.
 *
 *   catalogue  -> every English text book on Project Gutenberg (public domain)
 *   shortlist  -> plain rules sort books into LUMIO's six categories
 *   --curate   -> the local AI picks the best books + the concepts each teaches
 *   --fetch    -> download the picked books and convert them to book.md / book.json
 *
 * Nothing here talks to Supabase. Files go to backend/library-data/ (gitignored).
 *
 * Usage (from backend/):
 *   node scripts/discover-books.ts                       # dry run: counts + shortlist per category
 *   node scripts/discover-books.ts --category History    # one category only
 *   node scripts/discover-books.ts --curate              # ask the AI to choose (needs Ollama running)
 *   node scripts/discover-books.ts --fetch               # convert the AI's picks to files
 *   ... --shortlist 40 --pick 8 --model gemma4:12b --refresh
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORY_NAMES, BOOKS } from '../src/library/catalog.ts';
import { bookToJson, bookToMarkdown } from '../src/library/book-files.ts';
import { buildCuratePrompt, parseCurateReply, type CuratedPick } from '../src/library/curate.ts';
import { parseEpub } from '../src/library/epub.ts';
import {
  candidatesByCategory,
  parseCatalog,
  type CatalogEntry,
  type LumioCategory,
} from '../src/library/gutenberg-catalog.ts';
import { buildSections, splitIntoPassages } from '../src/library/passages.ts';
import { chatJson } from '../src/ollama.ts';

const CATALOG_URL = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv';
const USER_AGENT = 'LUMIO-library-discovery/1.0 (public-domain reading list)';
const MIN_PASSAGES = 10;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

type Args = {
  dir: string;
  category: LumioCategory | null;
  shortlist: number;
  pick: number;
  curate: boolean;
  fetch: boolean;
  refresh: boolean;
  model: string;
};

type CuratedFile = Record<string, CuratedPick[]>;

function parseArgs(argv: string[]): Args {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const category = value('--category');
  if (category && !(CATEGORY_NAMES as readonly string[]).includes(category)) {
    throw new Error(`--category must be one of: ${CATEGORY_NAMES.join(', ')}.`);
  }
  return {
    dir: value('--dir') ?? join(root, 'library-data'),
    category: (category as LumioCategory | undefined) ?? null,
    shortlist: Number(value('--shortlist') ?? 40),
    pick: Number(value('--pick') ?? 8),
    curate: argv.includes('--curate'),
    fetch: argv.includes('--fetch'),
    refresh: argv.includes('--refresh'),
    model: value('--model') ?? process.env.OLLAMA_MODEL ?? 'qwen3.5:9b',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function loadCatalog(dir: string, refresh: boolean): Promise<CatalogEntry[]> {
  const file = join(dir, 'pg_catalog.csv');
  let text: string | null = null;
  if (!refresh) {
    text = await readFile(file, 'utf8').catch(() => null);
  }
  if (text === null) {
    console.log('Downloading the Project Gutenberg catalogue (about 20 MB)...');
    const response = await fetch(CATALOG_URL, { headers: { 'user-agent': USER_AGENT } });
    if (!response.ok) {
      throw new Error(`Catalogue download failed with HTTP ${response.status}.`);
    }
    text = await response.text();
    await mkdir(dir, { recursive: true });
    await writeFile(file, text);
  }
  return parseCatalog(text);
}

/**
 * Books the AI should not be shown again: the hand-written reading list, plus
 * every book already picked or converted in an earlier round. This is what
 * makes each round of the librarian find NEW books.
 */
async function alreadyHandled(dir: string): Promise<Set<number>> {
  const handled = new Set(BOOKS.map(book => book.gutenbergId));
  const curated: CuratedFile = JSON.parse((await readFile(join(dir, 'curated.json'), 'utf8').catch(() => '{}')) || '{}');
  for (const picks of Object.values(curated)) {
    for (const pick of picks) {
      handled.add(pick.gutenbergId);
    }
  }
  for (const name of await readdir(join(dir, 'books')).catch(() => [] as string[])) {
    handled.add(Number(name));
  }
  return handled;
}

function shortlistFor(
  grouped: Map<LumioCategory, CatalogEntry[]>,
  category: LumioCategory,
  size: number,
  handled: Set<number>,
): CatalogEntry[] {
  return (grouped.get(category) ?? []).filter(entry => !handled.has(entry.gutenbergId)).slice(0, size);
}

async function installedModels(): Promise<string[]> {
  const base = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const response = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!response?.ok) {
    throw new Error(`Could not reach Ollama at ${base}. Start Ollama first.`);
  }
  const data = (await response.json()) as { models?: Array<{ name?: string }> };
  return (data.models ?? []).map(model => String(model.name));
}

async function curate(args: Args, grouped: Map<LumioCategory, CatalogEntry[]>): Promise<void> {
  const models = await installedModels();
  if (!models.includes(args.model)) {
    throw new Error(`Model "${args.model}" is not installed. Installed: ${models.join(', ')}. Use --model <name>.`);
  }
  const options = {
    baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
    model: args.model,
    timeoutMs: 600_000,
    numCtx: 8192,
    numPredict: 2048,
  };
  const file = join(args.dir, 'curated.json');
  const existing: CuratedFile = JSON.parse((await readFile(file, 'utf8').catch(() => '{}')) || '{}');
  const handled = await alreadyHandled(args.dir);

  for (const category of args.category ? [args.category] : CATEGORY_NAMES) {
    const candidates = shortlistFor(grouped, category, args.shortlist, handled);
    if (candidates.length === 0) {
      console.log(`  ${category}: no candidates`);
      continue;
    }
    console.log(`  ${category}: asking ${args.model} to choose from ${candidates.length} books...`);
    const reply = await chatJson(options, buildCuratePrompt(category, candidates, args.pick));
    const picks = parseCurateReply(reply, candidates, args.pick);
    existing[category] = [...(existing[category] ?? []), ...picks];
    for (const pick of picks) {
      const entry = candidates.find(candidate => candidate.gutenbergId === pick.gutenbergId);
      console.log(`     #${pick.gutenbergId} ${entry?.title.slice(0, 50)} — ${pick.concepts.map(concept => concept.name).join(', ')}`);
    }
    if (picks.length === 0) {
      console.log('     (the AI returned no valid picks)');
    }
  }
  await mkdir(args.dir, { recursive: true });
  await writeFile(file, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(`Saved the AI's picks to ${file}`);
}

async function fetchEpub(id: number): Promise<Buffer> {
  const response = await fetch(`https://www.gutenberg.org/ebooks/${id}.epub.noimages`, {
    headers: { 'user-agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function convert(args: Args, entries: CatalogEntry[]): Promise<void> {
  const curated: CuratedFile = JSON.parse(await readFile(join(args.dir, 'curated.json'), 'utf8').catch(() => '{}'));
  const byId = new Map(entries.map(entry => [entry.gutenbergId, entry]));
  let done = 0;
  for (const category of args.category ? [args.category] : CATEGORY_NAMES) {
    for (const pick of curated[category] ?? []) {
      const entry = byId.get(pick.gutenbergId);
      if (!entry) {
        continue;
      }
      const folder = join(args.dir, 'books', String(entry.gutenbergId));
      if (await readFile(join(folder, 'book.json')).then(() => true, () => false)) {
        console.log(`  #${entry.gutenbergId} ${entry.title.slice(0, 50)} — already converted`);
        continue;
      }
      try {
        const buffer = await fetchEpub(entry.gutenbergId);
        const sections = buildSections(parseEpub(buffer).sections);
        const passages = sections.flatMap((section, index) => splitIntoPassages(index, section.paragraphs));
        if (passages.length < MIN_PASSAGES) {
          console.log(`  #${entry.gutenbergId} ${entry.title.slice(0, 50)} — skipped (only ${passages.length} passages)`);
          continue;
        }
        const meta = {
          gutenbergId: entry.gutenbergId,
          title: entry.title,
          authors: entry.authors,
          category,
          sourceUrl: `https://www.gutenberg.org/ebooks/${entry.gutenbergId}`,
          license: 'Public domain in the USA (Project Gutenberg)',
        };
        await mkdir(folder, { recursive: true });
        await writeFile(join(folder, 'book.md'), bookToMarkdown(meta, sections));
        await writeFile(join(folder, 'book.json'), bookToJson(meta, sections, passages));
        await writeFile(
          join(folder, 'concepts.json'),
          `${JSON.stringify({ concepts: pick.concepts, reason: pick.reason, sha256: createHash('sha256').update(buffer).digest('hex') }, null, 2)}\n`,
        );
        done += 1;
        console.log(`  #${entry.gutenbergId} ${entry.title.slice(0, 50)} — ${sections.length} chapters, ${passages.length} passages`);
      } catch (error) {
        console.log(`  #${entry.gutenbergId} ${entry.title.slice(0, 50)} — FAILED: ${error instanceof Error ? error.message : String(error)}`);
      }
      await sleep(2000); // be polite to Project Gutenberg
    }
  }
  console.log(`Converted ${done} new book(s) into ${join(args.dir, 'books')}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const entries = await loadCatalog(args.dir, args.refresh);
  const grouped = candidatesByCategory(entries);
  console.log(`Catalogue: ${entries.length} English text books. Candidates per LUMIO category:`);
  for (const category of CATEGORY_NAMES) {
    console.log(`  ${category.padEnd(11)} ${String(grouped.get(category)?.length ?? 0).padStart(5)}`);
  }

  if (args.curate) {
    await curate(args, grouped);
  } else if (!args.fetch) {
    const handled = await alreadyHandled(args.dir);
    for (const category of args.category ? [args.category] : CATEGORY_NAMES) {
      console.log(`\nShortlist for ${category} (what the AI would choose from):`);
      for (const entry of shortlistFor(grouped, category, Math.min(args.shortlist, 10), handled)) {
        console.log(`  #${entry.gutenbergId} ${entry.title.slice(0, 60)} — ${entry.authors.slice(0, 30)}`);
      }
    }
    console.log('\nDry run only. Add --curate to let the AI choose, then --fetch to convert.');
  }
  if (args.fetch) {
    await convert(args, entries);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
