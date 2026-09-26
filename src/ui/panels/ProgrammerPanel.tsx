import { useMemo, useState } from 'react';
import {
  adler32,
  applyBitMask,
  applyProgrammerBitwise,
  asciiToText,
  base64Decode,
  binaryToText,
  clearBit,
  codePointToCharacter,
  base64Encode,
  baseArithmetic,
  bytesToHex,
  characterCodePoints,
  codeLiteral,
  compressIPv6,
  convertDataSize,
  countSetBits,
  countZeroBits,
  crc16,
  crc32,
  crc8,
  dateToTimestamp,
  DATA_TYPE_SIZES,
  DATA_UNITS,
  evaluateProgrammerExpression,
  expandIPv6,
  ipv6NetworkPrefix,
  extractBitRange,
  floatInfo,
  formatProgrammerBigInt,
  groupHexBytes,
  generateBitMask,
  hashBytes,
  HASH_ALGORITHMS,
  hexColorToRgba,
  hexToText,
  hexBytes,
  htmlDecode,
  htmlEncode,
  insertBitRange,
  integerTypeInfo,
  ipv4Cidr,
  lowestSetBit,
  macInfo,
  memoryAddress,
  parseIPv4,
  parseProgrammerBigInt,
  PROGRAMMER_BASES,
  PROGRAMMER_BITWISE_OPS,
  programmerRepresentations,
  randomBytes,
  randomIPv4,
  randomInteger,
  randomMac,
  randomUuid,
  rawToFloat,
  reverseBits,
  reverseBytes,
  rgbaToHex,
  setBit,
  signExtend,
  subnetForHosts,
  subnetsForCount,
  testBit,
  testRegex,
  textToAscii,
  textToBinary,
  textToHex,
  timestampToDate,
  toggleBit,
  type CodeLanguage,
  type HashAlgorithm,
  type IntegerWidth,
  type ProgrammerBase,
  type ProgrammerBitwiseOperation,
  type SignedMode,
  type TimestampUnit,
  unsignedAtWidth,
  urlDecode,
  urlEncode,
  utf8Bytes,
  wordSwap,
  xorChecksum,
  zeroExtend,
} from '@/programmer/tools';
import { errorMessage } from '@/core/errors';
import { CopyButton, Notice, OutputList, SelectField, Tabs, TextField } from '@/ui/components/primitives';

const WIDTH_OPTIONS = [4, 8, 16, 32, 64, 128].map((width) => ({ value: String(width), label: `${width}-bit` }));
const BASE_OPTIONS = PROGRAMMER_BASES.map((base) => ({ value: String(base), label: base === 2 ? 'Binary (base 2)' : base === 8 ? 'Octal (base 8)' : base === 10 ? 'Decimal (base 10)' : base === 16 ? 'Hexadecimal (base 16)' : `Base ${base}` }));
const BITWISE_OPTIONS = PROGRAMMER_BITWISE_OPS.map((operation) => ({ value: operation.id, label: operation.label }));
const TEXT_ENCODINGS = ['Base64', 'URL', 'HTML entities', 'Binary bytes', 'Hex bytes', 'ASCII codes'] as const;
const CODE_LANGUAGES: { value: CodeLanguage; label: string }[] = [
  { value: 'c', label: 'C' }, { value: 'cpp', label: 'C++' }, { value: 'csharp', label: 'C#' }, { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' }, { value: 'typescript', label: 'TypeScript' }, { value: 'python', label: 'Python' }, { value: 'rust', label: 'Rust' },
];
const TIMESTAMP_UNITS: { value: TimestampUnit; label: string }[] = [
  { value: 's', label: 'Seconds' }, { value: 'ms', label: 'Milliseconds' }, { value: 'us', label: 'Microseconds' }, { value: 'ns', label: 'Nanoseconds' },
];

const TOOL_TABS = [
  { id: 'numbers', label: 'Numbers & bits' }, { id: 'integers', label: 'Integer types' }, { id: 'text', label: 'Text & encoding' },
  { id: 'network', label: 'IP & MAC' }, { id: 'data', label: 'Memory, time & float' }, { id: 'hash', label: 'Hashes & checksums' },
  { id: 'bytes', label: 'Bytes & colour' }, { id: 'expression', label: 'Expressions' }, { id: 'utilities', label: 'Generators & references' },
] as const;

type TabId = (typeof TOOL_TABS)[number]['id'];

function widthOf(value: string): IntegerWidth { return Number(value) as IntegerWidth; }
function baseOf(value: string): ProgrammerBase { return Number(value); }
function safe<T>(work: () => T): { ok: true; value: T } | { ok: false; error: string } { try { return { ok: true, value: work() }; } catch (error) { return { ok: false, error: errorMessage(error) }; } }
function valueOr<T>(result: { ok: true; value: T } | { ok: false; error: string }, fallback: T): T { return result.ok ? result.value : fallback; }
function displayBig(value: bigint, base: number, prefix = false): string { return formatProgrammerBigInt(value, base, prefix, base === 16); }
function formatMaybe(value: bigint | number | null | undefined): string { return value === null || value === undefined ? 'None' : String(value); }
function remember(setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>, label: string, value: string): void { setHistory((items) => [{ id: `${Date.now()}-${Math.random()}`, label, value }, ...items].slice(0, 60)); }

interface HistoryEntry { id: string; label: string; value: string; }

export function ProgrammerPanel() {
  const [tab, setTab] = useState<TabId>('numbers');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  return (
    <div className="stack programmer-toolbox">
      <section className="card programmer-intro">
        <h2>Programmer Calculator</h2>
        <p>Exact offline tools for bases 2–36, bits, registers, text, networks, data, hashes and developer expressions. Large integers use BigInt rather than floating point.</p>
        <Tabs tabs={TOOL_TABS} value={tab} onChange={(value) => setTab(value as TabId)} label="Programmer calculator tools" />
      </section>
      {tab === 'numbers' ? <NumbersTab onResult={(label, value) => remember(setHistory, label, value)} /> : null}
      {tab === 'integers' ? <IntegerTab onResult={(label, value) => remember(setHistory, label, value)} /> : null}
      {tab === 'text' ? <TextTab onResult={(label, value) => remember(setHistory, label, value)} /> : null}
      {tab === 'network' ? <NetworkTab onResult={(label, value) => remember(setHistory, label, value)} /> : null}
      {tab === 'data' ? <DataTab onResult={(label, value) => remember(setHistory, label, value)} /> : null}
      {tab === 'hash' ? <HashTab onResult={(label, value) => remember(setHistory, label, value)} /> : null}
      {tab === 'bytes' ? <BytesTab onResult={(label, value) => remember(setHistory, label, value)} /> : null}
      {tab === 'expression' ? <ExpressionTab onResult={(label, value) => remember(setHistory, label, value)} /> : null}
      {tab === 'utilities' ? <UtilitiesTab onResult={(label, value) => remember(setHistory, label, value)} /> : null}
      <HistoryCard history={history} onClear={() => setHistory([])} />
    </div>
  );
}

function NumbersTab({ onResult }: { onResult: (label: string, value: string) => void }) {
  const [baseText, setBaseText] = useState('10');
  const [input, setInput] = useState('255');
  const [other, setOther] = useState('15');
  const [widthText, setWidthText] = useState('8');
  const [operation, setOperation] = useState<ProgrammerBitwiseOperation>('and');
  const [baseOperation, setBaseOperation] = useState<'+' | '-' | '*' | '/' | '%' | '^'>('+');
  const [baseRight, setBaseRight] = useState('1');
  const [wrapped, setWrapped] = useState(false);
  const [pending, setPending] = useState<{ operation: '+' | '-' | '*' | '/' | '%' | '^'; left: bigint } | null>(null);
  const [bitAction, setBitAction] = useState('set');
  const [bitPosition, setBitPosition] = useState('0');
  const [rangeStart, setRangeStart] = useState('0');
  const [rangeLength, setRangeLength] = useState('4');
  const [insertValue, setInsertValue] = useState('0');
  const [maskOperation, setMaskOperation] = useState<'and' | 'or' | 'xor' | 'clear'>('and');
  const base = baseOf(baseText); const width = widthOf(widthText);
  const parsed = useMemo(() => safe(() => parseProgrammerBigInt(input, base)), [input, base]);
  const value = 'value' in parsed ? parsed.value : null;
  const representations = value === null ? null : programmerRepresentations(value);
  const bitwise = useMemo(() => value === null ? { error: 'Enter a valid first operand.' } : safe(() => applyProgrammerBitwise(operation, value, parseProgrammerBigInt(other || '0', base), width)), [base, operation, other, value, width]);
  const baseResult = useMemo(() => safe(() => baseArithmetic(input, baseRight, base, baseOperation)), [base, baseOperation, baseRight, input]);
  const bitResult = useMemo(() => {
    if (value === null) return { error: 'Enter a valid integer first.' };
    return safe(() => {
      const position = Number(bitPosition); const start = Number(rangeStart); const length = Number(rangeLength);
      if (bitAction === 'set') return setBit(value, position, width);
      if (bitAction === 'clear') return clearBit(value, position, width);
      if (bitAction === 'toggle') return toggleBit(value, position, width);
      if (bitAction === 'test') return testBit(value, position, width) ? 1n : 0n;
      if (bitAction === 'extract') return extractBitRange(value, start, length, width);
      if (bitAction === 'insert') return insertBitRange(value, parseProgrammerBigInt(insertValue || '0', base), start, length, width);
      if (bitAction === 'reverse') return reverseBits(value, width);
      if (bitAction === 'reverse-bytes') return reverseBytes(value, width);
      if (bitAction === 'mask') return generateBitMask(start, length, width);
      return applyBitMask(value, generateBitMask(start, length, width), maskOperation, width);
    });
  }, [base, bitAction, bitPosition, insertValue, maskOperation, rangeLength, rangeStart, value, width]);
  const press = (key: string) => setInput((current) => current === '0' ? key.toLowerCase() : `${current}${key.toLowerCase()}`);
  const chooseArithmetic = (operationToUse: '+' | '-' | '*' | '/' | '%' | '^') => { if (value === null) return; setPending({ operation: operationToUse, left: value }); setWrapped(false); setInput('0'); };
  const equals = () => { if (!pending || value === null) return; const result = safe(() => baseArithmetic(displayBig(pending.left, base), input, base, pending.operation)); if ('value' in result) { const fixed = unsignedAtWidth(result.value, width); setWrapped(fixed !== result.value); setInput(displayBig(fixed, base)); onResult('Integer arithmetic', displayBig(fixed, base)); } setPending(null); };
  const applyBitwise = () => { if ('value' in bitwise) { const result = displayBig(bitwise.value.unsigned, base); setInput(result); onResult('Bitwise operation', result); } };
  const resultRows = representations ? [
    { label: 'Binary', value: `0b${representations.binary}`, emphasize: true }, { label: 'Octal', value: `0o${representations.octal}` },
    { label: 'Decimal', value: representations.decimal }, { label: 'Hexadecimal', value: `0x${representations.hexadecimal}` }, { label: 'Base 36', value: representations.base36 },
  ] : [];
  return (
    <>
      <section className="card">
        <h2>Number systems and base-N arithmetic</h2>
        <div className="grid grid--form">
          <SelectField label="Input base" value={baseText} onChange={setBaseText} options={BASE_OPTIONS} />
          <TextField label="Integer input" value={input} onChange={setInput} placeholder="255, 0xff or 1010" />
          <TextField label="Second value" value={baseRight} onChange={setBaseRight} placeholder="15" />
          <SelectField label="Base-N arithmetic" value={baseOperation} onChange={(next) => setBaseOperation(next as '+' | '-' | '*' | '/' | '%' | '^')} options={[['+', 'Add'], ['-', 'Subtract'], ['*', 'Multiply'], ['/', 'Integer divide'], ['%', 'Modulo'], ['^', 'Power']].map(([value, label]) => ({ value, label: `${label} (${value})` }))} />
        </div>
        {'value' in parsed ? <><OutputList rows={resultRows} /><div className="row programmer-copy-actions" aria-label="Copy programmer result"><CopyButton text={representations?.decimal ?? ''} label="Copy decimal" /><CopyButton text={`0x${representations?.hexadecimal ?? ''}`} label="Copy HEX" /><CopyButton text={`0b${representations?.binary ?? ''}`} label="Copy binary" /><CopyButton text={value === null ? '' : codeLiteral(value, 'javascript', 'hex')} label="Copy code" /></div></> : <Notice kind="error">{parsed.error}</Notice>}
        {'value' in baseResult ? <div className="result-line"><strong>Base result:</strong> {displayBig(baseResult.value, base, base === 16)} <CopyButton text={displayBig(baseResult.value, base, base === 16)} label="Copy base result" /></div> : <Notice kind="error">{baseResult.error}</Notice>}
        {wrapped ? <Notice kind="warn">The exact result did not fit in {width} bits, so it wrapped modulo 2^{width}.</Notice> : null}
        <div className="program__keys programmer-keypad" aria-label="Programmer keypad">
          {['A', 'B', 'C', 'D', 'E', 'F', '7', '8', '9', '4', '5', '6', '1', '2', '3', '0'].map((key) => <button key={key} type="button" className="key key--digit" onClick={() => press(key)}>{key}</button>)}
          {(['+', '-', '*', '/', '%', '^'] as const).map((key) => <button key={key} type="button" className="key key--function" onClick={() => chooseArithmetic(key)}>{key}</button>)}
          <button type="button" className="key key--accent" onClick={equals} aria-label="Evaluate">=</button>
          <button type="button" className="key key--danger" aria-label="Clear" onClick={() => { setInput('0'); setPending(null); setWrapped(false); }}>AC</button>
          <button type="button" className="key key--function" onClick={() => setInput((current) => current.slice(0, -1) || '0')}>⌫</button>
        </div>
      </section>
      <section className="card">
        <h2>Bitwise operations</h2>
        <div className="grid grid--form">
          <TextField label="Operand A" value={input} onChange={setInput} />
          <TextField label="Bitwise operand" value={other} onChange={setOther} />
          <SelectField label="Bitwise operation" value={operation} onChange={(next) => setOperation(next as ProgrammerBitwiseOperation)} options={BITWISE_OPTIONS} />
          <SelectField label="Bit width" value={widthText} onChange={setWidthText} options={WIDTH_OPTIONS} />
        </div>
        <button type="button" className="btn btn--small" onClick={applyBitwise}>Apply</button>
        {'value' in bitwise ? <><OutputList rows={[{ label: 'Unsigned', value: bitwise.value.unsigned.toString(), emphasize: true }, { label: 'Signed two’s complement', value: bitwise.value.signed.toString() }, { label: 'Hexadecimal (bitwise result)', value: `0x${bitwise.value.hex.padStart(Math.max(2, Math.ceil(width / 4)), '0')}` }, { label: 'Octal', value: `0o${bitwise.value.octal}` }, { label: 'Binary', value: bitwise.value.binary }]} /><CopyButton text={bitwise.value.unsigned.toString()} label="Copy decimal result" /></> : <Notice kind="error">{bitwise.error}</Notice>}
      </section>
      <section className="card">
        <h2>Bit manipulation</h2>
        <div className="grid grid--form">
          <SelectField label="Tool" value={bitAction} onChange={setBitAction} options={[['set', 'Set bit'], ['clear', 'Clear bit'], ['toggle', 'Toggle bit'], ['test', 'Test bit'], ['extract', 'Extract bit range'], ['insert', 'Insert bit range'], ['reverse', 'Reverse bits'], ['reverse-bytes', 'Reverse bytes'], ['mask', 'Generate bit mask'], ['apply-mask', 'Apply bit mask']].map(([value, label]) => ({ value, label }))} />
          <TextField label="Bit position" value={bitPosition} onChange={setBitPosition} />
          <TextField label="Range start" value={rangeStart} onChange={setRangeStart} />
          <TextField label="Range length" value={rangeLength} onChange={setRangeLength} />
          <TextField label="Inserted value" value={insertValue} onChange={setInsertValue} />
          <SelectField label="Mask operation" value={maskOperation} onChange={(next) => setMaskOperation(next as typeof maskOperation)} options={[{ value: 'and', label: 'Apply AND' }, { value: 'or', label: 'Apply OR' }, { value: 'xor', label: 'Apply XOR' }, { value: 'clear', label: 'Clear masked bits' }]} />
        </div>
        {'value' in bitResult ? <OutputList rows={[{ label: bitAction === 'test' ? 'Bit is set (1/0)' : 'Result', value: displayBig(bitResult.value, base), emphasize: true }, { label: 'Set bits', value: String(countSetBits(bitResult.value, width)) }, { label: 'Zero bits', value: String(countZeroBits(bitResult.value, width)) }, { label: 'Highest set bit', value: formatMaybe((bitResult.value === 0n ? null : bitResult.value.toString(2).length - 1)) }, { label: 'Lowest set bit', value: formatMaybe(lowestSetBit(bitResult.value, width)) }]} /> : <Notice kind="error">{bitResult.error}</Notice>}
      </section>
    </>
  );
}

function IntegerTab({ onResult }: { onResult: (label: string, value: string) => void }) {
  void onResult;
  const [input, setInput] = useState('255'); const [widthText, setWidthText] = useState('8'); const [mode, setMode] = useState<SignedMode>('unsigned'); const [operation, setOperation] = useState('add'); const [right, setRight] = useState('1'); const [fromText, setFromText] = useState('8'); const [toText, setToText] = useState('32');
  const width = widthOf(widthText); const result = useMemo(() => safe(() => integerTypeInfo(parseProgrammerBigInt(input, 10), width, mode)), [input, mode, width]);
  const arithmetic = useMemo(() => safe(() => { const a = parseProgrammerBigInt(input, 10); const b = parseProgrammerBigInt(right, 10); if ((operation === 'divide' || operation === 'mod') && b === 0n) throw new Error(operation === 'divide' ? 'Division by zero.' : 'Modulo by zero.'); const exact = operation === 'add' ? a + b : operation === 'subtract' ? a - b : operation === 'multiply' ? a * b : operation === 'divide' ? a / b : a % b; return integerTypeInfo(exact, width, mode); }), [input, mode, operation, right, width]);
  const extension = useMemo(() => safe(() => ({ sign: signExtend(parseProgrammerBigInt(input, 10), widthOf(fromText), widthOf(toText)), zero: zeroExtend(parseProgrammerBigInt(input, 10), widthOf(fromText), widthOf(toText)) })), [fromText, input, toText]);
  return <>
    <section className="card"><h2>Signed, unsigned and two’s complement</h2><div className="grid grid--form"><TextField label="Value (decimal)" value={input} onChange={setInput} /><SelectField label="Integer width" value={widthText} onChange={setWidthText} options={WIDTH_OPTIONS} /><SelectField label="Interpretation" value={mode} onChange={(next) => setMode(next as SignedMode)} options={[{ value: 'unsigned', label: 'Unsigned' }, { value: 'signed', label: 'Signed two’s complement' }]} /></div>{'value' in result ? <><OutputList rows={[{ label: 'Unsigned', value: result.value.unsigned.toString(), emphasize: true }, { label: 'Signed', value: result.value.signed.toString() }, { label: 'Minimum', value: result.value.minimum.toString() }, { label: 'Maximum', value: result.value.maximum.toString() }, { label: 'Binary', value: result.value.binary }]} /><Notice kind={result.value.overflow ? 'warn' : result.value.underflow ? 'error' : 'info'}>{result.value.overflow ? 'Overflow: the value exceeds the selected maximum.' : result.value.underflow ? 'Underflow: the value is below the selected minimum.' : `The value fits in ${width}-bit ${mode} storage.`}</Notice></> : <Notice kind="error">{result.error}</Notice>}</section>
    <section className="card"><h2>Fixed-width arithmetic and extensions</h2><div className="grid grid--form"><TextField label="Left operand" value={input} onChange={setInput} /><TextField label="Right operand" value={right} onChange={setRight} /><SelectField label="Operation" value={operation} onChange={setOperation} options={[{ value: 'add', label: 'Add' }, { value: 'subtract', label: 'Subtract' }, { value: 'multiply', label: 'Multiply' }, { value: 'divide', label: 'Integer divide' }, { value: 'mod', label: 'Modulo' }]} /><SelectField label="From width" value={fromText} onChange={setFromText} options={WIDTH_OPTIONS} /><SelectField label="To width" value={toText} onChange={setToText} options={WIDTH_OPTIONS} /></div>{'value' in arithmetic ? <><OutputList rows={[{ label: 'Arithmetic result', value: arithmetic.value.signed.toString(), emphasize: true }, { label: 'Unsigned bits', value: arithmetic.value.unsigned.toString() }, { label: 'Binary', value: arithmetic.value.binary }]} /><CopyButton text={arithmetic.value.signed.toString()} label="Copy arithmetic result" /></> : <Notice kind="error">{arithmetic.error}</Notice>}{'value' in extension ? <OutputList title="Extension" rows={[{ label: 'Sign extension', value: extension.value.sign.toString() }, { label: 'Zero extension', value: extension.value.zero.toString() }]} /> : <Notice kind="error">{extension.error}</Notice>}</section>
  </>;
}

function TextTab({ onResult }: { onResult: (label: string, value: string) => void }) {
  void onResult;
  const [text, setText] = useState('Hello, 👋'); const [codePoint, setCodePoint] = useState('1f600'); const [ascii, setAscii] = useState('72 101 108 108 111'); const [encoding, setEncoding] = useState<(typeof TEXT_ENCODINGS)[number]>('Base64'); const [encoded, setEncoded] = useState('');
  const codePoints = safe(() => characterCodePoints(text)); const characterResult = useMemo(() => safe(() => codePointToCharacter(codePoint)), [codePoint]); const encodedResult = useMemo(() => safe(() => encoding === 'Base64' ? base64Encode(text) : encoding === 'URL' ? urlEncode(text) : encoding === 'HTML entities' ? htmlEncode(text) : encoding === 'Binary bytes' ? textToBinary(text) : encoding === 'Hex bytes' ? textToHex(text) : textToAscii(text).join(' ')), [encoding, text]);
  const decoded = useMemo(() => encoded.trim()
    ? safe(() => encoding === 'Base64'
      ? base64Decode(encoded)
      : encoding === 'URL'
        ? urlDecode(encoded)
        : encoding === 'HTML entities'
          ? htmlDecode(encoded)
          : encoding === 'Binary bytes'
            ? binaryToText(encoded)
            : encoding === 'Hex bytes'
              ? hexToText(encoded)
              : asciiToText(encoded))
    : null, [encoded, encoding]);
  return <>
    <section className="card"><h2>ASCII, Unicode and UTF-8</h2><div className="grid grid--form"><TextField label="Text or character" value={text} onChange={setText} /><TextField label="Unicode code point (hex)" value={codePoint} onChange={setCodePoint} /><TextField label="ASCII codes" value={ascii} onChange={setAscii} /></div>{'value' in codePoints ? <OutputList rows={[{ label: 'Code points', value: codePoints.value.map((value) => `U+${value.toString(16).toUpperCase().padStart(4, '0')}`).join(' '), emphasize: true }, { label: 'ASCII', value: valueOr(safe(() => textToAscii(text)), []).join(' ') || 'Non-ASCII text' }, { label: 'UTF-8 bytes', value: bytesToHex(utf8Bytes(text)) }, { label: 'Binary', value: textToBinary(text) }, { label: 'Hex', value: textToHex(text) }]} /> : <Notice kind="error">{codePoints.error}</Notice>}<div className="result-line"><strong>Code point to character:</strong> {valueOr(characterResult, 'Invalid code point')} <CopyButton text={valueOr(characterResult, '')} label="Copy character" /></div><div className="result-line"><strong>ASCII to text:</strong> {valueOr(safe(() => asciiToText(ascii)), 'Invalid ASCII')} </div></section>
    <section className="card"><h2>Encoding and decoding</h2><div className="grid grid--form"><SelectField label="Encoding" value={encoding} onChange={(next) => setEncoding(next as (typeof TEXT_ENCODINGS)[number])} options={TEXT_ENCODINGS.map((value) => ({ value, label: value }))} /><TextField label="Encoded input to decode" value={encoded} onChange={setEncoded} multiline rows={3} /></div>{'value' in encodedResult ? <><OutputList rows={[{ label: `${encoding} encoding`, value: encodedResult.value, emphasize: true }]} /><CopyButton text={encodedResult.value} label="Copy encoded text" /></> : <Notice kind="error">{encodedResult.error}</Notice>}{decoded ? 'value' in decoded ? <OutputList title="Decoded text" rows={[{ label: 'Text', value: decoded.value, emphasize: true }]} /> : <Notice kind="error">{decoded.error}</Notice> : null}<Notice>Encoding changes representation; it is not encryption. These conversions run locally.</Notice></section>
  </>;
}

function NetworkTab({ onResult }: { onResult: (label: string, value: string) => void }) {
  void onResult;
  const [cidr, setCidr] = useState('192.168.1.10/24'); const [hosts, setHosts] = useState('100'); const [basePrefix, setBasePrefix] = useState('16'); const [subnetCount, setSubnetCount] = useState('4'); const [ipv6, setIpv6] = useState('2001:db8::1/64'); const [mac, setMac] = useState('00:1A:2B:3C:4D:5E');
  const info = useMemo(() => safe(() => ipv4Cidr(cidr)), [cidr]);
  const hostResult = useMemo(() => safe(() => subnetForHosts(parseProgrammerBigInt(hosts, 10))), [hosts]); const subnetResult = useMemo(() => safe(() => subnetsForCount(Number(basePrefix), parseProgrammerBigInt(subnetCount, 10))), [basePrefix, subnetCount]); const ipv6Result = useMemo(() => safe(() => { const [address] = ipv6.split('/'); return { expanded: expandIPv6(address ?? ''), compressed: compressIPv6(address ?? ''), prefix: ipv6.includes('/') ? ipv6.split('/')[1] : '—' }; }), [ipv6]); const macResult = useMemo(() => safe(() => macInfo(mac)), [mac]);
  return <>
    <section className="card"><h2>IPv4 and CIDR</h2><div className="grid grid--form"><TextField label="IPv4 / CIDR" value={cidr} onChange={setCidr} /><TextField label="Required usable hosts" value={hosts} onChange={setHosts} /><TextField label="Base prefix for subnet count" value={basePrefix} onChange={setBasePrefix} /><TextField label="Number of subnets" value={subnetCount} onChange={setSubnetCount} /></div>{'value' in info ? <><OutputList rows={[{ label: 'IP in binary', value: valueOr(safe(() => parseIPv4(info.value.ip).toString(2).padStart(32, '0').match(/.{8}/g)!.join('.')), '') }, { label: 'IP in hex', value: `0x${parseIPv4(info.value.ip).toString(16).padStart(8, '0').toUpperCase()}` }, { label: 'Subnet mask', value: info.value.mask, emphasize: true }, { label: 'Wildcard mask', value: info.value.wildcard }, { label: 'Network', value: info.value.network }, { label: 'Broadcast', value: info.value.broadcast }, { label: 'First usable', value: info.value.first }, { label: 'Last usable', value: info.value.last }, { label: 'Addresses', value: info.value.addresses.toString() }, { label: 'Usable hosts', value: info.value.usableHosts.toString() }]} /><CopyButton text={info.value.network} label="Copy network address" /></> : <Notice kind="error">{info.error}</Notice>}{'value' in hostResult ? <OutputList title="Required hosts subnet" rows={[{ label: 'Prefix', value: `/${hostResult.value.prefix}`, emphasize: true }, { label: 'Mask', value: hostResult.value.mask }, { label: 'Addresses', value: hostResult.value.addresses.toString() }, { label: 'Usable hosts', value: hostResult.value.usableHosts.toString() }]} /> : <Notice kind="error">{hostResult.error}</Notice>}{'value' in subnetResult ? <OutputList title="Subnet count" rows={[{ label: 'New prefix', value: `/${subnetResult.value.prefix}` }, { label: 'Subnets created', value: subnetResult.value.subnets.toString() }, { label: 'Addresses per subnet', value: subnetResult.value.hostsPerSubnet.toString() }]} /> : <Notice kind="error">{subnetResult.error}</Notice>}</section>
    <section className="card"><h2>IPv6</h2><TextField label="IPv6 / prefix" value={ipv6} onChange={setIpv6} />{'value' in ipv6Result ? <OutputList rows={[{ label: 'Expanded', value: ipv6Result.value.expanded }, { label: 'Compressed', value: ipv6Result.value.compressed, emphasize: true }, { label: 'Prefix length', value: ipv6Result.value.prefix }, { label: 'Network prefix', value: ipv6.includes('/') ? valueOr(safe(() => ipv6NetworkPrefix(ipv6)), 'Invalid') : 'Add /prefix' }]} /> : <Notice kind="error">{ipv6Result.error}</Notice>}</section>
    <section className="card"><h2>MAC address</h2><TextField label="MAC address" value={mac} onChange={setMac} />{'value' in macResult ? <><OutputList rows={[{ label: 'Normalized', value: macResult.value.normalized, emphasize: true }, { label: 'Colon', value: macResult.value.colon }, { label: 'Hyphen', value: macResult.value.hyphen }, { label: 'Cisco', value: macResult.value.cisco }, { label: 'Plain hex', value: macResult.value.plain }, { label: 'Binary', value: macResult.value.binary }, { label: 'Unicast', value: macResult.value.unicast ? 'Yes' : 'No' }, { label: 'Multicast', value: macResult.value.multicast ? 'Yes' : 'No' }, { label: 'Locally administered', value: macResult.value.locallyAdministered ? 'Yes' : 'No' }, { label: 'Globally administered', value: macResult.value.globallyAdministered ? 'Yes' : 'No' }]} /><CopyButton text={macResult.value.normalized} label="Copy MAC" /></> : <Notice kind="error">{macResult.error}</Notice>}</section>
  </>;
}

function DataTab({ onResult }: { onResult: (label: string, value: string) => void }) {
  void onResult;
  const [size, setSize] = useState('1'); const [fromUnit, setFromUnit] = useState('MB'); const [toUnit, setToUnit] = useState('MiB'); const [address, setAddress] = useState('0x1000'); const [offset, setOffset] = useState('16'); const [elementSize, setElementSize] = useState('4'); const [index, setIndex] = useState('3'); const [timestamp, setTimestamp] = useState(String(Math.floor(Date.now() / 1000))); const [dateInput, setDateInput] = useState(new Date().toISOString()); const [timeUnit, setTimeUnit] = useState<TimestampUnit>('s'); const [float, setFloat] = useState('1.5'); const [floatWidth, setFloatWidth] = useState<'32' | '64'>('32'); const [raw, setRaw] = useState('3FC00000');
  const sizeResult = useMemo(() => safe(() => convertDataSize(Number(size), fromUnit, toUnit)), [fromUnit, size, toUnit]); const addressResult = useMemo(() => safe(() => memoryAddress(parseProgrammerBigInt(address.replace(/^0x/i, ''), 16), parseProgrammerBigInt(offset, 10), parseProgrammerBigInt(elementSize, 10), parseProgrammerBigInt(index, 10))), [address, elementSize, index, offset]); const dateResult = useMemo(() => safe(() => timestampToDate(timestamp, timeUnit)), [timeUnit, timestamp]); const dateTimestamp = useMemo(() => safe(() => dateToTimestamp(dateInput, timeUnit)), [dateInput, timeUnit]); const floatResult = useMemo(() => safe(() => floatInfo(Number(float), Number(floatWidth) as 32 | 64)), [float, floatWidth]); const rawResult = useMemo(() => safe(() => rawToFloat(raw, Number(floatWidth) as 32 | 64)), [floatWidth, raw]);
  return <>
    <section className="card"><h2>Memory and data sizes</h2><div className="grid grid--form"><TextField label="Amount" value={size} onChange={setSize} /><SelectField label="From" value={fromUnit} onChange={setFromUnit} options={DATA_UNITS.map((unit) => ({ value: unit.id, label: unit.label }))} /><SelectField label="To" value={toUnit} onChange={setToUnit} options={DATA_UNITS.map((unit) => ({ value: unit.id, label: unit.label }))} /></div>{'value' in sizeResult ? <OutputList rows={[{ label: 'Converted size', value: `${sizeResult.value}`, emphasize: true }, { label: 'Exact bytes (decimal)', value: String(Number(size) * (DATA_UNITS.find((unit) => unit.id === fromUnit)?.bytes ?? 1)) }]} /> : <Notice kind="error">{sizeResult.error}</Notice>}<OutputList title="Common data type sizes" rows={DATA_TYPE_SIZES.map((entry) => ({ label: entry.name, value: `${entry.bytes} bytes` }))} /></section>
    <section className="card"><h2>Memory address calculation</h2><div className="grid grid--form"><TextField label="Base address (hex)" value={address} onChange={setAddress} /><TextField label="Byte offset" value={offset} onChange={setOffset} /><TextField label="Element size" value={elementSize} onChange={setElementSize} /><TextField label="Array index" value={index} onChange={setIndex} /></div>{'value' in addressResult ? <OutputList rows={[{ label: 'Address (decimal)', value: addressResult.value.toString(), emphasize: true }, { label: 'Address (hex)', value: `0x${addressResult.value.toString(16).toUpperCase()}` }]} /> : <Notice kind="error">{addressResult.error}</Notice>}</section>
    <section className="card"><h2>Unix timestamp and developer time</h2><div className="grid grid--form"><TextField label="Unix timestamp" value={timestamp} onChange={setTimestamp} /><SelectField label="Timestamp unit" value={timeUnit} onChange={(next) => setTimeUnit(next as TimestampUnit)} options={TIMESTAMP_UNITS} /><TextField label="Date/time to convert" value={dateInput} onChange={setDateInput} /></div>{'value' in dateResult ? <OutputList rows={[{ label: 'UTC', value: dateResult.value.toUTCString(), emphasize: true }, { label: 'Local time', value: dateResult.value.toString() }, { label: 'ISO 8601 / RFC 3339', value: dateResult.value.toISOString() }, { label: 'Milliseconds', value: dateToTimestamp(dateResult.value.toISOString(), 'ms') }, { label: 'Seconds', value: dateToTimestamp(dateResult.value.toISOString(), 's') }, { label: 'Microseconds', value: dateToTimestamp(dateResult.value.toISOString(), 'us') }, { label: 'Nanoseconds', value: dateToTimestamp(dateResult.value.toISOString(), 'ns') }]} /> : <Notice kind="error">{dateResult.error}</Notice>}<div className="result-line"><strong>Date/time as {timeUnit} timestamp:</strong> {valueOr(dateTimestamp, 'Invalid date')}</div></section>
    <section className="card"><h2>IEEE-754 floating point</h2><div className="grid grid--form"><TextField label="Float value" value={float} onChange={setFloat} /><TextField label="Raw hexadecimal" value={raw} onChange={setRaw} /><SelectField label="Width" value={floatWidth} onChange={(next) => setFloatWidth(next as '32' | '64')} options={[{ value: '32', label: 'Float32' }, { value: '64', label: 'Float64' }]} /></div>{'value' in floatResult ? <OutputList rows={[{ label: 'Classification', value: floatResult.value.classification, emphasize: true }, { label: 'Sign bit', value: String(floatResult.value.sign) }, { label: 'Exponent field', value: String(floatResult.value.exponent) }, { label: 'Mantissa / fraction', value: floatResult.value.fraction }, { label: 'Raw binary', value: floatResult.value.rawBinary }, { label: 'Raw hex', value: `0x${floatResult.value.rawHex}` }]} /> : <Notice kind="error">{floatResult.error}</Notice>}{'value' in rawResult ? <div className="result-line"><strong>Raw hex to float:</strong> {String(rawResult.value)}</div> : <Notice kind="error">{rawResult.error}</Notice>}</section>
  </>;
}

function HashTab({ onResult }: { onResult: (label: string, value: string) => void }) {
  const [input, setInput] = useState('hello'); const [mode, setMode] = useState<'text' | 'hex'>('text'); const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256'); const [hash, setHash] = useState(''); const [busy, setBusy] = useState(false); const [fileName, setFileName] = useState(''); const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const runHash = async () => { setBusy(true); try { const data = bytes ?? (mode === 'text' ? utf8Bytes(input) : new Uint8Array(hexBytes(input))); const result = await hashBytes(data, algorithm); setHash(result); onResult(`${algorithm} hash`, result); } catch (error) { setHash(`Error: ${errorMessage(error)}`); } finally { setBusy(false); } };
  const checksum = safe(() => ({ crc8: crc8(input, mode), crc16: crc16(input, mode), crc32: crc32(input, mode), adler32: adler32(input, mode), xor: xorChecksum(input, mode) }));
  return <>
    <section className="card"><h2>Local hashing</h2><div className="grid grid--form"><TextField label="Text or hexadecimal bytes" value={input} onChange={setInput} multiline rows={4} /><SelectField label="Input mode" value={mode} onChange={(next) => setMode(next as 'text' | 'hex')} options={[{ value: 'text', label: 'UTF-8 text' }, { value: 'hex', label: 'Hexadecimal bytes' }]} /><SelectField label="Hash algorithm" value={algorithm} onChange={(next) => setAlgorithm(next as HashAlgorithm)} options={HASH_ALGORITHMS.map((value) => ({ value, label: value }))} /><label className="field"><span className="field__label">Hash a file</span><input className="field__input" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setFileName(file.name); void file.arrayBuffer().then((buffer) => setBytes(new Uint8Array(buffer))); }} /><span className="field__hint">{fileName || 'Optional; files stay on this device.'}</span></label></div><button type="button" className="btn btn--primary" onClick={() => void runHash()} disabled={busy}>{busy ? 'Hashing…' : 'Calculate hash'}</button>{hash ? <div className="result-line"><strong>{algorithm}:</strong> <code>{hash}</code> <CopyButton text={hash} label="Copy hash" /></div> : null}<Notice>MD5 and SHA-1 are included for compatibility, not security. Prefer SHA-256 or stronger for integrity-sensitive work.</Notice></section>
    <section className="card"><h2>Checksums</h2>{'value' in checksum ? <OutputList rows={[{ label: 'CRC-8', value: `0x${checksum.value.crc8.toString(16).padStart(2, '0').toUpperCase()}` }, { label: 'CRC-16/IBM', value: `0x${checksum.value.crc16.toString(16).padStart(4, '0').toUpperCase()}` }, { label: 'CRC-32', value: `0x${checksum.value.crc32.toString(16).padStart(8, '0').toUpperCase()}`, emphasize: true }, { label: 'Adler-32', value: `0x${checksum.value.adler32.toString(16).padStart(8, '0').toUpperCase()}` }, { label: 'XOR checksum', value: `0x${checksum.value.xor.toString(16).padStart(2, '0').toUpperCase()}` }]} /> : <Notice kind="error">{checksum.error}</Notice>}</section>
  </>;
}

function BytesTab({ onResult }: { onResult: (label: string, value: string) => void }) {
  void onResult;
  const [hex, setHex] = useState('12 34 56 78'); const [wordSize, setWordSize] = useState('4'); const [colour, setColour] = useState('#336699cc'); const [r, setR] = useState('51'); const [g, setG] = useState('102'); const [b, setB] = useState('153'); const [a, setA] = useState('204'); const bytes = safe(() => hexBytes(hex)); const color = safe(() => hexColorToRgba(colour)); const rgbHex = safe(() => rgbaToHex(Number(r), Number(g), Number(b), Number(a)));
  return <>
    <section className="card"><h2>Endianness and byte tools</h2><div className="grid grid--form"><TextField label="Hex bytes" value={hex} onChange={setHex} /><SelectField label="Word size" value={wordSize} onChange={setWordSize} options={[{ value: '2', label: '16-bit words' }, { value: '4', label: '32-bit words' }, { value: '8', label: '64-bit words' }]} /></div>{'value' in bytes ? <OutputList rows={[{ label: 'Big-endian input', value: bytesToHex(bytes.value), emphasize: true }, { label: 'Byte groups', value: valueOr(safe(() => groupHexBytes(hex, Number(wordSize))), 'Invalid grouping') }, { label: 'Little-endian / byte swap', value: valueOr(safe(() => bytesToHex(bytes.value.slice().reverse())), '') }, { label: 'Word swap', value: valueOr(safe(() => wordSwap(hex, Number(wordSize))), 'Word size does not divide input') }, { label: '16-bit byte swap', value: valueOr(safe(() => wordSwap(hex, 2)), 'Not divisible by 2') }, { label: '32-bit byte swap', value: valueOr(safe(() => wordSwap(hex, 4)), 'Not divisible by 4') }, { label: '64-bit byte swap', value: valueOr(safe(() => wordSwap(hex, 8)), 'Not divisible by 8') }]} /> : <Notice kind="error">{bytes.error}</Notice>}<div className="result-line"><strong>Grouped:</strong> {valueOr(safe(() => wordSwap(hex, Number(wordSize))), 'Invalid grouping')} <CopyButton text={valueOr(safe(() => wordSwap(hex, Number(wordSize))), '')} label="Copy swapped bytes" /></div></section>
    <section className="card"><h2>HEX and colour</h2><div className="grid grid--form"><TextField label="HEX colour" value={colour} onChange={setColour} /><TextField label="Red 0–255" value={r} onChange={setR} /><TextField label="Green 0–255" value={g} onChange={setG} /><TextField label="Blue 0–255" value={b} onChange={setB} /><TextField label="Alpha 0–255" value={a} onChange={setA} /></div>{'value' in color ? <OutputList rows={[{ label: 'R', value: String(color.value.r) }, { label: 'G', value: String(color.value.g) }, { label: 'B', value: String(color.value.b) }, { label: 'A', value: String(color.value.a) }, { label: 'RGBA hex', value: rgbaToHex(color.value.r, color.value.g, color.value.b, color.value.a), emphasize: true }]} /> : <Notice kind="error">{color.error}</Notice>}{'value' in rgbHex ? <div className="result-line"><strong>RGBA to HEX:</strong> {rgbHex.value} <CopyButton text={rgbHex.value} label="Copy colour" /></div> : <Notice kind="error">{rgbHex.error}</Notice>}</section>
  </>;
}

function ExpressionTab({ onResult }: { onResult: (label: string, value: string) => void }) {
  void onResult;
  const [expression, setExpression] = useState('(0xff & 0b1111) << 4 | 3'); const [language, setLanguage] = useState<CodeLanguage>('javascript'); const [representation, setRepresentation] = useState<'decimal' | 'hex' | 'binary' | 'octal'>('hex'); const result = useMemo(() => safe(() => evaluateProgrammerExpression(expression)), [expression]);
  return <section className="card"><h2>Safe developer expression calculator</h2><p>Supports +, −, ×, /, %, &, |, ^, ~, &lt;&lt;, &gt;&gt;, parentheses and decimal, binary, octal or hexadecimal integers. It uses a parser rather than dynamic code execution.</p><TextField label="Expression" value={expression} onChange={setExpression} /><div className="grid grid--form"><SelectField label="Programming language" value={language} onChange={(next) => setLanguage(next as CodeLanguage)} options={CODE_LANGUAGES} /><SelectField label="Literal base" value={representation} onChange={(next) => setRepresentation(next as typeof representation)} options={[{ value: 'decimal', label: 'Decimal' }, { value: 'hex', label: 'Hexadecimal' }, { value: 'binary', label: 'Binary' }, { value: 'octal', label: 'Octal' }]} /></div>{'value' in result ? <><OutputList rows={[{ label: 'Exact decimal', value: result.value.toString(), emphasize: true }, { label: 'Hex', value: `0x${result.value.toString(16).toUpperCase()}` }, { label: 'Binary', value: `0b${result.value.toString(2)}` }, { label: 'Octal', value: `0o${result.value.toString(8)}` }, { label: `${language} literal`, value: codeLiteral(result.value, language, representation) }]} /><CopyButton text={codeLiteral(result.value, language, representation)} label="Copy code literal" /></> : <Notice kind="error">{result.error}</Notice>}</section>;
}

function UtilitiesTab({ onResult }: { onResult: (label: string, value: string) => void }) {
  const [randomMin, setRandomMin] = useState('0'); const [randomMax, setRandomMax] = useState('255'); const [randomLength, setRandomLength] = useState('16'); const [pattern, setPattern] = useState('(?<word>\\w+)'); const [flags, setFlags] = useState('gi'); const [testString, setTestString] = useState('Hello world'); const [search, setSearch] = useState(''); const [generated, setGenerated] = useState('');
  const regex = useMemo(() => safe(() => testRegex(pattern, flags, testString)), [flags, pattern, testString]); const references = PROGRAMMER_REFERENCES_LOCAL(search);
  const generate = (kind: string) => { const result = kind === 'UUID v4' ? randomUuid() : kind === 'Random integer' ? randomInteger(BigInt(randomMin), BigInt(randomMax)).toString() : kind === 'Random bytes' ? bytesToHex(randomBytes(Number(randomLength))) : kind === 'Random binary' ? Array.from(randomBytes(Math.ceil(Number(randomLength) / 8))).map((byte) => byte.toString(2).padStart(8, '0')).join('').slice(0, Number(randomLength)) : kind === 'Random hex' ? bytesToHex(randomBytes(Math.ceil(Number(randomLength) / 2)), '').slice(0, Number(randomLength)) : kind === 'Random IPv4' ? randomIPv4() : kind === 'Random MAC' ? randomMac() : new Date().toISOString(); setGenerated(result); onResult(kind, result); };
  return <>
    <section className="card"><h2>Developer generators</h2><div className="grid grid--form"><TextField label="Minimum" value={randomMin} onChange={setRandomMin} /><TextField label="Maximum" value={randomMax} onChange={setRandomMax} /><TextField label="Length (bits/bytes/hex digits)" value={randomLength} onChange={setRandomLength} /></div><div className="row generator-buttons">{['UUID v4', 'Random integer', 'Random bytes', 'Random binary', 'Random hex', 'Random IPv4', 'Random MAC', 'Random timestamp'].map((kind) => <button key={kind} type="button" className="btn btn--small" onClick={() => { try { generate(kind); } catch (error) { setGenerated(`Error: ${errorMessage(error)}`); } }}>{kind}</button>)}</div>{generated ? <div className="result-line"><code>{generated}</code><CopyButton text={generated} label="Copy generated value" /></div> : null}</section>
    <section className="card"><h2>Regex tester</h2><div className="grid grid--form"><TextField label="Regular expression" value={pattern} onChange={setPattern} /><TextField label="Flags" value={flags} onChange={setFlags} /><TextField label="Test string" value={testString} onChange={setTestString} multiline rows={3} /></div>{'value' in regex ? <><Notice kind={regex.value.matched ? 'info' : 'warn'}>{regex.value.matched ? `${regex.value.matches.length} match(es)` : 'No match'}</Notice>{regex.value.matches.length ? <OutputList rows={regex.value.matches.map((match, index) => ({ label: `Match ${index + 1} at ${match.index}`, value: `${match.text}${match.groups.length ? ` | captures: ${match.groups.join(', ')}` : ''}${Object.keys(match.namedGroups).length ? ` | named: ${Object.entries(match.namedGroups).map(([name, value]) => `${name}=${value}`).join(', ')}` : ''}` }))} /> : null}</> : <Notice kind="error">{regex.error}</Notice>}</section>
    <section className="card"><h2>Developer references</h2><TextField label="Search reference tables" value={search} onChange={setSearch} placeholder="ASCII, SSH, mask…" /><div className="table-scroll"><table className="table"><thead><tr><th>Reference</th><th>Value</th></tr></thead><tbody>{references.map((entry) => <tr key={entry.label}><td>{entry.label}</td><td><code>{entry.value}</code></td></tr>)}</tbody></table></div></section>
  </>;
}
function PROGRAMMER_REFERENCES_LOCAL(search: string): { label: string; value: string }[] { const query = search.trim().toLowerCase(); const rows = [
  ...Array.from({ length: 16 }, (_, exponent) => ({ label: `2^${exponent}`, value: String(2 ** exponent) })),
  ...[0, 1, 2, 7, 8, 9, 10, 13, 27, 32, 127, 255, 256, 1024].map((value) => ({ label: `Value ${value} / hex`, value: `0x${value.toString(16).toUpperCase()}` })),
  ...[{ label: 'ASCII 32', value: 'space' }, { label: 'ASCII 48–57', value: '0–9' }, { label: 'ASCII 65–90', value: 'A–Z' }, { label: 'ASCII 97–122', value: 'a–z' }, { label: 'Integer limits', value: 'signed n-bit: −2^(n−1) … 2^(n−1)−1' }, { label: 'Unsigned limit', value: '0 … 2^n−1' }, { label: 'SSH TCP', value: '22' }, { label: 'DNS TCP/UDP', value: '53' }, { label: 'HTTP TCP', value: '80' }, { label: 'HTTPS TCP', value: '443' }, { label: 'Loopback', value: '127.0.0.1' }, { label: 'IPv4 private ranges', value: '10/8, 172.16/12, 192.168/16' }],
  ]; return query ? rows.filter((row) => `${row.label} ${row.value}`.toLowerCase().includes(query)) : rows; }

function HistoryCard({ history, onClear }: { history: HistoryEntry[]; onClear: () => void }) { if (!history.length) return null; return <section className="card programmer-history"><div className="card__heading"><h2>Calculation history</h2><button type="button" className="btn btn--ghost btn--small" onClick={onClear}>Clear history</button></div><div className="table-scroll"><table className="table"><thead><tr><th>Tool</th><th>Result</th></tr></thead><tbody>{history.map((entry) => <tr key={entry.id}><td>{entry.label}</td><td><code>{entry.value}</code></td></tr>)}</tbody></table></div></section>; }

// Kept local to avoid making the network UI dependent on a second representation.
function xorChecksumLocalUnused(): never { throw new Error('unused'); }
void xorChecksumLocalUnused;
