import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookToJson, bookToMarkdown } from '../src/library/book-files.ts';
import { buildCuratePrompt, parseCurateReply } from '../src/library/curate.ts';
import {
  candidatesByCategory,
  classifyEntry,
  parseCatalog,
  parseCsv,
  type CatalogEntry,
} from '../src/library/gutenberg-catalog.ts';

const entry = (over: Partial<CatalogEntry>): CatalogEntry => ({
  gutenbergId: 1,
  title: 'A Book',
  authors: 'Someone',
  issued: '2000-01-01',
  subjects: [],
  shelves: [],
  ...over,
});

test('parseCsv handles quotes, doubled quotes and newlines inside fields', () => {
  assert.deepEqual(parseCsv('a,b\n1,"x, ""y""\nz"\n'), [
    ['a', 'b'],
    ['1', 'x, "y"\nz'],
  ]);
});

test('parseCatalog keeps English text books only and the first title line', () => {
  const csv = [
    'Text#,Type,Issued,Title,Language,Authors,Subjects,LoCC,Bookshelves',
    '1,Text,2000-01-01,"Title\nSubtitle",en,"Doe, J.",Science; Physics,Q,Category: Science - Physics',
    '2,Sound,2000-01-01,Audio,en,X,,,',
    '3,Text,2000-01-01,Livre,fr,X,,,',
  ].join('\n');
  const entries = parseCatalog(csv);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'Title');
  assert.deepEqual(entries[0].subjects, ['Science', 'Physics']);
});

test('classifyEntry sorts by shelf and subject, and drops fiction and children books', () => {
  assert.equal(classifyEntry(entry({ shelves: ['Category: Science - Physics'] })), 'Science');
  assert.equal(classifyEntry(entry({ subjects: ['Islam -- History'] })), 'Islam');
  assert.equal(classifyEntry(entry({ subjects: ['Sea-power'] })), 'Geopolitics');
  assert.equal(classifyEntry(entry({ shelves: ['Category: Politics', 'Category: Novels'] })), null);
  assert.equal(classifyEntry(entry({ shelves: ['Category: Science - Biology', "Category: Children & Young Adult Reading"] })), null);
  assert.equal(classifyEntry(entry({ shelves: ['Category: Cooking & Drinking'] })), null);
});

test('candidatesByCategory puts quality-shelf books first', () => {
  const grouped = candidatesByCategory([
    entry({ gutenbergId: 5, shelves: ['Category: Politics'] }),
    entry({ gutenbergId: 9, shelves: ['Category: Politics', 'Harvard Classics'] }),
  ]);
  assert.deepEqual(grouped.get('Politics')?.map(item => item.gutenbergId), [9, 5]);
});

test('parseCurateReply drops invented ids, duplicates and bad entries', () => {
  const candidates = [entry({ gutenbergId: 10 }), entry({ gutenbergId: 20 })];
  const reply = JSON.stringify({
    picks: [
      { id: 10, reason: 'good', concepts: [{ name: 'One idea', keywords: ['Alpha', 'beta word'] }, 'Two idea'] },
      { id: 10, reason: 'dup', concepts: ['One idea'] },
      { id: 999, reason: 'invented', concepts: ['Made up'] },
      { id: 20, reason: 'no concepts', concepts: [] },
      'junk',
    ],
  });
  const picks = parseCurateReply(reply, candidates, 5);
  assert.deepEqual(picks.map(pick => pick.gutenbergId), [10]);
  assert.deepEqual(picks[0].concepts, [
    { name: 'One idea', keywords: ['alpha', 'beta word'] },
    { name: 'Two idea', keywords: ['idea'] },
  ]);
  assert.deepEqual(parseCurateReply('not json', candidates, 5), []);
});

test('parseCurateReply never returns more than the requested number', () => {
  const candidates = [entry({ gutenbergId: 1 }), entry({ gutenbergId: 2 })];
  const reply = JSON.stringify({
    picks: [
      { id: 1, concepts: [{ name: 'Alpha idea', keywords: ['a'] }] },
      { id: 2, concepts: ['Beta idea'] },
    ],
  });
  assert.equal(parseCurateReply(reply, candidates, 1).length, 1);
});

test('the curation prompt lists every candidate and names the category', () => {
  const messages = buildCuratePrompt('History', [entry({ gutenbergId: 42, title: 'Old Wars' })], 3);
  assert.ok(messages[1].content.includes('Category: History'));
  assert.ok(messages[1].content.includes('42 | Old Wars'));
});

test('book files include the chapters and passages', () => {
  const meta = { gutenbergId: 1, title: 'T', authors: 'A', category: 'History', sourceUrl: 'u', license: 'PD' };
  const sections = [{ title: 'One', paragraphs: ['Hello world.'], words: 2 }];
  const markdown = bookToMarkdown(meta, sections);
  assert.ok(markdown.includes('# T') && markdown.includes('## One') && markdown.includes('Hello world.'));
  const json = JSON.parse(bookToJson(meta, sections, [{ sectionIndex: 0, content: 'Hello world.', words: 2 }]));
  assert.equal(json.passages[0].chapter, 1);
});

test('evaluateTags says whether the model is installed', async () => {
  const { evaluateTags } = await import('../src/ollama-health.ts');
  assert.equal(evaluateTags({ models: [{ name: 'qwen3.5:9b' }] }, 'qwen3.5:9b').ok, true);
  const missing = evaluateTags({ models: [{ name: 'other:1b' }] }, 'qwen3.5:9b');
  assert.equal(missing.ok, false);
  assert.ok(!missing.ok && missing.reason.includes('ollama pull qwen3.5:9b'));
  assert.equal(evaluateTags('junk', 'qwen3.5:9b').ok, false);
});

test('keywordsFor weights the concept name and matches whole words only', async () => {
  const { keywordsFor } = await import('../src/library/store.ts');
  const rules = keywordsFor({ name: 'Sufi Traditions', keywords: ['dervish', 'c++'] });
  assert.equal(rules[0].weight, 3);
  assert.ok(new RegExp(rules[1].pattern, 'i').test('A Dervish arrived'));
  assert.ok(!new RegExp(rules[1].pattern, 'i').test('dervishes'));
  assert.ok(new RegExp(rules[0].pattern, 'i').test('the Sufi traditions of Persia'));
});
