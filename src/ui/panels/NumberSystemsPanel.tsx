import { useMemo, useState } from 'react';
import {
  allBases,
  applyBitwiseBig,
  BITWISE_OPS,
  convertBase,
  formatBigIntInBase,
  isBase,
  parseBigIntInBase,
  type Base,
  type BitWidth,
  type BitwiseOp,
} from '@/math/numberSystems';
import { errorMessage } from '@/core/errors';
import { Notice, OutputList, SelectField, TextField } from '@/ui/components/primitives';

const BASES: { value: string; label: string }[] = [
  { value: '2', label: 'Binary (base 2)' },
  { value: '8', label: 'Octal (base 8)' },
  { value: '10', label: 'Decimal (base 10)' },
  { value: '16', label: 'Hexadecimal (base 16)' },
  { value: '36', label: 'Base 36' },
];

const WIDTHS: BitWidth[] = [8, 16, 32, 64];

export function NumberSystemsPanel() {
  const [input, setInput] = useState('255');
  const [fromBase, setFromBase] = useState('10');
  const [toBase, setToBase] = useState('2');
  const [op, setOp] = useState<BitwiseOp>('and');
  const [width, setWidth] = useState<BitWidth>(8);
  const [other, setOther] = useState('15');

  const conversion = useMemo(() => {
    const from = Number(fromBase) as Base;
    const to = Number(toBase) as Base;
    if (!isBase(from) || !isBase(to)) return null;
    const exact = parseBigIntInBase(input, from);
    if (exact === null) {
      return { ok: false as const, message: `"${input}" is not a valid base-${from} whole number.` };
    }
    return { ok: true as const, value: exact, text: formatBigIntInBase(exact, to, true) };
  }, [input, fromBase, toBase]);

  const bitwise = useMemo(() => {
    if (!conversion?.ok) return null;
    try {
      return { ok: true as const, result: applyBitwiseBig(op, conversion.value.toString(), other.trim() || '0', width) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [conversion, op, other, width]);

  const table = useMemo(() => {
    if (!conversion?.ok) return [];
    const value = Number(conversion.value);
    if (!Number.isSafeInteger(value)) return [];
    return allBases(value);
  }, [conversion]);

  return (
    <div className="stack">
      <section className="card">
        <h2>Base conversion</h2>
        <div className="grid grid--form">
          <TextField
            label="Value"
            value={input}
            onChange={setInput}
            placeholder="255"
            hint="Any whole number, including the full 64-bit range."
          />
          <SelectField label="From base" value={fromBase} onChange={setFromBase} options={BASES} />
          <SelectField label="To base" value={toBase} onChange={setToBase} options={BASES} />
        </div>
        {conversion === null || !conversion.ok ? (
          <Notice kind="error">{conversion?.message ?? 'Unsupported base.'}</Notice>
        ) : (
          <OutputList
            rows={[
              { label: `Base ${toBase}`, value: conversion.text, emphasize: true },
              { label: 'Decimal (exact)', value: conversion.value.toString() },
              { label: 'Bits needed', value: conversion.value === 0n ? '1' : (conversion.value < 0n ? -conversion.value : conversion.value).toString(2).length.toString() },
            ]}
          />
        )}
        {table.length > 0 ? (
          <OutputList title="All representations" rows={table.map((row) => ({ label: row.label, value: row.value }))} />
        ) : null}
      </section>

      <section className="card">
        <h2>Bitwise operations</h2>
        <div className="grid grid--form">
          <TextField label="Operand A" value={input} onChange={setInput} hint="Taken from the conversion field above." />
          <TextField label="Operand B" value={other} onChange={setOther} hint="Ignored by NOT." />
          <SelectField
            label="Operation"
            value={op}
            onChange={(value) => setOp(value as BitwiseOp)}
            options={BITWISE_OPS.map((entry) => ({ value: entry.id, label: entry.label }))}
          />
          <SelectField
            label="Bit width"
            value={String(width)}
            onChange={(value) => setWidth(Number(value) as BitWidth)}
            options={WIDTHS.map((value) => ({ value: String(value), label: `${value}-bit` }))}
          />
        </div>
        {bitwise === null ? (
          <Notice kind="error">Fix the operands to compute a bitwise result.</Notice>
        ) : bitwise.ok ? (
          <>
            <OutputList
              rows={[
                { label: 'Unsigned (exact)', value: bitwise.result.unsignedDecimal, emphasize: true },
                { label: 'Signed (two’s complement)', value: bitwise.result.signedDecimal },
                { label: 'Hexadecimal', value: `0x${bitwise.result.hex}` },
                { label: 'Octal', value: `0o${bitwise.result.octal}` },
              ]}
            />
            <p className="mono-line">Binary: {bitwise.result.binary}</p>
            <BitStrip binary={bitwise.result.binary} width={width} />
            <Notice>
              Operations are exact for every width, including 64-bit, because they use BigInt rather
              than 32-bit JavaScript bitwise coercion.
            </Notice>
          </>
        ) : (
          <Notice kind="error">{bitwise.message}</Notice>
        )}
      </section>
    </div>
  );
}

export function BitStrip({ binary, width }: { binary: string; width: BitWidth }) {
  const padded = width === 64 ? binary.padStart(64, '0') : binary.padStart(width, '0');
  const groups = padded.slice(-width).match(/.{1,8}/g) ?? [];
  return (
    <p className="bits" aria-label={`${width}-bit pattern`}>
      {groups.map((group, index) => (
        <span key={index} className="bits__group">
          {[...group].map((bit, bitIndex) => (
            <span key={bitIndex} className={bit === '1' ? 'bits__bit is-set' : 'bits__bit'}>
              {bit}
            </span>
          ))}
        </span>
      ))}
    </p>
  );
}

export { convertBase };
