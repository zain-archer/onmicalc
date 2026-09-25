import { useMemo, useState } from 'react';
import {
  add,
  compare,
  divide,
  formatFraction,
  fraction,
  fromDecimal,
  multiply,
  parseFraction,
  power,
  subtract,
  toNumber,
  type Fraction,
} from '@/math/arithmetic/fractions';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { appendToDraft } from '@/ui/bus';
import { CopyButton, Notice, OutputList, TextField } from '@/ui/components/primitives';

const OPS = [
  { id: 'add', label: '+', apply: add },
  { id: 'sub', label: '−', apply: subtract },
  { id: 'mul', label: '×', apply: multiply },
  { id: 'div', label: '÷', apply: divide },
] as const;

export function FractionsPanel() {
  const [left, setLeft] = useState('1/2');
  const [right, setRight] = useState('3/4');
  const [op, setOp] = useState<(typeof OPS)[number]['id']>('add');
  const [decimal, setDecimal] = useState('0.375');
  const [exponent, setExponent] = useState('2');
  const [style, setStyle] = useState<'improper' | 'mixed'>('improper');

  const leftValue = useMemo(() => parseFraction(left), [left]);
  const rightValue = useMemo(() => parseFraction(right), [right]);

  const operation = useMemo(() => {
    if (!leftValue || !rightValue) {
      return { ok: false as const, message: 'Enter two valid fractions, e.g. 3/4, "1 1/2" or 5.' };
    }
    try {
      const definition = OPS.find((entry) => entry.id === op)!;
      const result = definition.apply(leftValue, rightValue);
      return { ok: true as const, result, definition };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [leftValue, rightValue, op]);

  const powerResult = useMemo(() => {
    if (!leftValue) return null;
    try {
      return power(leftValue, Number(exponent));
    } catch {
      return null;
    }
  }, [leftValue, exponent]);

  const decimalResult = useMemo(() => {
    const value = Number(decimal);
    if (decimal.trim() === '' || !Number.isFinite(value)) {
      return { ok: false as const, message: 'Enter a decimal number such as 0.375 or 2.5.' };
    }
    try {
      const converted = fromDecimal(value, { maxDenominator: 1_000_000 });
      return { ok: true as const, ...converted };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [decimal]);

  return (
    <div className="stack">
      <section className="card">
        <h2>Fraction arithmetic</h2>
        <div className="fraction-row">
          <TextField label="First fraction" value={left} onChange={setLeft} placeholder="3/4" />
          <div className="fraction-row__op" role="group" aria-label="Operation">
            {OPS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`segmented__item${op === entry.id ? ' is-active' : ''}`}
                aria-pressed={op === entry.id}
                onClick={() => setOp(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <TextField label="Second fraction" value={right} onChange={setRight} placeholder="1 1/2" />
        </div>

        <div className="tabs tabs--inline" role="group" aria-label="Fraction display style">
          {(['improper', 'mixed'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`tabs__tab${style === option ? ' is-active' : ''}`}
              aria-pressed={style === option}
              onClick={() => setStyle(option)}
            >
              {option === 'improper' ? 'Improper (5/4)' : 'Mixed (1 1/4)'}
            </button>
          ))}
        </div>

        {operation.ok ? (
          <OutputList
            rows={[
              {
                label: 'Exact result',
                value: formatFraction(operation.result, style),
                emphasize: true,
              },
              { label: 'Decimal', value: formatNumber(toNumber(operation.result), { precision: 12 }) },
              { label: 'Improper form', value: formatFraction(operation.result, 'improper') },
              { label: 'Mixed form', value: formatFraction(operation.result, 'mixed') },
              { label: 'Simplified', value: reducedLabel(operation.result) },
              {
                label: 'Comparison',
                value: comparisonLabel(leftValue!, rightValue!),
              },
            ]}
          />
        ) : (
          <Notice kind="error">{operation.message}</Notice>
        )}
        {operation.ok ? (
          <div className="row">
            <CopyButton text={formatFraction(operation.result, style)} label="Copy result" />
            <CopyButton text={formatFraction(operation.result, 'mixed')} label="Copy mixed" />
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => appendToDraft(formatFraction(operation.result))}
            >
              Use in calculator
            </button>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>Fraction ↔ decimal</h2>
        <div className="grid grid--form">
          <TextField
            label="Decimal number"
            value={decimal}
            onChange={setDecimal}
            placeholder="0.375"
            hint="Repeating decimals are shown as the nearest exact fraction within a denominator of 1,000,000."
          />
          <TextField
            label="Power of the first fraction"
            value={exponent}
            onChange={setExponent}
            placeholder="2"
            hint="Whole numbers only. Negative exponents invert the fraction."
          />
        </div>
        {decimalResult.ok ? (
          <OutputList
            rows={[
              {
                label: 'Fraction',
                value: formatFraction(decimalResult.fraction, style),
                emphasize: true,
              },
              {
                label: 'Status',
                value: decimalResult.exact
                  ? 'Exact within the denominator limit'
                  : 'Nearest fraction within the denominator limit',
              },
              { label: 'Denominator', value: String(decimalResult.fraction.denominator) },
              { label: 'Decimal check', value: formatNumber(toNumber(decimalResult.fraction), { precision: 12 }) },
            ]}
          />
        ) : (
          <Notice kind="error">{decimalResult.message}</Notice>
        )}
        {powerResult ? (
          <OutputList
            title={`First fraction to the power ${exponent}`}
            rows={[
              { label: 'Exact', value: formatFraction(powerResult, style) },
              { label: 'Decimal', value: formatNumber(toNumber(powerResult), { precision: 12 }) },
            ]}
          />
        ) : null}
      </section>
    </div>
  );
}

function reducedLabel(value: Fraction): string {
  return `${value.numerator}/${value.denominator}`;
}

function comparisonLabel(left: Fraction, right: Fraction): string {
  const order = compare(left, right);
  if (order === 0) return 'Equal';
  return order < 0 ? `${formatFraction(left)} < ${formatFraction(right)}` : `${formatFraction(left)} > ${formatFraction(right)}`;
}

/** Re-exported helpers used by the calculator panel for fraction display. */
export function fractionFromDecimal(value: number, maxDenominator = 1_000_000) {
  return fromDecimal(value, { maxDenominator });
}

export function fractionOf(numerator: number, denominator = 1): Fraction {
  return fraction(numerator, denominator);
}
