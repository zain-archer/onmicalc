import { useMemo, useState } from 'react';
import * as mx from '@/math/matrices';
import * as vec from '@/math/vectors';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';

import { CopyButton, Notice, OutputList, Tabs, TextField } from '@/ui/components/primitives';

const MATRIX_OPS = [
  { id: 'add', label: 'A + B' },
  { id: 'sub', label: 'A − B' },
  { id: 'mul', label: 'A × B' },
  { id: 'det', label: 'det(A)' },
  { id: 'inv', label: 'A⁻¹' },
  { id: 'rank', label: 'rank(A)' },
  { id: 'trace', label: 'trace(A)' },
  { id: 'transpose', label: 'Aᵀ' },
  { id: 'rref', label: 'RREF(A)' },
  { id: 'eigen', label: 'Eigenvalues / vectors' },
] as const;

const VECTOR_OPS = [
  { id: 'add', label: 'u + v' },
  { id: 'sub', label: 'u − v' },
  { id: 'dot', label: 'u · v' },
  { id: 'cross', label: 'u × v' },
  { id: 'magnitude', label: '|u|' },
  { id: 'unit', label: 'û (unit vector)' },
  { id: 'projection', label: 'proj_v(u)' },
  { id: 'angle', label: 'Angle between' },
] as const;

export function MatrixPanel() {
  const settings = useSettings();
  const [tab, setTab] = useState<'matrix' | 'vector'>('matrix');
  return (
    <div className="stack">
      <Tabs
        tabs={[
          { id: 'matrix', label: 'Matrices' },
          { id: 'vector', label: 'Vectors' },
        ]}
        value={tab}
        onChange={(id) => setTab(id as 'matrix' | 'vector')}
        label="Linear algebra mode"
      />
      {tab === 'matrix' ? <MatrixTool precision={settings.precision} /> : <VectorTool precision={settings.precision} />}
    </div>
  );
}

function MatrixTool({ precision }: { precision: number }) {
  const [aText, setAText] = useState('4 3; 6 3');
  const [bText, setBText] = useState('1 0; 0 1');
  const [op, setOp] = useState<(typeof MATRIX_OPS)[number]['id']>('det');
  const [steps, setSteps] = useState<mx.EliminationStep[] | null>(null);

  const a = useMemo(() => mx.parseMatrix(aText), [aText]);
  const b = useMemo(() => mx.parseMatrix(bText), [bText]);

  const outcome = useMemo(() => {
    if (!a) return { ok: false as const, message: 'Matrix A is not valid. Use rows like "1 2; 3 4".' };
    if (!b && ['add', 'sub', 'mul'].includes(op)) {
      return { ok: false as const, message: 'Matrix B is not valid. Use rows like "1 2; 3 4".' };
    }
    try {
      switch (op) {
        case 'add':
          return { ok: true as const, rows: rowsOf(mx.add(a, b!), precision) };
        case 'sub':
          return { ok: true as const, rows: rowsOf(mx.subtract(a, b!), precision) };
        case 'mul':
          return { ok: true as const, rows: rowsOf(mx.multiply(a, b!), precision) };
        case 'det':
          return { ok: true as const, rows: [{ label: 'det(A)', value: formatNumber(mx.determinant(a), { precision }), emphasize: true }] };
        case 'inv':
          return { ok: true as const, rows: rowsOf(mx.inverse(a), precision) };
        case 'rank':
          return { ok: true as const, rows: [{ label: 'rank(A)', value: String(mx.rank(a)), emphasize: true }] };
        case 'trace':
          return { ok: true as const, rows: [{ label: 'trace(A)', value: formatNumber(mx.trace(a), { precision }), emphasize: true }] };
        case 'transpose':
          return { ok: true as const, rows: rowsOf(mx.transpose(a), precision) };
        case 'rref': {
          const reduced = mx.rref(a);
          const rank = mx.rank(a);
          const unknowns = mx.cols(a);
          return {
            ok: true as const,
            rows: rowsOf(reduced, precision),
            note:
              rank === unknowns
                ? 'The system has a unique solution when read as an augmented matrix.'
                : `Rank ${rank} is less than the ${unknowns} columns, so a solution (if any) is not unique.`,
          };
        }
        case 'eigen': {
          const result = mx.eigenvalues(a);
          if (result.values.length === 0) {
            return {
              ok: true as const,
              rows: [{ label: 'Eigenvalues', value: 'No real eigenvalues' }],
              note: 'This matrix has complex eigenvalues, which the real-valued eigen solver does not report.',
            };
          }
          return {
            ok: true as const,
            rows: result.values.flatMap((value, index) => [
              { label: `λ${index + 1}`, value: formatNumber(value, { precision }) },
              {
                label: `v${index + 1}`,
                value: vec.formatVector(result.vectors[index] ?? [], precision),
              },
            ]),
            note: 'Eigenvectors are normalised to unit length and satisfy A·v = λ·v.',
          };
        }
      }
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [a, b, op, precision]);

  const characteristic = useMemo(() => {
    if (!a) return null;
    try {
      return mx.characteristicPolynomial(a);
    } catch {
      return null;
    }
  }, [a]);

  const showSteps = () => {
    if (!a) return;
    try {
      setSteps(mx.gaussianElimination(a));
    } catch {
      setSteps(null);
    }
  };

  return (
    <>
      <section className="card">
        <div className="grid grid--form">
          <TextField
            label="Matrix A"
            value={aText}
            onChange={setAText}
            multiline
            rows={3}
            placeholder="1 2; 3 4"
            hint="Rows separated by ; or new lines. Up to 5×5 and beyond."
          />
          <TextField
            label="Matrix B"
            value={bText}
            onChange={setBText}
            multiline
            rows={3}
            placeholder="1 0; 0 1"
            hint="Used by +, − and ×."
          />
          <label className="field">
            <span className="field__label">Operation</span>
            <select className="field__input" value={op} onChange={(event) => setOp(event.target.value as typeof op)}>
              {MATRIX_OPS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card" aria-live="polite">
        <h2>Result</h2>
        {outcome.ok ? (
          <>
            <OutputList rows={outcome.rows} />
            {'note' in outcome && outcome.note ? <Notice>{outcome.note}</Notice> : null}
            {characteristic ? (
              <p className="mono-line">
                Characteristic polynomial: {polynomialString(characteristic)}
              </p>
            ) : null}
          </>
        ) : (
          <Notice kind="error">{outcome.message}</Notice>
        )}
      </section>

      <section className="card">
        <h2>Step-by-step elimination</h2>
        <p>Shows the exact row operations performed by Gaussian elimination — nothing is invented.</p>
        <div className="row">
          <button type="button" className="btn btn--small" onClick={showSteps} disabled={!a}>
            Compute steps
          </button>
          {steps ? (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setSteps(null)}>
              Hide
            </button>
          ) : null}
        </div>
        {steps ? (
          steps.length === 0 ? (
            <Notice>The matrix is already in reduced form; no operations were required.</Notice>
          ) : (
            <ol className="steps">
              {steps.map((step, index) => (
                <li key={index}>
                  <span className="steps__text">{step.description}</span>
                  <pre className="steps__matrix">{mx.formatMatrix(step.matrix, 6)}</pre>
                </li>
              ))}
            </ol>
          )
        ) : null}
      </section>
    </>
  );
}

function VectorTool({ precision }: { precision: number }) {
  const [uText, setUText] = useState('1 2 3');
  const [vText, setVText] = useState('4 -5 6');
  const [op, setOp] = useState<(typeof VECTOR_OPS)[number]['id']>('dot');

  const u = useMemo(() => vec.parseVector(uText), [uText]);
  const v = useMemo(() => vec.parseVector(vText), [vText]);

  const outcome = useMemo(() => {
    if (!u) return { ok: false as const, message: 'Vector u is not valid. Try "1 2 3".' };
    if (!v && op !== 'magnitude' && op !== 'unit') {
      return { ok: false as const, message: 'Vector v is not valid. Try "1 2 3".' };
    }
    try {
      switch (op) {
        case 'add':
          return { ok: true as const, rows: [{ label: 'u + v', value: vec.formatVector(vec.add(u, v!), precision), emphasize: true }] };
        case 'sub':
          return { ok: true as const, rows: [{ label: 'u − v', value: vec.formatVector(vec.subtract(u, v!), precision), emphasize: true }] };
        case 'dot':
          return { ok: true as const, rows: [{ label: 'u · v', value: formatNumber(vec.dot(u, v!), { precision }), emphasize: true }] };
        case 'cross':
          return { ok: true as const, rows: [{ label: 'u × v', value: vec.formatVector(vec.cross(u, v!), precision), emphasize: true }] };
        case 'magnitude':
          return { ok: true as const, rows: [{ label: '|u|', value: formatNumber(vec.magnitude(u), { precision }), emphasize: true }] };
        case 'unit':
          return { ok: true as const, rows: [{ label: 'û', value: vec.formatVector(vec.normalize(u), precision), emphasize: true }] };
        case 'projection':
          return {
            ok: true as const,
            rows: [
              { label: 'proj_v(u)', value: vec.formatVector(vec.projection(u, v!), precision), emphasize: true },
              { label: 'Scalar projection', value: formatNumber(vec.projectionScalar(u, v!), { precision }) },
            ],
          };
        case 'angle': {
          const radians = vec.angleBetween(u, v!);
          const factor = radians * (180 / Math.PI);
          return {
            ok: true as const,
            rows: [
              { label: 'Angle (degrees)', value: `${formatNumber(factor, { precision })}°`, emphasize: true },
              { label: 'Angle (radians)', value: formatNumber(radians, { precision }) },
            ],
          };
        }
      }
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [u, v, op, precision]);

  return (
    <>
      <section className="card">
        <div className="grid grid--form">
          <TextField label="Vector u" value={uText} onChange={setUText} placeholder="1 2 3" hint="Space or comma separated." />
          <TextField label="Vector v" value={vText} onChange={setVText} placeholder="4 -5 6" />
          <label className="field">
            <span className="field__label">Operation</span>
            <select className="field__input" value={op} onChange={(event) => setOp(event.target.value as typeof op)}>
              {VECTOR_OPS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="card" aria-live="polite">
        <h2>Result</h2>
        {outcome.ok ? (
          <>
            <OutputList rows={outcome.rows} />
            <div className="row">
              <CopyButton text={outcome.rows.map((row) => `${row.label}: ${row.value}`).join('\n')} label="Copy result" />
            </div>
          </>
        ) : (
          <Notice kind="error">{outcome.message}</Notice>
        )}
      </section>
    </>
  );
}

function rowsOf(matrix: number[][], precision: number) {
  return matrix.map((row, index) => ({
    label: `Row ${index + 1}`,
    value: row.map((value) => formatNumber(value, { precision })).join('   '),
  }));
}

function polynomialString(coefficients: readonly number[]): string {
  const degree = coefficients.length - 1;
  return coefficients
    .map((value, index) => {
      if (value === 0) return null;
      const power = degree - index;
      const number = Number(value.toPrecision(6));
      const term = power === 0 ? `${number}` : power === 1 ? `${number}λ` : `${number}λ^${power}`;
      return term;
    })
    .filter((term): term is string => term !== null)
    .join(' + ')
    .replace(/\+ -/g, '− ');
}
