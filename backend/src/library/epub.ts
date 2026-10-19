/**
 * Minimal EPUB reader: unzip, follow the OPF spine, turn each XHTML file into
 * plain-text sections.
 *
 * No dependencies. The zip reader only supports "stored" and "deflate"
 * entries, which is all EPUB uses.
 */
import { inflateRawSync } from 'node:zlib';

export type EpubMetadata = {
  title: string;
  authors: string[];
};

export type RawSection = {
  title: string | null;
  /** Paragraphs of plain text, in reading order. */
  paragraphs: string[];
};

export type ParsedEpub = {
  metadata: EpubMetadata;
  sections: RawSection[];
};

/** Read every entry of a zip archive into memory, keyed by entry name. */
export function readZip(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65558); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error('Not a zip archive (no end-of-central-directory record).');
  }
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Corrupt zip central directory.');
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(start, start + compressedSize);
    if (method === 0) {
      entries.set(name, Buffer.from(data));
    } else if (method === 8) {
      entries.set(name, inflateRawSync(data));
    } else {
      throw new Error(`Unsupported zip compression method ${method} for ${name}.`);
    }
  }
  return entries;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  acirc: 'â',
  ecirc: 'ê',
  ocirc: 'ô',
  ccedil: 'ç',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  oelig: 'œ',
  aelig: 'æ',
  deg: '°',
  frac12: '½',
  times: '×',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Strip tags and normalise whitespace for one inline run of HTML. */
export function inlineText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove editorial noise Project Gutenberg and its transcribers add. */
export function cleanParagraph(text: string): string {
  return text
    .replace(/\[(?:Illustration|Footnote|Sidenote|Transcriber)[^\]]*\]/gi, ' ')
    .replace(/\[\d{1,3}\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HEADING = /<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;

/**
 * Split one XHTML document into sections at its headings and return each
 * section's paragraphs. Content before the first heading belongs to a section
 * with a null title.
 */
export function htmlToSections(html: string): RawSection[] {
  const body = (/<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, ' ')
    .replace(/<a\b[^>]*class="[^"]*pagenum[^"]*"[^>]*>[\s\S]*?<\/a>/gi, ' ')
    .replace(/<span\b[^>]*class="[^"]*pagenum[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ' ');

  const sections: RawSection[] = [];
  let title: string | null = null;
  let cursor = 0;
  const flush = (chunk: string): void => {
    const paragraphs = chunk
      .replace(/<\/(p|div|li|blockquote|tr|pre)>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .split(/\n\s*\n/)
      .map(part => cleanParagraph(inlineText(part)))
      .filter(part => part.length > 0);
    if (paragraphs.length > 0 || title !== null) {
      sections.push({ title, paragraphs });
    }
  };

  for (const match of body.matchAll(HEADING)) {
    flush(body.slice(cursor, match.index));
    const heading = inlineText(match[2] ?? '');
    title = heading.length > 0 ? heading : null;
    cursor = (match.index ?? 0) + match[0].length;
  }
  flush(body.slice(cursor));
  return sections;
}

function tagValues(xml: string, tag: string): string[] {
  const out: string[] = [];
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  for (const match of xml.matchAll(pattern)) {
    out.push(inlineText(match[1] ?? ''));
  }
  return out;
}

function resolvePath(base: string, href: string): string {
  const parts = (base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '').split('/');
  parts.pop();
  for (const piece of decodeURIComponent(href.split('#')[0] ?? '').split('/')) {
    if (piece === '..') {
      parts.pop();
    } else if (piece !== '.' && piece !== '') {
      parts.push(piece);
    }
  }
  return parts.join('/');
}

/**
 * Remove Project Gutenberg's licence header/footer blocks (elements with the
 * class "pg-boilerplate") while keeping the book text that shares the same
 * file. An unclosed block (the footer, when the file is cut mid-wrapper) is
 * removed to the end of the file.
 */
export function stripBoilerplate(html: string): string {
  let out = html;
  for (;;) {
    const start = out.search(/<(div|section)\b[^>]*\bpg-boilerplate\b[^>]*>/i);
    if (start < 0) {
      return out;
    }
    const tags = /<(\/?)(div|section)\b[^>]*>/gi;
    tags.lastIndex = start;
    let depth = 0;
    let end = out.length;
    for (let match = tags.exec(out); match !== null; match = tags.exec(out)) {
      depth += match[1] === '/' ? -1 : 1;
      if (depth === 0) {
        end = match.index + match[0].length;
        break;
      }
    }
    out = out.slice(0, start) + out.slice(end);
  }
}

export function parseEpub(buffer: Buffer): ParsedEpub {
  const files = readZip(buffer);
  const text = (name: string): string => {
    const entry = files.get(name);
    if (!entry) {
      throw new Error(`EPUB is missing ${name}.`);
    }
    return entry.toString('utf8');
  };

  const container = text('META-INF/container.xml');
  const opfPath = /full-path="([^"]+)"/i.exec(container)?.[1];
  if (!opfPath) {
    throw new Error('EPUB container does not name a package file.');
  }
  const opf = text(opfPath);

  const manifest = new Map<string, string>();
  for (const match of opf.matchAll(/<item\b[^>]*>/gi)) {
    const id = /\bid="([^"]+)"/i.exec(match[0])?.[1];
    const href = /\bhref="([^"]+)"/i.exec(match[0])?.[1];
    if (id && href) {
      manifest.set(id, resolvePath(opfPath, href));
    }
  }

  const sections: RawSection[] = [];
  for (const match of opf.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/gi)) {
    const path = manifest.get(match[1] ?? '');
    if (!path || !/\.(x?html?)$/i.test(path)) {
      continue;
    }
    const entry = files.get(path);
    if (!entry) {
      continue;
    }
    sections.push(...htmlToSections(stripBoilerplate(entry.toString('utf8'))));
  }

  return {
    metadata: {
      title: tagValues(opf, 'dc:title')[0] ?? 'Untitled',
      authors: tagValues(opf, 'dc:creator'),
    },
    sections,
  };
}
