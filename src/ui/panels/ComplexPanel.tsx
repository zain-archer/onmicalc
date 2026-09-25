import { useMemo, useState } from 'react';
import * as cx from '@/math/complex';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { appendToDraft } from '@/ui/bus';
import { CopyButton, Notice, OutputList, SelectField, TextField } from '@/ui/components/primitives';

const OPERATIONS = [
  { id: 'add', label: 'z₁ + z₂' },
  { id: 'sub', label: 'z₁ − z₂' },
  { id: 'mul', label: 'z₁ × z₂' },
  { id: 'div', label: 'z₁ ÷ z₂' },
  { id: 'pow', label: 'z₁ ^ z₂' },
] as const;

export function ComplexPanel() {
  const settings = useSettings();
  const [left, setLeft] = useState('3+4i');
  const [right, setRight] = useState('1-2i');
  const [op, setOp] = useState<(typeof OPERATIONS)[number]['id']>('mul');
  const [rootIndex, setRootIndex] = useState('3');

  const a = useMemo(() => cx.parseComplex(left), [left]);
  const b = useMemo(() => cx.parseComplex(right), [right]);

  const result = useMemo(() => {
    if (!a || !b) {
      return { ok: false as const, message: 'Enter complex numbers such as 3+4i, -2i or 5.' };
    }
    try {
      const value =
        op === 'add'
          ? cx.add(a, b)
          : op === 'sub'
            ? cx.subtract(a, b)
            : op === 'mul'
              ? cx.multiply(a, b)
              : op === 'div'
                ? cx.divide(a, b)
                : cx.pow(a, b);
      return { ok: true as const, value };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [a, b, op]);

  const roots = useMemo(() => {
    if (!a) return null;
    const n = Number(rootIndex);
    if (!Number.isInteger(n) || n < 1 || n > 12) return null;
    try {
      return cx.roots(a, n);
    } catch {
      return null;
    }
  }, [a, rootIndex]);

  const z = result.ok ? result.value : null;
  const precision = settings.precision;

  return (
    <div className="stack">
      <section className="card">
        <h2>Complex arithmetic</h2>
        <div className="grid grid--form">
          <TextField label="z₁" value={left} onChange={setLeft} placeholder="3+4i" />
          <TextField label="z₂" value={right} onChange={setRight} placeholder="1-2i" />
          <SelectField
            label="Operation"
            value={op}
            onChange={(value) => setOp(value as typeof op)}
            options={OPERATIONS.map((entry) => ({ value: entry.id, label: entry.label }))}
          />
        </div>

        {result.ok && z ? (
          <>
            <OutputList
              title="Result"
              rows={[
                { label: 'Rectangular', value: cx.formatComplex(z, precision), emphasize: true },
                { label: 'Polar (current angle mode)', value: cx.formatPolar(z, 6, settings.angleMode === 'RAD' ? 'RAD' : settings.angleMode === 'GRAD' ? 'GRAD' : 'DEG') },
                { label: 'Real part', value: formatNumber(z.re, { precision }) },
                { label: 'Imaginary part', value: formatNumber(z.im, { precision }) },
              ]}
            />
            <div className="row">
              <CopyButton text={cx.formatComplex(z, precision)} label="Copy result" />
              <button type="button" className="btn btn--ghost btn--small" onClick={() => appendToDraft(cx.formatComplex(z, precision))}>
                Use in calculator
              </button>
            </div>
          </>
        ) : (
          <Notice kind="error">{result.ok ? '' : result.message}</Notice>
        )}
      </section>

      <section className="card">
        <h2>Properties of z₁</h2>
        {!a ? (
          <Notice kind="error">z₁ is not a valid complex number.</Notice>
        ) : (
          <OutputList
            rows={[
              { label: 'Magnitude |z|', value: formatNumber(cx.magnitude(a), { precision }), emphasize: true },
              {
                label: 'Argument arg(z)',
                value: (() => {
                  try {
                    const radians = cx.argument(a);
                    const factor = settings.angleMode === 'DEG' ? 180 / Math.PI : settings.angleMode === 'GRAD' ? 200 / Math.PI : 1;
                    return `${formatNumber(radians * factor, { precision })} ${settings.angleMode === 'DEG' ? '°' : settings.angleMode === 'GRAD' ? 'grad' : 'rad'}`;
                  } catch {
                    return 'undefined for 0';
                  }
                })(),
              },
              { label: 'Conjugate', value: cx.formatComplex(cx.conjugate(a), precision) },
              { label: 'Reciprocal 1/z', value: (() => { try { return cx.formatComplex(cx.divide(cx.complex(1, 0), a), precision); } catch (err) { return errorMessage(err); } })() },
              { label: 'e^z', value: (() => { try { return cx.formatComplex(cx.expOf(a), precision); } catch (err) { return errorMessage(err); } })() },
              { label: 'ln(z)', value: (() => { try { return cx.formatComplex(cx.log(a), precision); } catch (err) { return errorMessage(err); } })() },
              { label: 'sin(z)', value: cx.formatComplex(cx.sin(a), precision) },
              { label: 'cos(z)', value: cx.formatComplex(cx.cos(a), precision) },
              { label: 'tan(z)', value: (() => { try { return cx.formatComplex(cx.tan(a), precision); } catch (err) { return errorMessage(err); } })() },
            ]}
          />
        )}
      </section>

      <section className="card">
        <h2>Roots of z₁</h2>
        <TextField
          label="Root index n"
          value={rootIndex}
          onChange={setRootIndex}
          hint="Returns all n distinct nth roots (1–12)."
        />
        {roots ? (
          <OutputList
            rows={roots.map((root, index) => ({
              label: `Root ${index + 1}`,
              value: cx.formatComplex(root, precision),
            }))}
          />
        ) : (
          <Notice kind="error">Enter a whole number between 1 and 12.</Notice>
        )}
      </section>
    </div>
  );
}
