import { useMemo, useState } from 'react';
import {
  applyBitwiseBig,
  BITWISE_OPS,
  formatBigIntInBase,
  integerOperation,
  isBase,
  parseBigIntInBase,
  type Base,
  type BitWidth,
  type BitwiseOp,
  type IntegerOp,
} from '@/math/numberSystems';
import { errorMessage } from '@/core/errors';
import { Notice, OutputList, SelectField } from '@/ui/components/primitives';
import { BitStrip } from './NumberSystemsPanel';

const BASE_CHOICES: { value: string; label: string }[] = [
  { value: '16', label: 'HEX' },
  { value: '10', label: 'DEC' },
  { value: '8', label: 'OCT' },
  { value: '2', label: 'BIN' },
];

const DIGIT_KEYS = [
  ['D', 'E', 'F'],
  ['A', 'B', 'C'],
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['0', '±'],
] as const;

const ARITHMETIC: { id: IntegerOp; label: string }[] = [
  { id: 'add', label: '+' },
  { id: 'subtract', label: '−' },
  { id: 'multiply', label: '×' },
  { id: 'divide', label: '÷' },
  { id: 'mod', label: 'mod' },
  { id: 'power', label: 'xʸ' },
];

export function ProgrammerPanel() {
  const [baseText, setBaseText] = useState('10');
  const [width, setWidth] = useState<BitWidth>(32);
  const [input, setInput] = useState('0');
  const [accumulator, setAccumulator] = useState<string | null>(null);
  const [pendingOp, setPendingOp] = useState<IntegerOp | null>(null);
  const [bitOp, setBitOp] = useState<BitwiseOp>('and');
  const [bitOperand, setBitOperand] = useState('0');
  const [signed, setSigned] = useState(false);
  const [wrapped, setWrapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = (isBase(Number(baseText)) ? Number(baseText) : 10) as Base;

  const value = useMemo(() => {
    const parsed = parseBigIntInBase(input, base);
    return parsed ?? 0n;
  }, [input, base]);

  const display = useMemo(() => {
    try {
      return applyBitwiseBig('and', value.toString(), ((1n << BigInt(width)) - 1n).toString(), width);
    } catch {
      return null;
    }
  }, [value, width]);

  const press = (key: string) => {
    if (key === '±') {
      setInput((current) => (current.startsWith('-') ? current.slice(1) : `-${current}`));
      return;
    }
    setInput((current) => (current === '0' ? key : current + key.toLowerCase()));
  };

  const runOperation = (op: IntegerOp, left: string, right: string): void => {
    // Integer arithmetic can legitimately fail (÷ 0, mod 0, invalid digits).
    // That is a message for the user, never a crash inside an event handler.
    try {
      const outcome = integerOperation(op, left, right, width);
      setError(null);
      setWrapped(outcome.overflowed);
      setAccumulator(outcome.signed);
      setInput(formatBigIntInBase(BigInt(outcome.signed), base, base === 16));
      setPendingOp(null);
    } catch (err) {
      setError(errorMessage(err));
      setPendingOp(null);
      setAccumulator(null);
      setWrapped(false);
    }
  };

  const applyOp = (op: IntegerOp) => {
    if (pendingOp && accumulator !== null) {
      runOperation(pendingOp, accumulator, value.toString());
      return;
    }
    if (op === 'power' && accumulator === null) {
      // xʸ squares the current value using the pending exponent field.
      setAccumulator(value.toString());
      setPendingOp('power');
      setInput('2');
      return;
    }
    setAccumulator(value.toString());
    setPendingOp(op === 'power' ? 'power' : op);
    setInput('0');
  };

  const equals = () => {
    if (!pendingOp) return;
    runOperation(pendingOp, accumulator ?? '0', value.toString());
  };

  const applyBitwiseOp = () => {
    try {
      const result = applyBitwiseBig(bitOp, value.toString(), bitOperand.trim() || '0', width);
      setError(null);
      setInput(formatBigIntInBase(BigInt(result.signedDecimal), base, base === 16));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const rows = useMemo(() => {
    if (!display) return [];
    return [
      { label: 'Unsigned', value: display.unsignedDecimal, emphasize: true },
      { label: 'Signed (two’s complement)', value: display.signedDecimal },
      { label: 'Hexadecimal', value: `0x${display.hex}` },
      { label: 'Octal', value: `0o${display.octal}` },
      { label: 'Binary', value: display.binary },
    ];
  }, [display]);

  return (
    <div className="stack">
      <section className="card">
        <div className="grid grid--form">
          <SelectField label="Input base" value={baseText} onChange={setBaseText} options={BASE_CHOICES} />
          <SelectField
            label="Bit width"
            value={String(width)}
            onChange={(next) => setWidth(Number(next) as BitWidth)}
            options={[8, 16, 32, 64].map((value) => ({ value: String(value), label: `${value}-bit` }))}
          />
          <SelectField
            label="Bitwise operation"
            value={bitOp}
            onChange={(next) => setBitOp(next as BitwiseOp)}
            options={BITWISE_OPS.map((entry) => ({ value: entry.id, label: entry.label }))}
          />
        </div>

        <label className="field program__display">
          <span className="field__label">
            Accumulator {pendingOp ? <span className="field__unit">pending {pendingOp}</span> : null}
          </span>
          <input
            className="field__input program__input"
            value={input}
            spellCheck={false}
            aria-label="Integer input"
            onChange={(event) => setInput(event.target.value)}
          />
        </label>

        <div className="program">
          <div className="program__keys">
            {DIGIT_KEYS.flat().map((key) => (
              <button key={key} type="button" className="key key--digit" onClick={() => press(key)}>
                {key}
              </button>
            ))}
          </div>
          <div className="program__ops">
            {ARITHMETIC.map((entry) => (
              <button key={entry.id} type="button" className="key key--function" onClick={() => applyOp(entry.id)}>
                {entry.label}
              </button>
            ))}
            <button type="button" className="key key--accent" onClick={equals} title="Evaluate" aria-label="Evaluate">
              =
            </button>
            <button
              type="button"
              aria-label="Clear"
              title="Clear"
              className="key key--danger"
              onClick={() => {
                setInput('0');
                setAccumulator(null);
                setPendingOp(null);
                setWrapped(false);
              }}
            >
              AC
            </button>
            <button
              type="button"
              className="key key--function"
              onClick={() => setInput((current) => current.slice(0, -1) || '0')}
            >
              ⌫
            </button>
          </div>
        </div>

        <div className="row program__bitop">
          <label className="field">
            <span className="field__label">Bitwise operand</span>
            <input
              className="field__input"
              value={bitOperand}
              onChange={(event) => setBitOperand(event.target.value)}
              spellCheck={false}
            />
          </label>
          <button type="button" className="btn btn--small" onClick={applyBitwiseOp}>
            Apply
          </button>
          <label className="field field--check">
            <input type="checkbox" checked={signed} onChange={(event) => setSigned(event.target.checked)} />
            <span>Show signed value as the main display</span>
          </label>
        </div>
      </section>

      <section className="card" aria-live="polite">
        <h2>Result</h2>
        {!display ? (
          <Notice kind="error">The current input is not a valid integer.</Notice>
        ) : (
          <>
            <OutputList
              rows={
                signed
                  ? [rows[1]!, ...rows.filter((_, index) => index !== 1)]
                  : rows
              }
            />
            <BitStrip binary={display.binary} width={width} />
            {error ? <Notice kind="error">{error}</Notice> : null}
            {wrapped ? (
              <Notice kind="error">
                The exact result did not fit in {width} bits, so it wrapped modulo 2^{width} exactly like a
                hardware register.
              </Notice>
            ) : (
              <Notice>
                Values wrap modulo 2^{width} like a hardware register. Signed values use two’s
                complement, and arithmetic is exact for the full 64-bit range.
              </Notice>
            )}
          </>
        )}
      </section>
    </div>
  );
}
