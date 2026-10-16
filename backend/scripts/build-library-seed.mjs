/**
 * Library seed builder (content authoring tool).
 *
 * Produces the SQL migration that seeds LUMIO's initial knowledge library from
 * a frozen snapshot of Wikipedia article extracts (CC BY-SA 4.0, attributed in
 * the sources table). The snapshot lives in supabase/seed/wikipedia-extracts.json
 * so the generated migration is reproducible byte-for-byte; migrations must
 * never change once applied.
 *
 * This is development seed content so the generation pipeline has something
 * real and traceable to work with. Before production, the library needs proper
 * review (see docs/SETUP.md).
 *
 * Usage (from backend/):
 *   node scripts/build-library-seed.mjs --fetch          # refresh the snapshot
 *   node scripts/build-library-seed.mjs --out ../../supabase/migrations/<file>.sql
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const here = import.meta.dirname;
const repoRoot = path.resolve(here, '..', '..');
const snapshotPath = path.join(repoRoot, 'supabase', 'seed', 'wikipedia-extracts.json');

/** Deterministic UUIDs so the seed is idempotent and re-runnable. */
function uuid(prefix, n) {
  const head = (prefix + '00000000').slice(0, 8);
  return `${head}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

// Editorial mapping: which article teaches which concepts, for which subject.
// All content must trace to the article text; concepts are the retrieval keys
// the lesson generator selects from.
const PLAN = [
  {
    topicSlug: 'science',
    source: {
      id: uuid('5eed000', 1),
      title: 'Photosynthesis',
      article: 'Photosynthesis',
      concepts: [
        {
          id: uuid('c0ce000', 1),
          name: 'Photosynthesis',
          description: 'How plants, algae and some bacteria convert light into chemical energy.',
          difficulty: 2,
          relevance: 5,
        },
        {
          id: uuid('c0ce000', 2),
          name: 'Primary production',
          description: 'The conversion of light energy into organic matter at the base of food chains.',
          difficulty: 3,
          relevance: 4,
        },
      ],
    },
  },
  {
    topicSlug: 'history',
    source: {
      id: uuid('5eed000', 2),
      title: 'Rosetta Stone',
      article: 'Rosetta Stone',
      concepts: [
        {
          id: uuid('c0ce000', 3),
          name: 'The Rosetta Stone',
          description: 'The trilingual stele that provided the key to reading Egyptian scripts.',
          difficulty: 2,
          relevance: 5,
        },
        {
          id: uuid('c0ce000', 4),
          name: 'Decipherment of Egyptian hieroglyphs',
          description: 'How scholars, above all Champollion, learned to read hieroglyphs.',
          difficulty: 3,
          relevance: 4,
        },
      ],
    },
  },
  {
    topicSlug: 'psychology',
    source: {
      id: uuid('5eed000', 3),
      title: 'Spacing effect',
      article: 'Spacing effect',
      concepts: [
        {
          id: uuid('c0ce000', 5),
          name: 'The spacing effect',
          description: 'Distributed practice produces more durable learning than massed practice.',
          difficulty: 2,
          relevance: 5,
        },
      ],
    },
  },
  {
    topicSlug: 'psychology',
    source: {
      id: uuid('5eed000', 4),
      title: 'Testing effect',
      article: 'Testing effect',
      concepts: [
        {
          id: uuid('c0ce000', 6),
          name: 'The testing effect',
          description: 'Retrieving information from memory strengthens it more than re-reading.',
          difficulty: 2,
          relevance: 5,
        },
      ],
    },
  },
  {
    topicSlug: 'islam',
    source: {
      id: uuid('5eed000', 5),
      title: 'House of Wisdom',
      article: 'House of Wisdom',
      concepts: [
        {
          id: uuid('c0ce000', 7),
          name: 'The House of Wisdom',
          description: 'The Abbasid library and translation hub in Baghdad.',
          difficulty: 3,
          relevance: 5,
        },
        {
          id: uuid('c0ce000', 8),
          name: 'The Graeco-Arabic translation movement',
          description: 'The translation of Greek learning into Arabic in the Abbasid era.',
          difficulty: 3,
          relevance: 4,
        },
      ],
    },
  },
  {
    topicSlug: 'geopolitics',
    source: {
      id: uuid('5eed000', 6),
      title: 'Strait of Malacca',
      article: 'Strait of Malacca',
      concepts: [
        {
          id: uuid('c0ce000', 9),
          name: 'Maritime choke points',
          description: 'Narrow sea lanes where global trade concentrates and strategy follows.',
          difficulty: 3,
          relevance: 4,
        },
        {
          id: uuid('c0ce000', 10),
          name: 'The Strait of Malacca',
          description: 'The busiest sea lane between the Indian Ocean and East Asia.',
          difficulty: 2,
          relevance: 5,
        },
      ],
    },
  },
  {
    topicSlug: 'politics',
    source: {
      id: uuid('5eed000', 7),
      title: 'Separation of powers',
      article: 'Separation of powers',
      concepts: [
        {
          id: uuid('c0ce000', 11),
          name: 'Separation of powers',
          description: 'Dividing lawmaking, enforcement and judging between institutions.',
          difficulty: 2,
          relevance: 5,
        },
        {
          id: uuid('c0ce000', 12),
          name: 'Checks and balances',
          description: 'Mutual constraints that let branches restrain one another.',
          difficulty: 3,
          relevance: 4,
        },
      ],
    },
  },
];

const STOP_SECTIONS = new Set([
  'references',
  'see also',
  'notes',
  'external links',
  'further reading',
  'bibliography',
  'sources',
  'citations',
  'footnotes',
]);

const MAX_SOURCE_WORDS = 2200;
const TARGET_PASSAGE_WORDS = 220;
const MAX_PASSAGE_WORDS = 300;
const MIN_PARAGRAPH_WORDS = 18;

function cleanText(text) {
  return text
    .replace(/\[\d+\]/g, '') // citation markers
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cut the extract at the first boilerplate section heading. */
function meaningfulLines(extract) {
  const lines = extract.split('\n');
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^=+\s*(.+?)\s*=+$/);
    if (heading) {
      if (STOP_SECTIONS.has(heading[1].toLowerCase())) {
        break;
      }
      continue;
    }
    if (line.length === 0) {
      continue;
    }
    out.push(line);
  }
  return out;
}

/** Chunk cleaned paragraphs into passage-sized pieces. */
function toPassages(extract) {
  const paragraphs = meaningfulLines(extract)
    .map(cleanText)
    .filter(text => text.split(' ').length >= MIN_PARAGRAPH_WORDS);

  const passages = [];
  let current = [];
  let currentWords = 0;
  const flush = () => {
    if (current.length > 0) {
      passages.push(current.join('\n\n'));
      current = [];
      currentWords = 0;
    }
  };

  let totalWords = 0;
  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ').length;
    if (totalWords >= MAX_SOURCE_WORDS) {
      break;
    }
    if (currentWords + words > MAX_PASSAGE_WORDS) {
      flush();
    }
    current.push(paragraph);
    currentWords += words;
    totalWords += words;
    if (currentWords >= TARGET_PASSAGE_WORDS) {
      flush();
    }
  }
  flush();
  return passages;
}

async function fetchExtract(title) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('prop', 'extracts');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('redirects', '1');
  url.searchParams.set('titles', title);

  const response = await fetch(url, {
    headers: {
      'user-agent': 'LUMIO-dev-seed/0.1 (local development; contact: project owner)',
    },
  });
  if (!response.ok) {
    throw new Error(`Wikipedia API answered ${response.status} for "${title}"`);
  }
  const data = await response.json();
  const pages = data?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || !page.extract) {
    throw new Error(`No extract returned for "${title}"`);
  }
  return { extract: page.extract, pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` };
}

async function loadSnapshot({ fetchMissing }) {
  let snapshot = null;
  try {
    snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  } catch {
    snapshot = null;
  }
  snapshot = snapshot ?? {};

  let changed = false;
  for (const entry of PLAN) {
    const key = entry.source.article;
    if (!snapshot[key] && fetchMissing) {
      const { extract, pageUrl } = await fetchExtract(entry.source.article);
      snapshot[key] = { title: entry.source.article, pageUrl, fetchedAt: new Date().toISOString(), extract };
      changed = true;
      console.error(`fetched "${key}" (${extract.length} chars)`);
    }
    if (!snapshot[key]) {
      throw new Error(
        `Snapshot missing extract for "${key}". Run with --fetch once (then commit the snapshot).`,
      );
    }
  }
  if (changed) {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.error(`snapshot written to ${path.relative(repoRoot, snapshotPath)}`);
  }
  return snapshot;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function dollarQuote(text, tagBase) {
  let tag = tagBase;
  let counter = 0;
  while (text.includes(`$${tag}$`)) {
    counter += 1;
    tag = `${tagBase}${counter}`;
  }
  return `$${tag}$${text}$${tag}$`;
}

function buildSql(snapshot) {
  const lines = [];
  lines.push('-- LUMIO — 11: seed the initial knowledge library.');
  lines.push('--');
  lines.push('-- Generated by backend/scripts/build-library-seed.mjs from the frozen snapshot');
  lines.push('-- supabase/seed/wikipedia-extracts.json (Wikipedia, CC BY-SA 4.0; attribution is');
  lines.push('-- stored per source). Development seed content: sufficient for the generation');
  lines.push('-- pipeline, still subject to library review before production.');
  lines.push('--');
  lines.push('-- Idempotent: fixed ids for sources/concepts, guarded inserts for passages.');
  lines.push('');

  for (const [planIndex, entry] of PLAN.entries()) {
    const { source } = entry;
    const licenseNumber = planIndex + 1;
    const snapshotEntry = snapshot[source.article];
    const passages = toPassages(snapshotEntry.extract);

    lines.push(`-- ${entry.topicSlug}: ${source.title} (${passages.length} passages)`);
    lines.push('');
    lines.push('insert into public.sources');
    lines.push(
      '  (id, kind, title, authors, publisher, language, source_url, acquisition_notes, processing_status)',
    );
    lines.push('values (');
    lines.push(`  ${sqlString(source.id)}::uuid,`);
    lines.push(`  'article',`);
    lines.push(`  ${sqlString(snapshotEntry.title ?? source.title)},`);
    lines.push(`  array['Wikipedia contributors'],`);
    lines.push(`  'Wikimedia Foundation',`);
    lines.push(`  'en',`);
    lines.push(`  ${sqlString(snapshotEntry.pageUrl)},`);
    lines.push(
      `  ${sqlString(`Wikipedia extract snapshot ${snapshotEntry.fetchedAt ?? 'unknown'} (CC BY-SA 4.0)`)} ,`,
    );
    lines.push(`  'ready'`);
    lines.push(') on conflict (id) do nothing;');
    lines.push('');
    lines.push('insert into public.licensing_records');
    lines.push('  (id, source_id, license_type, rights_holder, license_url, status, reviewed_at, notes)');
    lines.push('values (');
    lines.push(`  ${sqlString(uuid('11ce000', licenseNumber))}::uuid,`);
    lines.push(`  ${sqlString(source.id)}::uuid,`);
    lines.push(`  'cc_by_sa',`);
    lines.push(`  'Wikipedia contributors',`);
    lines.push(`  'https://creativecommons.org/licenses/by-sa/4.0/',`);
    lines.push(`  'approved',`);
    lines.push(`  now(),`);
    lines.push(
      `  ${sqlString('Seeded development content: attributed CC BY-SA 4.0 text; re-review before production.')}`,
    );
    lines.push(') on conflict (id) do nothing;');
    lines.push('');

    for (const concept of source.concepts) {
      lines.push('insert into public.concepts (id, name, description, difficulty, status)');
      lines.push('values (');
      lines.push(`  ${sqlString(concept.id)}::uuid,`);
      lines.push(`  ${sqlString(concept.name)},`);
      lines.push(`  ${sqlString(concept.description)},`);
      lines.push(`  ${concept.difficulty},`);
      lines.push(`  'approved'`);
      lines.push(') on conflict do nothing;');
      lines.push('');
      lines.push('insert into public.category_concepts (category_id, concept_id, relevance)');
      lines.push(
        `select c.id, ${sqlString(concept.id)}::uuid, ${concept.relevance} from public.categories c`,
      );
      lines.push(
        ` where c.slug = ${sqlString(entry.topicSlug)} and c.parent_id is null`,
      );
      lines.push('on conflict do nothing;');
      lines.push('');
    }

    passages.forEach((passage, index) => {
      const ordinal = index + 1;
      lines.push('insert into public.passages (source_id, ordinal, content, language)');
      lines.push('values (');
      lines.push(`  ${sqlString(source.id)}::uuid,`);
      lines.push(`  ${ordinal},`);
      lines.push(`  ${dollarQuote(passage, 'passage')},`);
      lines.push(`  'en'`);
      lines.push(') on conflict (source_id, ordinal) do nothing;');
      lines.push('');
      for (const concept of source.concepts) {
        lines.push('insert into public.passage_concepts (passage_id, concept_id, confidence, method)');
        lines.push('select p.id, ' + sqlString(concept.id) + '::uuid, 0.8, ' + sqlString('manual_seed'));
        lines.push('  from public.passages p');
        lines.push(
          ` where p.source_id = ${sqlString(source.id)}::uuid and p.ordinal = ${ordinal}`,
        );
        lines.push('on conflict do nothing;');
        lines.push('');
      }
    });

    lines.push('');
  }

  return lines.join('\n');
}

const args = process.argv.slice(2);
const fetchMissing = args.includes('--fetch');
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? args[outIndex + 1] : null;

const snapshot = await loadSnapshot({ fetchMissing });
const sql = buildSql(snapshot);

if (outPath) {
  const absolute = path.resolve(process.cwd(), outPath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, `${sql}\n`, 'utf8');
  console.error(`SQL written to ${absolute}`);
} else {
  process.stdout.write(sql);
}
