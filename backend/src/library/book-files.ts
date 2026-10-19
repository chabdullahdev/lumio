/**
 * Turn a parsed book into the plain files LUMIO keeps for review:
 *
 *   book.md    — the whole book as readable Markdown (chapters as headings)
 *   book.json  — the same book as data: metadata, chapters, ~250-word passages
 *
 * Pure: returns strings, the script decides where to write them.
 */
import type { BookSection, StoredPassage } from './passages.ts';

export type BookMeta = {
  gutenbergId: number;
  title: string;
  authors: string;
  category: string;
  sourceUrl: string;
  license: string;
};

export function bookToMarkdown(meta: BookMeta, sections: BookSection[]): string {
  const lines = [
    `# ${meta.title}`,
    '',
    `- Author: ${meta.authors || 'Unknown'}`,
    `- Category: ${meta.category}`,
    `- Source: ${meta.sourceUrl}`,
    `- Licence: ${meta.license}`,
    '',
  ];
  sections.forEach((section, index) => {
    lines.push(`## ${section.title?.trim() || `Section ${index + 1}`}`, '');
    for (const paragraph of section.paragraphs) {
      lines.push(paragraph, '');
    }
  });
  return `${lines.join('\n').trimEnd()}\n`;
}

export function bookToJson(
  meta: BookMeta,
  sections: BookSection[],
  passages: StoredPassage[],
): string {
  return `${JSON.stringify(
    {
      ...meta,
      chapters: sections.map((section, index) => ({
        ordinal: index + 1,
        title: section.title,
        words: section.words,
      })),
      passages: passages.map((passage, index) => ({
        ordinal: index + 1,
        chapter: passage.sectionIndex + 1,
        words: passage.words,
        content: passage.content,
      })),
    },
    null,
    2,
  )}\n`;
}
