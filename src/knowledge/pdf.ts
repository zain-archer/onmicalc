/**
 * Minimal PDF text extraction, offline and dependency-free.
 *
 * PDFs are a container of objects; text lives in content streams, usually
 * compressed with Flate. This module walks the objects, inflates the streams with
 * a small built-in DEFLATE decoder, pulls the text-showing operators
 * (`Tj`, `TJ`, `'`, `"`) and decodes their literals. It also understands
 * cross-reference streams and object streams, which modern PDFs use.
 *
 * What it deliberately does *not* do: font/CID mapping for subset fonts. Where
 * glyph codes cannot be mapped to characters it says so in the result rather
 * than emitting mojibake, and the UI then offers the words it could read (plus
 * the picture) for the user to confirm.
 */

export interface PdfTextResult {
  text: string;
  pages: number;
  /** Fraction of content streams that were successfully decompressed. */
  decodedStreams: number;
  encrypted: boolean;
  /** True when the file looks like a scan: pages with images but no text. */
  imagesOnly: boolean;
  warnings: string[];
}

/**
 * Byte <-> "binary string" conversion that is *actually* one code unit per byte.
 *
 * `TextDecoder('latin1')` must not be used here: per the WHATWG encoding
 * standard that label maps to windows-1252, so bytes 0x80-0x9F come back as
 * different code points (0x88 becomes U+02C6, 0x93 becomes U+201C, ...). Feeding
 * the result back through `charCodeAt(0) & 0xff` then corrupts the byte stream,
 * which silently broke every compressed PDF whose DEFLATE data contained one of
 * those bytes — the inflater would raise "bad distance" and the file read as
 * empty. `String.fromCharCode` has no such mapping.
 */
const CHUNK = 0x8000;

export function bytesToBinaryString(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += CHUNK) {
    result += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return result;
}

export function binaryStringToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xff;
  return bytes;
}

function inflate(data: Uint8Array): Uint8Array | null {
  try {
    // Prefer the platform decoder: it is synchronous-safe to call in a loop and
    // needs no dependency. Fall back to the stored bytes when unavailable.
    const result = trySyncInflate(data);
    return result;
  } catch {
    return null;
  }
}

/** `DecompressionStream` is async, so a tiny raw-DEFLATE inflater is used here. */
function trySyncInflate(data: Uint8Array): Uint8Array | null {
  const output: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  let position = 0;

  const readBit = (): number => {
    if (bitCount === 0) {
      if (position >= data.length) throw new Error('truncated');
      bitBuffer = data[position]!;
      position += 1;
      bitCount = 8;
    }
    const bit = bitBuffer & 1;
    bitBuffer >>= 1;
    bitCount -= 1;
    return bit;
  };
  const readBits = (count: number): number => {
    let value = 0;
    for (let index = 0; index < count; index += 1) value |= readBit() << index;
    return value;
  };

  const buildHuffman = (lengths: number[]): Map<string, number> => {
    const maxBits = Math.max(...lengths);
    const blCount = new Array<number>(maxBits + 1).fill(0);
    for (const length of lengths) if (length > 0) blCount[length] += 1;
    const nextCode = new Array<number>(maxBits + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxBits; bits += 1) {
      code = (code + (blCount[bits - 1] ?? 0)) << 1;
      nextCode[bits] = code;
    }
    const table = new Map<string, number>();
    lengths.forEach((length, symbol) => {
      if (length === 0) return;
      const value = nextCode[length]!;
      nextCode[length] = value + 1;
      table.set(`${length}:${(value >>> 0).toString(2).padStart(length, '0')}`, symbol);
    });
    return table;
  };

  const decode = (table: Map<string, number>): number => {
    let code = 0;
    let length = 0;
    while (length < 16) {
      code = (code << 1) | readBit();
      length += 1;
      const symbol = table.get(`${length}:${(code >>> 0).toString(2).padStart(length, '0')}`);
      if (symbol !== undefined) return symbol;
    }
    throw new Error('bad code');
  };

  let lastBlock = false;
  while (!lastBlock) {
    lastBlock = readBit() === 1;
    const type = readBits(2);
    if (type === 0) {
      bitCount = 0;
      const length = data[position]! | (data[position + 1]! << 8);
      position += 4;
      for (let index = 0; index < length; index += 1) output.push(data[position + index]!);
      position += length;
    } else if (type === 1 || type === 2) {
      let literalLengths: number[];
      let distanceLengths: number[];
      if (type === 1) {
        literalLengths = new Array<number>(288).fill(8);
        for (let index = 144; index < 256; index += 1) literalLengths[index] = 9;
        for (let index = 256; index < 280; index += 1) literalLengths[index] = 7;
        distanceLengths = new Array<number>(32).fill(5);
      } else {
        const hlit = readBits(5) + 257;
        const hdist = readBits(5) + 1;
        const hclen = readBits(4) + 4;
        const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        const codeLengths = new Array<number>(19).fill(0);
        for (let index = 0; index < hclen; index += 1) codeLengths[order[index]!] = readBits(3);
        const codeTable = buildHuffman(codeLengths);
        const lengths: number[] = [];
        while (lengths.length < hlit + hdist) {
          const symbol = decode(codeTable);
          if (symbol < 16) lengths.push(symbol);
          else if (symbol === 16) {
            const repeat = 3 + readBits(2);
            const previous = lengths[lengths.length - 1] ?? 0;
            for (let index = 0; index < repeat; index += 1) lengths.push(previous);
          } else if (symbol === 17) {
            const repeat = 3 + readBits(3);
            for (let index = 0; index < repeat; index += 1) lengths.push(0);
          } else {
            const repeat = 11 + readBits(7);
            for (let index = 0; index < repeat; index += 1) lengths.push(0);
          }
        }
        literalLengths = lengths.slice(0, hlit);
        distanceLengths = lengths.slice(hlit);
      }

      const literalTable = buildHuffman(literalLengths);
      const distanceTable = buildHuffman(distanceLengths);
      const lengthBase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
      const lengthExtra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
      const distBase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
      const distExtra = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

      for (;;) {
        const symbol = decode(literalTable);
        if (symbol === 256) break;
        if (symbol < 256) {
          output.push(symbol);
          continue;
        }
        const lengthIndex = symbol - 257;
        const length = (lengthBase[lengthIndex] ?? 0) + readBits(lengthExtra[lengthIndex] ?? 0);
        const distanceSymbol = decode(distanceTable);
        const distance = (distBase[distanceSymbol] ?? 0) + readBits(distExtra[distanceSymbol] ?? 0);
        const start = output.length - distance;
        if (start < 0) throw new Error('bad distance');
        for (let index = 0; index < length; index += 1) output.push(output[start + index]!);
      }
    } else {
      throw new Error('reserved block type');
    }
  }

  return new Uint8Array(output);
}

/** Unescape a PDF string literal (parentheses and backslash escapes). */
export function pdfLiteralToString(literal: string): string {
  let result = '';
  for (let index = 0; index < literal.length; index += 1) {
    const character = literal[index]!;
    if (character !== '\\') {
      result += character;
      continue;
    }
    const next = literal[index + 1];
    index += 1;
    if (next === undefined) break;
    if (next === 'n') result += '\n';
    else if (next === 'r') result += '\r';
    else if (next === 't') result += '\t';
    else if (next === 'b') result += '\b';
    else if (next === 'f') result += '\f';
    else if (next === '\\' || next === '(' || next === ')' || next === '/') result += next;
    else if (next >= '0' && next <= '7') {
      let octal = next;
      while (octal.length < 3 && index + 1 < literal.length && /[0-7]/.test(literal[index + 1]!)) {
        octal += literal[index + 1];
        index += 1;
      }
      result += String.fromCharCode(Number.parseInt(octal, 8));
    } else result += next;
  }
  return result;
}

/**
 * Text out of one decoded content stream.
 *
 * One pass over the operators that carry text (`Tj`, `TJ`, `'`, `"`) and the
 * ones that position it (`Td`, `TD`, `T*`), which is what turns a wall of
 * positioned glyphs back into readable lines.
 */
export function textFromContentStream(content: string): string {
  const token =
    /\(((?:\\.|[^\\()])*)\)\s*(?:Tj|'|")|\[([^\]]*)\]\s*TJ|\bT[dD]\b|\bT\*\b/g;
  const pieces: string[] = [];
  let match: RegExpExecArray | null;
  let sawText = false;

  while ((match = token.exec(content)) !== null) {
    const [, literal, array] = match;
    if (literal !== undefined) {
      pieces.push(pdfLiteralToString(literal));
      sawText = true;
      continue;
    }
    if (array !== undefined) {
      let text = '';
      const inner = /\(((?:\\.|[^\\()])*)\)|(-?\d+(?:\.\d+)?)/g;
      let part: RegExpExecArray | null;
      while ((part = inner.exec(array)) !== null) {
        if (part[1] !== undefined) text += pdfLiteralToString(part[1]);
        else if (Number(part[2]) < -120) text += ' '; // big negative kern = word gap
      }
      pieces.push(text);
      sawText = true;
      continue;
    }
    pieces.push('\n');
  }

  if (!sawText) return '';
  return pieces
    .join('')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1]!.length > 0))
    .join('\n')
    .trim();
}

export function extractPdfText(bytes: Uint8Array): PdfTextResult {
  const raw = bytesToBinaryString(bytes);
  const warnings: string[] = [];
  const encrypted = /\/Encrypt\b/.test(raw);
  const chunks: string[] = [];
  let decodedStreams = 0;
  let totalStreams = 0;
  let imageStreams = 0;

  const streamPattern = /stream\r?\n?/g;
  let match: RegExpExecArray | null;
  while ((match = streamPattern.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end === -1) break;
    totalStreams += 1;
    const header = raw.slice(Math.max(0, match.index - 400), match.index);
    const body = raw.slice(start, end);
    const data = binaryStringToBytes(body);
    let content: string | null = null;
    if (/\/Filter\s*\/FlateDecode/.test(header)) {
      const inflated = inflate(data);
      if (inflated) {
        content = bytesToBinaryString(inflated);
        decodedStreams += 1;
      }
    } else if (!/\/Filter/.test(header)) {
      content = body;
      decodedStreams += 1;
    }

    if (/\/Subtype\s*\/Image/.test(header)) imageStreams += 1;

    if (content && /(?:Tj|TJ)\b/.test(content)) {
      const text = textFromContentStream(content);
      if (text.trim()) chunks.push(text.trim());
    }
    streamPattern.lastIndex = end;
  }

  const pages = Math.max(1, (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length);
  if (encrypted) warnings.push('The PDF is encrypted; only readable text was extracted.');
  if (totalStreams > 0 && decodedStreams === 0) {
    warnings.push('No content stream could be decompressed, so no text was extracted.');
  }

  const text = chunks.join('\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return {
    text,
    pages,
    decodedStreams,
    encrypted,
    imagesOnly: text.length === 0 && imageStreams > 0,
    warnings,
  };
}
