import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOOKS, CATEGORY_NAMES, CONCEPTS } from '../src/library/catalog.ts';
import { decodeEntities, htmlToSections, stripBoilerplate } from '../src/library/epub.ts';
import {
  buildSections,
  countWords,
  isNoiseParagraph,
  pickTopPassages,
  scorePassages,
  splitIntoPassages,
} from '../src/library/passages.ts';

const words = (count: number, word = 'alpha'): string => Array.from({ length: count }, () => word).join(' ');

test('decodeEntities handles named and numeric entities', () => {
  assert.equal(decodeEntities('A &amp; B &mdash; &#8220;x&#x201D;'), 'A & B — “x”');
  assert.equal(decodeEntities('&unknown;'), '&unknown;');
});

test('htmlToSections splits at headings and drops markup', () => {
  const sections = htmlToSections(
    '<body><h2>Chapter I</h2><p>One <i>two</i> three.</p><p>Four.</p><h2>Chapter II</h2><p>Five.</p></body>',
  );
  assert.deepEqual(
    sections.map(section => [section.title, section.paragraphs]),
    [
      ['Chapter I', ['One two three.', 'Four.']],
      ['Chapter II', ['Five.']],
    ],
  );
});

test('stripBoilerplate removes the licence block but keeps the book text beside it', () => {
  const html =
    '<body><div class="pg-boilerplate pgheader" id="pg-header"><h2>The Project Gutenberg eBook</h2><div>licence</div></div><h2>Chapter I</h2><p>Real text.</p></body>';
  const cleaned = stripBoilerplate(html);
  assert.ok(!cleaned.includes('licence'));
  assert.ok(cleaned.includes('Real text.'));
});

test('stripBoilerplate removes an unclosed footer to the end of the file', () => {
  const cleaned = stripBoilerplate('<p>Keep</p><section class="pg-boilerplate pgheader footer"><p>End licence</p>');
  assert.ok(cleaned.includes('Keep'));
  assert.ok(!cleaned.includes('End licence'));
});

test('isNoiseParagraph flags footnotes, indexes and tables of contents', () => {
  assert.equal(isNoiseParagraph('29 ( return ) [ Augustus restored the severity of discipline. ]'), true);
  assert.equal(
    isNoiseParagraph('Aaron, 215 , 273 Abbad, 421 Abbadid, 414 , 421 Abbas, 146 , 249 , 250 , 251 Abbasa, 261 Cairo'),
    true,
  );
  assert.equal(isNoiseParagraph('I. The plan. II. The act. III. The end. IV. The rest of it all here'), true);
  assert.equal(isNoiseParagraph(`${words(40, 'ordinary')} prose goes here.`), false);
});

test('buildSections drops legal text and merges tiny sections into the previous one', () => {
  const sections = buildSections([
    { title: 'Contents', paragraphs: [words(300)] },
    { title: 'Chapter I', paragraphs: [words(300)] },
    { title: 'Aside', paragraphs: [words(20)] },
    { title: null, paragraphs: ['This is the Project Gutenberg licence text.'] },
    { title: 'Chapter II', paragraphs: [words(250)] },
  ]);
  assert.deepEqual(sections.map(section => section.title), ['Chapter I', 'Chapter II']);
  assert.equal(sections[0]?.words, 320);
});

test('buildSections can keep only chapters matching a filter', () => {
  const sections = buildSections(
    [
      { title: 'PERICLES', paragraphs: [words(300)] },
      { title: 'ALEXANDER', paragraphs: [words(300)] },
    ],
    /^alexander/i,
  );
  assert.deepEqual(sections.map(section => section.title), ['ALEXANDER']);
});

test('splitIntoPassages aims for ~250 words, keeps order and loses nothing', () => {
  const paragraphs = Array.from({ length: 20 }, (_, index) => words(80, `w${index}`));
  const passages = splitIntoPassages(0, paragraphs);
  const total = passages.reduce((sum, passage) => sum + passage.words, 0);
  assert.equal(total, 20 * 80);
  for (const passage of passages) {
    assert.ok(passage.words >= 90 && passage.words <= 340, `passage of ${passage.words} words`);
    assert.equal(countWords(passage.content), passage.words);
  }
  assert.ok(passages[0]!.content.startsWith('w0'));
});

test('splitIntoPassages breaks an over-long paragraph on sentence boundaries', () => {
  const sentence = `${words(24)}. `;
  const passages = splitIntoPassages(2, [sentence.repeat(40)]);
  assert.ok(passages.length >= 3);
  assert.ok(passages.every(passage => passage.sectionIndex === 2));
  for (const passage of passages) {
    assert.ok(passage.words <= 340);
    assert.ok(passage.content.trim().endsWith('.'));
  }
});

test('scorePassages ranks keyword-rich passages and honours the chapter bonus', () => {
  const scored = scorePassages(
    [
      { content: 'Nothing relevant here at all.', sectionTitle: 'Other' },
      { content: 'The state of nature is a war of every man against every man.', sectionTitle: 'Of the state of nature' },
      { content: 'A mention of the state of nature.', sectionTitle: 'Other' },
    ],
    [
      { pattern: 'state of nature', weight: 3 },
      { pattern: 'war of (every man|all)', weight: 3 },
    ],
    'state of nature',
  );
  const top = pickTopPassages(scored, 2, 3);
  assert.deepEqual(top.map(entry => entry.index), [1, 2]);
  assert.ok(top[0]!.score > top[1]!.score);
});

test('catalog: 10 new concepts per category, unique names, all books known and licensed sources only', () => {
  const bookIds = new Set(BOOKS.map(book => book.gutenbergId));
  assert.equal(bookIds.size, BOOKS.length, 'duplicate book ids');
  const names = new Set(CONCEPTS.map(concept => concept.name.toLowerCase()));
  assert.equal(names.size, CONCEPTS.length, 'duplicate concept names');
  for (const category of CATEGORY_NAMES) {
    assert.equal(CONCEPTS.filter(concept => concept.category === category).length, 10, category);
  }
  assert.equal(CONCEPTS.length, 60);
  for (const concept of CONCEPTS) {
    assert.ok(concept.books.length > 0 && concept.books.every(id => bookIds.has(id)), concept.name);
    assert.ok(concept.keywords.length > 0, concept.name);
    for (const keyword of concept.keywords) {
      assert.doesNotThrow(() => new RegExp(keyword.pattern, 'gi'), `${concept.name}: ${keyword.pattern}`);
    }
  }
  for (const book of BOOKS) {
    assert.ok(book.publishedYear >= 800 && book.publishedYear <= 2200, book.title);
  }
});
