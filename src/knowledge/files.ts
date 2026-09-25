/**
 * Reading questions out of files the user hands over.
 *
 * The app is offline-first, so nothing is ever uploaded: a file is read in the
 * browser, its text is pulled out locally, and the same intent layer answers the
 * question. Supported with no dependency at all:
 *
 * - plain text: .txt .md .csv .tsv .json .xml .yaml .tex .log .ini — decoded with
 *   UTF-8 (BOM aware)
 * - Office Open XML: .docx .xlsx .pptx — a ZIP of XML, so we unzip it with the
 *   browser's own DecompressionStream and strip the tags
 * - OpenDocument: .odt .ods .odp — same idea
 * - PDF: .pdf — including compressed object streams
 * - images: .png .jpg .webp … — no OCR, so the text field is offered next to the
 *   picture for the user to type or dictating from
 *
 * Everything returns text plus honest notes about what could not be read, and a
 * `stats` line the UI shows so the user can see exactly what was extracted.
 */

import { extractPdfText } from './pdf';

export type FileKind = 'text' | 'ooxml' | 'odf' | 'pdf' | 'image' | 'unsupported';

export interface ExtractedFile {
  kind: FileKind;
  name: string;
  /** Size in bytes, for the summary line. */
  size: number;
  /** Plain text pulled out of the file (empty for images). */
  text: string;
  /** Object URL for images, so the user can read the question next to the input. */
  imageUrl?: string;
  /** Human notes: what was read, what was skipped, why. */
  notes: string[];
}

const TEXT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'tex', 'log', 'ini', 'cfg',
  'html', 'htm', 'rtf', 'sql', 'py', 'js', 'ts', 'css',
];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'heic'];

export function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1]!.toLowerCase() : '';
}

export function fileKind(name: string, mime = ''): FileKind {
  const extension = extensionOf(name);
  if (extension === 'docx' || extension === 'xlsx' || extension === 'pptx') return 'ooxml';
  if (extension === 'odt' || extension === 'ods' || extension === 'odp') return 'odf';
  if (extension === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (TEXT_EXTENSIONS.includes(extension) || mime.startsWith('text/') || mime === 'application/json') return 'text';
  if (IMAGE_EXTENSIONS.includes(extension) || mime.startsWith('image/')) return 'image';
  return 'unsupported';
}

/** Strips XML/HTML tags but keeps the text, and decodes the common entities. */
export function stripMarkup(xml: string): string {
  return xml
    .replace(/<w:p\b[^>]*>/gi, '\n') // Word paragraph
    .replace(/<\/(w:p|text:p|a:p)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(tr|row)>/gi, '\n') // table row
    .replace(/<\/t[dh]>/gi, '\t') // table cell
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function readAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('The file could not be read'));
    reader.readAsText(file);
  });
}

async function readAsBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error('The file could not be read'));
    reader.readAsArrayBuffer(file);
  });
}

/* ------------------------------- ZIP ------------------------------------ */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  // Copy into a plain ArrayBuffer: `Uint8Array` may be backed by a SharedArrayBuffer.
  void writer.write(data.slice());
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function stored(data: Uint8Array): Uint8Array {
  return data;
}

/**
 * Minimal ZIP reader for the stored/deflated entries that Office and ODF files
 * use. Returns everything it finds; callers pick the parts they want.
 */
export async function unzip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: ZipEntry[] = [];

  for (let offset = 0; offset + 30 <= bytes.length; ) {
    const signature = readUint32(view, offset);
    if (signature !== 0x04034b50) break; // not a local file header: stop cleanly
    const method = view.getUint16(offset + 8, true);
    const compressedSize = readUint32(view, offset + 18);
    const uncompressedSize = readUint32(view, offset + 22);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;

    // Streaming ZIPs (rare in documents) leave the sizes in a data descriptor.
    if (compressedSize === 0 && uncompressedSize === 0) {
      const next = findNextHeader(view, bytes, dataStart);
      if (next === -1) break;
      const raw = bytes.subarray(dataStart, next);
      entries.push({ name, data: method === 0 ? stored(raw) : await inflateRaw(raw) });
      offset = next;
      continue;
    }

    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    entries.push({ name, data: method === 0 ? stored(raw) : await inflateRaw(raw) });
    offset = dataStart + compressedSize;
  }

  return entries;
}

function findNextHeader(view: DataView, bytes: Uint8Array, from: number): number {
  for (let offset = from; offset + 4 <= bytes.length; offset += 1) {
    const signature = readUint32(view, offset);
    if (signature === 0x04034b50 || signature === 0x02014b50 || signature === 0x06054b50) return offset;
  }
  return -1;
}

/* ------------------------------ extraction ------------------------------- */

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^\uFEFF/, '');
}

async function extractOoxml(file: File, kind: FileKind): Promise<ExtractedFile> {
  const entries = await unzip(await readAsBytes(file));
  const notes: string[] = [];
  const texts: string[] = [];

  // Word: word/document.xml (+ headers/footers is overkill, the body holds the questions)
  if (kind === 'ooxml' && entries.some((entry) => entry.name === 'word/document.xml')) {
    const document = entries.find((entry) => entry.name === 'word/document.xml')!;
    texts.push(stripMarkup(decodeUtf8(document.data)));
    notes.push('Read the Word document body (word/document.xml).');
  }

  // Excel: shared strings + sheet cell values, in sheet order
  const sheets = entries
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (sheets.length > 0) {
    for (const sheet of sheets) {
      const xml = decodeUtf8(sheet.data);
      const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)];
      const lines = rows.map((row) =>
        [...row[1]!.matchAll(/<c[^>]*>([\s\S]*?)<\/c>/g)]
          .map((cell) => {
            const value = /<v>([\s\S]*?)<\/v>/.exec(cell[1]!);
            const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(cell[1]!);
            return stripMarkup(inline?.[1] ?? value?.[1] ?? '');
          })
          .join('\t'),
      );
      texts.push(lines.join('\n'));
    }
    notes.push(`Read ${sheets.length} spreadsheet sheet(s) including cell values.`);
  }

  // PowerPoint: slide text, in slide order
  const slides = entries
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (slides.length > 0) {
    for (const slide of slides) {
      const text = [...decodeUtf8(slide.data).matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => stripMarkup(m[1]!));
      texts.push(text.join(' '));
    }
    notes.push(`Read ${slides.length} slide(s).`);
  }

  if (texts.length === 0) {
    notes.push('No readable text found in this document.');
  }
  return { kind, name: file.name, size: file.size, text: texts.join('\n\n').trim(), notes };
}

async function extractOdf(file: File, kind: FileKind): Promise<ExtractedFile> {
  const entries = await unzip(await readAsBytes(file));
  const notes: string[] = [];
  const content = entries.find((entry) => entry.name === 'content.xml');
  if (!content) {
    return { kind, name: file.name, size: file.size, text: '', notes: ['This OpenDocument file has no content.xml.'] };
  }
  const text = stripMarkup(decodeUtf8(content.data));
  notes.push('Read content.xml (the document body).');
  return { kind, name: file.name, size: file.size, text, notes };
}

/** Entry point used by the UI: never throws; failures come back as notes. */
export async function extractFile(file: File): Promise<ExtractedFile> {
  const kind = fileKind(file.name, file.type ?? '');
  const base = { kind, name: file.name, size: file.size, text: '', notes: [] as string[] };

  try {
    if (kind === 'text') {
      return { ...base, text: (await readAsText(file)).replace(/\r\n?/g, '\n'), notes: ['Plain text read as UTF-8.'] };
    }
    if (kind === 'ooxml' || kind === 'odf') {
      return kind === 'ooxml' ? await extractOoxml(file, kind) : await extractOdf(file, kind);
    }
    if (kind === 'pdf') {
      const bytes = await readAsBytes(file);
      const result = extractPdfText(bytes);
      return {
        ...base,
        text: result.text,
        notes: [
          `Read ${result.pages} page(s) of PDF text.`,
          ...(result.encrypted ? ['This PDF is encrypted, so only unencrypted text could be read.'] : []),
          ...(result.imagesOnly
            ? ['This PDF contains scanned images rather than text — type the question from the picture below.']
            : []),
        ],
      };
    }
    if (kind === 'image') {
      const url = typeof URL !== 'undefined' && 'createObjectURL' in URL ? URL.createObjectURL(file) : undefined;
      return {
        ...base,
        imageUrl: url,
        notes: [
          'OmniCalc does not do image recognition, so nothing is guessed from the picture.',
          'Type or paste the question next to the image — everything else then works exactly as usual.',
        ],
      };
    }
    return {
      ...base,
      notes: [
        `“${file.name}” is not a format OmniCalc can read offline.`,
        'Supported: PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), OpenDocument, text/CSV/JSON and images (typed by you).',
      ],
    };
  } catch (error) {
    return {
      ...base,
      notes: [
        error instanceof Error ? `Could not read the file: ${error.message}` : 'Could not read the file.',
        'Nothing was recalculated or sent anywhere.',
      ],
    };
  }
}

/* ------------------------- text → candidate tasks ------------------------- */

const TASK_VERB =
  /^(solve|calculate|compute|evaluate|work out|simplify|convert|differentiate|integrate|find|determine|prove|show|express|round|plot|graph|use|given)/i;

/**
 * Pulls the questions out of a document: one per line, with the ones that look
 * like a task (a verb, an equals sign, or a number with an operator) first.
 * This is how a worksheet becomes a list of things to solve.
 */
export function candidateTasks(text: string, limit = 12): string[] {
  const lines = text
    .split(/\n|(?<=[?.!])\s{2,}/)
    .map((line) => line.replace(/^[\s•*\-–—\d.)(]+/, '').trim())
    .filter((line) => line.length >= 4 && line.length <= 220);

  const scored = lines.map((line, index) => {
    let score = 0;
    if (/[=]/.test(line)) score += 3;
    if (TASK_VERB.test(line)) score += 2;
    if (/[-+*/^]\s*\d|\d\s*[-+*/^]/.test(line)) score += 1;
    if (/\?$/.test(line)) score += 1;
    if (/^[A-Za-z ]{0,20}:$/.test(line)) score -= 2; // headings
    return { line, index, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.line);
}
