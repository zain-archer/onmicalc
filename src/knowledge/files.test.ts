import { describe, expect, it } from 'vitest';
import { candidateTasks, extractFile, extensionOf, fileKind, stripMarkup, unzip } from './files';
import { extractPdfText, pdfLiteralToString, textFromContentStream } from './pdf';

/* ----------------------------- zip test helpers --------------------------- */

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Builds a ZIP with "stored" entries — enough to exercise the reader. */
function makeZip(files: { name: string; content: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true); // stored
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    chunks.push(local);

    const header = new Uint8Array(46 + name.length);
    const centralView = new DataView(header.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    header.set(name, 46);
    central.push(header);
    offset += local.length;
  }

  const centralBytes = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralBytes, true);
  endView.setUint32(16, offset, true);

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + centralBytes + 22;
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of [...chunks, ...central, end]) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

function makeFile(name: string, content: string | Uint8Array, type = ''): File {
  const blobPart = typeof content === 'string' ? [content] : [content.slice()];
  return new File(blobPart as BlobPart[], name, { type });
}

/* --------------------------------- tests --------------------------------- */

describe('file intake — formats', () => {
  it('recognises what it can read', () => {
    expect(fileKind('questions.pdf')).toBe('pdf');
    expect(fileKind('homework.docx')).toBe('ooxml');
    expect(fileKind('marks.xlsx')).toBe('ooxml');
    expect(fileKind('slides.pptx')).toBe('ooxml');
    expect(fileKind('notes.odt')).toBe('odf');
    expect(fileKind('sums.txt')).toBe('text');
    expect(fileKind('data.csv')).toBe('text');
    expect(fileKind('scan.jpg')).toBe('image');
    expect(fileKind('archive.zip')).toBe('unsupported');
    expect(fileKind('no-extension', 'application/pdf')).toBe('pdf');
    expect(extensionOf('A.B.Csv')).toBe('csv');
  });

  it('reads plain text and CSV', async () => {
    const text = await extractFile(makeFile('sums.txt', 'solve 3x + 5 = 20\nconvert 5 km to miles'));
    expect(text.kind).toBe('text');
    expect(text.text).toContain('3x + 5 = 20');
    expect(candidateTasks(text.text)).toEqual(['solve 3x + 5 = 20', 'convert 5 km to miles']);

    const csv = await extractFile(makeFile('data.csv', 'x,y\n1,2\n3,4'));
    expect(csv.text.split('\n')).toHaveLength(3);
  });

  it('reads a Word document by unzipping it', async () => {
    const zip = makeZip([
      { name: 'word/document.xml', content: '<w:body><w:p><w:t>Solve 2x + 7 = 19</w:t></w:p><w:p><w:t>Integrate x^2 from 0 to 3</w:t></w:p></w:body>' },
      { name: '[Content_Types].xml', content: '<Types/>' },
    ]);
    const file = await extractFile(makeFile('homework.docx', zip));
    expect(file.kind).toBe('ooxml');
    expect(file.text).toContain('Solve 2x + 7 = 19');
    expect(file.text).toContain('Integrate x^2 from 0 to 3');
    expect(file.notes.join(' ')).toMatch(/Word document/);
  });

  it('reads a spreadsheet with its cell values', async () => {
    const zip = makeZip([
      {
        name: 'xl/worksheets/sheet1.xml',
        content:
          '<sheetData><row><c><v>1</v></c><c><is><t>percent</t></is></c></row><row><c><v>250</v></c></row></sheetData>',
      },
    ]);
    const file = await extractFile(makeFile('marks.xlsx', zip));
    expect(file.kind).toBe('ooxml');
    expect(file.text.split('\n')[0]).toBe('1\tpercent');
    expect(file.text).toContain('250');
  });

  it('reads slide text', async () => {
    const zip = makeZip([{ name: 'ppt/slides/slide1.xml', content: '<a:t>Find the determinant of</a:t><a:t>1 2; 3 4</a:t>' }]);
    const file = await extractFile(makeFile('lesson.pptx', zip));
    expect(file.text).toContain('Find the determinant of');
    expect(file.notes.join(' ')).toMatch(/slide/i);
  });

  it('reads OpenDocument content', async () => {
    const zip = makeZip([{ name: 'content.xml', content: '<office:body><text:p>What is 20 percent of 250?</text:p></office:body>' }]);
    const file = await extractFile(makeFile('notes.odt', zip));
    expect(file.kind).toBe('odf');
    expect(file.text).toContain('20 percent of 250');
  });

  it('reads PDF text including compressed streams', async () => {
    const plain = '%PDF-1.4\n1 0 obj\n<< /Length 40 >>\nstream\nBT (solve 3x + 5 = 20) Tj ET\nendstream\nendobj\n%%EOF';
    const result = extractPdfText(new TextEncoder().encode(plain));
    expect(result.text).toContain('solve 3x + 5 = 20');

    const compressed = await import('node:zlib');
    const body = 'BT (Integrate x^2 from 0 to 3) Tj ET';
    const deflated = compressed.deflateRawSync(Buffer.from(body, 'latin1'));
    const bytes = new Uint8Array(Buffer.concat([Buffer.from('%PDF-1.5\n1 0 obj\n<< /Filter /FlateDecode >>\nstream\n', 'latin1'), deflated, Buffer.from('\nendstream\nendobj\n', 'latin1')]));
    const file = await extractFile(makeFile('sheet.pdf', bytes, 'application/pdf'));
    expect(file.text).toContain('Integrate x^2 from 0 to 3');
    expect(file.notes.join(' ')).toMatch(/page/i);
  });

  it('handles a scanned PDF honestly instead of inventing text', () => {
    const scan = '%PDF-1.4\n1 0 obj\n<< /Subtype /Image /Length 3 >>\nstream\nabc\nendstream\nendobj';
    const result = extractPdfText(new TextEncoder().encode(scan));
    expect(result.text).toBe('');
    expect(result.imagesOnly).toBe(true);
  });

  it('never throws on a corrupt file', async () => {
    const file = await extractFile(makeFile('broken.docx', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])));
    expect(file.notes.length).toBeGreaterThan(0);
    expect(file.text).toBe('');
  });

  it('explains an unsupported format', async () => {
    const file = await extractFile(makeFile('archive.zip', 'PK'));
    expect(file.kind).toBe('unsupported');
    expect(file.notes.join(' ')).toMatch(/not a format OmniCalc can read/i);
  });

  it('shows images instead of guessing what they contain', async () => {
    const file = await extractFile(makeFile('question.png', new Uint8Array([1, 2, 3]), 'image/png'));
    expect(file.kind).toBe('image');
    expect(file.notes.join(' ')).toMatch(/does not do image recognition/i);
  });
});

describe('file intake — helpers', () => {
  it('strips markup and decodes entities', () => {
    expect(stripMarkup('<w:p><w:t>a &amp; b</w:t></w:p><w:p><w:t>c</w:t></w:p>').replace(/\n+/g, '\n')).toBe('a & b\nc');
    expect(stripMarkup('&lt;x&gt; &#65;')).toBe('<x> A');
  });

  it('unzips stored entries', async () => {
    const entries = await unzip(makeZip([{ name: 'a.txt', content: 'hello' }, { name: 'b.txt', content: 'world' }]));
    expect(entries.map((entry) => entry.name)).toEqual(['a.txt', 'b.txt']);
    expect(new TextDecoder().decode(entries[0]!.data)).toBe('hello');
  });

  it('decodes PDF string escapes and text operators', () => {
    expect(pdfLiteralToString('line\\nnext \\(x\\) \\101')).toBe('line\nnext (x) A');
    const content = 'BT 1 0 0 1 10 10 Tm (What is 2 + 2?) Tj ET';
    expect(textFromContentStream(content)).toContain('What is 2 + 2?');
  });

  it('finds the questions in a worksheet and ignores headings', () => {
    const worksheet = [
      'Chapter 4: Quadratics',
      '1. Solve x^2 - 5x + 6 = 0',
      '2. Find the turning point of y = x^2 - 4',
      'Remember to show your working.',
      '3. Integrate 2x from 1 to 3',
    ].join('\n');
    const tasks = candidateTasks(worksheet);
    expect(tasks).toContain('Solve x^2 - 5x + 6 = 0');
    expect(tasks).toContain('Integrate 2x from 1 to 3');
    expect(tasks.join(' ')).not.toContain('Chapter 4');
    expect(tasks.length).toBeLessThanOrEqual(12);
  });
});
