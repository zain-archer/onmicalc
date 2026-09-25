import { useMemo, useState } from 'react';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import * as chem from '@/math/chemistry';
import { appendToDraft } from '@/ui/bus';
import { CopyButton, EmptyState, Notice, NumberField, OutputList, SelectField, TextField, Tabs } from '@/ui/components/primitives';

const TABS = [
  { id: 'formula', label: 'Formula' },
  { id: 'element', label: 'Elements' },
  { id: 'solution', label: 'Solutions & pH' },
  { id: 'reaction', label: 'Reaction' },
] as const;

/**
 * Chemistry tool: molar mass and composition, the periodic table, solutions and
 * pH, and limiting reactants. All the chemistry lives in `src/math/chemistry`;
 * this panel only collects input and draws the answers.
 */
export function ChemistryPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('formula');
  return (
    <div className="stack">
      <Tabs tabs={TABS} value={tab} onChange={(id) => setTab(id as typeof tab)} label="Chemistry area" />
      {tab === 'formula' ? <FormulaTool /> : null}
      {tab === 'element' ? <ElementTool /> : null}
      {tab === 'solution' ? <SolutionTool /> : null}
      {tab === 'reaction' ? <ReactionTool /> : null}
    </div>
  );
}

function FormulaTool() {
  const settings = useSettings();
  const [formula, setFormula] = useState('H2O');
  const [mass, setMass] = useState<number | ''>(100);
  const [moles, setMoles] = useState<number | ''>('');
  const [particles, setParticles] = useState<number | ''>('');
  const precision = settings.precision;
  const nf = (value: number) => formatNumber(value, { precision });

  const parsed = useMemo(() => {
    try {
      const result = chem.molarMass(formula);
      return { ok: true as const, result, composition: chem.percentComposition(result.display) };
    } catch (error) {
      return { ok: false as const, message: errorMessage(error), details: (error as { details?: string }).details };
    }
  }, [formula]);

  const filled = [mass, moles, particles].filter((value) => value !== '').length;

  const amountResult = useMemo(() => {
    if (!parsed.ok || filled !== 1) return null;
    try {
      return {
        ok: true as const,
        value: chem.amount(parsed.result.display, {
          ...(mass === '' ? {} : { mass }),
          ...(moles === '' ? {} : { moles }),
          ...(particles === '' ? {} : { particles }),
        }),
      };
    } catch (error) {
      return { ok: false as const, message: errorMessage(error) };
    }
  }, [parsed, mass, moles, particles, filled]);

  return (
    <div className="tool">
      <section className="tool__form" aria-label="Inputs">
        <div className="stack">
          <TextField
            label="Formula"
            hint="Element symbols, brackets and hydrates: H2O, Al2(SO4)3, CuSO4·5H2O."
            value={formula}
            onChange={setFormula}
          />
          <NumberField label="Mass" unit="g" value={mass} onChange={setMass} />
          <NumberField
            label="Amount of substance"
            unit="mol"
            hint="Fill in one of mass, moles or particles — the others are worked out."
            value={moles}
            onChange={setMoles}
          />
          <NumberField label="Particles" unit="count" value={particles} onChange={setParticles} />
          {filled > 1 ? <Notice kind="warn">Fill in only one of mass, moles or particles.</Notice> : null}
        </div>
      </section>
      <section className="tool__output" aria-label="Results" aria-live="polite">
        {parsed.ok ? (
          <div className="stack">
            <OutputList
              rows={[
                { label: 'Molar mass', value: nf(parsed.result.molarMass), unit: 'g/mol', emphasize: true },
                { label: 'Atoms per formula unit', value: String(parsed.result.atoms) },
                ...(mass !== ''
                  ? [
                      { label: 'Amount of substance', value: nf(parsed.result.molarMass ? mass / parsed.result.molarMass : 0), unit: 'mol' },
                      {
                        label: 'Particles',
                        value: nf((mass / parsed.result.molarMass) * chem.AVOGADRO),
                      },
                    ]
                  : []),
                ...(moles !== '' ? [{ label: 'Mass', value: nf(moles * parsed.result.molarMass), unit: 'g' }] : []),
                ...(particles !== ''
                  ? [{ label: 'Mass', value: nf((particles / chem.AVOGADRO) * parsed.result.molarMass), unit: 'g' }]
                  : []),
              ]}
              title="Molar mass and amount"
            />
            <OutputList
              rows={parsed.composition.rows.map((row) => ({
                label: `${row.name} (${row.symbol}${row.count === 1 ? '' : row.count})`,
                value: `${nf(row.percent)} %`,
                unit: `${nf(row.mass)} g/mol`,
              }))}
              title="Percent composition"
            />
            {amountResult && !amountResult.ok ? <Notice kind="error">{amountResult.message}</Notice> : null}
            <div className="row">
              <CopyButton text={`M(${parsed.result.display}) = ${nf(parsed.result.molarMass)} g/mol`} label="Copy molar mass" />
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => appendToDraft(`${nf(parsed.result.molarMass)}`)}
              >
                Use in calculator
              </button>
            </div>
          </div>
        ) : (
          <>
            <Notice kind="error">{parsed.message}</Notice>
            {parsed.details ? <p className="field__hint">{parsed.details}</p> : null}
          </>
        )}
      </section>
    </div>
  );
}

function ElementTool() {
  const settings = useSettings();
  const [query, setQuery] = useState('');
  const matches = useMemo(() => chem.searchElements(query).slice(0, 24), [query]);
  const nf = (value: number) => formatNumber(value, { precision: settings.precision });
  const selected = chem.getElement(query) ?? matches[0];

  return (
    <div className="tool">
      <section className="tool__form" aria-label="Inputs">
        <div className="stack">
          <TextField
            label="Find an element"
            hint="Symbol, name, atomic number, category, group or period — try “Fe”, “iron”, “26” or “noble gas”."
            value={query}
            onChange={setQuery}
            placeholder="Fe"
          />
          <p className="field__hint" aria-live="polite">
            {chem.searchElements(query).length} of {chem.ELEMENTS.length} elements match.
          </p>
        </div>
      </section>
      <section className="tool__output" aria-label="Results" aria-live="polite">
        {selected ? (
          <div className="stack">
            <OutputList
              rows={[
                { label: `${selected.name} (${selected.symbol})`, value: String(selected.atomicNumber), unit: 'atomic number', emphasize: true },
                { label: 'Relative atomic mass', value: nf(selected.mass), unit: 'g/mol' },
                { label: 'Category', value: selected.category },
                { label: 'Group / period / block', value: `${selected.group} / ${selected.period} / ${selected.block}` },
                ...(selected.synthetic
                  ? [{ label: 'Mass note', value: 'No stable isotope — this is the most stable isotope’s mass number' }]
                  : []),
              ]}
              title="Element"
            />
            <ul className="formula-list" aria-label="Matching elements">
              {matches.map((element) => (
                <li key={element.symbol}>
                  <button
                    type="button"
                    className={`btn btn--ghost btn--small${element.symbol === selected.symbol ? ' is-active' : ''}`}
                    aria-pressed={element.symbol === selected.symbol}
                    onClick={() => setQuery(element.symbol)}
                  >
                    {element.symbol} · {element.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState>No element matches that search.</EmptyState>
        )}
      </section>
    </div>
  );
}

function SolutionTool() {
  const settings = useSettings();
  const [mode, setMode] = useState<'concentration' | 'dilution' | 'ph'>('concentration');
  const nf = (value: number) => formatNumber(value, { precision: settings.precision });

  const [moles, setMoles] = useState<number | ''>(0.5);
  const [litres, setLitres] = useState<number | ''>(2);
  const [c1, setC1] = useState<number | ''>(1);
  const [v1, setV1] = useState<number | ''>(0.01);
  const [c2, setC2] = useState<number | ''>('');
  const [v2, setV2] = useState<number | ''>(0.1);
  const [phKind, setPhKind] = useState<'acid' | 'base' | 'from-ph'>('acid');
  const [phInput, setPhInput] = useState<number | ''>(0.1);

  const concentration = useMemo(() => {
    try {
      return { ok: true as const, value: chem.molarity(Number(moles), Number(litres)) };
    } catch (error) {
      return { ok: false as const, message: errorMessage(error) };
    }
  }, [moles, litres]);

  const dilutionResult = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: chem.dilution({
          ...(c1 === '' ? {} : { c1 }),
          ...(v1 === '' ? {} : { v1 }),
          ...(c2 === '' ? {} : { c2 }),
          ...(v2 === '' ? {} : { v2 }),
        }),
      };
    } catch (error) {
      return { ok: false as const, message: errorMessage(error) };
    }
  }, [c1, v1, c2, v2]);

  const ph = useMemo(() => {
    if (phInput === '') return null;
    try {
      if (phKind === 'acid') return { ok: true as const, value: chem.strongAcidPh(phInput), label: 'pH' };
      if (phKind === 'base') return { ok: true as const, value: chem.strongBasePh(phInput), label: 'pH' };
      return { ok: true as const, value: chem.concentrationFromPh(phInput), label: '[H⁺] (mol/L)' };
    } catch (error) {
      return { ok: false as const, message: errorMessage(error) };
    }
  }, [phKind, phInput]);

  return (
    <div className="tool">
      <section className="tool__form" aria-label="Inputs">
        <div className="stack">
          <SelectField
            label="What do you want to work out?"
            value={mode}
            onChange={(value) => setMode(value as typeof mode)}
            options={[
              { value: 'concentration', label: 'Concentration from moles and volume' },
              { value: 'dilution', label: 'Dilution (c₁V₁ = c₂V₂)' },
              { value: 'ph', label: 'pH and hydrogen-ion concentration' },
            ]}
          />
          {mode === 'concentration' ? (
            <>
              <NumberField label="Amount of solute" unit="mol" value={moles} onChange={setMoles} />
              <NumberField label="Volume of solution" unit="L" value={litres} onChange={setLitres} />
            </>
          ) : null}
          {mode === 'dilution' ? (
            <>
              <NumberField label="c₁ — before" unit="mol/L" value={c1} onChange={setC1} />
              <NumberField label="V₁ — before" unit="L" value={v1} onChange={setV1} />
              <NumberField label="c₂ — after" unit="mol/L" hint="Leave exactly one of the four empty." value={c2} onChange={setC2} />
              <NumberField label="V₂ — after" unit="L" value={v2} onChange={setV2} />
            </>
          ) : null}
          {mode === 'ph' ? (
            <>
              <SelectField
                label="From"
                value={phKind}
                onChange={(value) => setPhKind(value as typeof phKind)}
                options={[
                  { value: 'acid', label: 'Concentration of a strong acid → pH' },
                  { value: 'base', label: 'Concentration of a strong base → pH' },
                  { value: 'from-ph', label: 'pH → hydrogen-ion concentration' },
                ]}
              />
              <NumberField
                label={phKind === 'from-ph' ? 'pH' : 'Concentration'}
                unit={phKind === 'from-ph' ? undefined : 'mol/L'}
                value={phInput}
                onChange={setPhInput}
              />
            </>
          ) : null}
        </div>
      </section>
      <section className="tool__output" aria-label="Results" aria-live="polite">
        {mode === 'concentration' ? (
          concentration.ok ? (
            <OutputList
              title="Concentration"
              rows={[
                { label: 'Concentration', value: nf(concentration.value), unit: 'mol/L', emphasize: true },
                { label: 'Written as', value: `${nf(concentration.value * 1000)} mmol/L` },
              ]}
            />
          ) : (
            <Notice kind="error">{concentration.message}</Notice>
          )
        ) : null}
        {mode === 'dilution' ? (
          dilutionResult.ok ? (
            <OutputList
              title="Dilution"
              rows={[
                {
                  label: `${dilutionResult.value.solvedFor} — what was missing`,
                  value: nf(dilutionResult.value.value),
                  emphasize: true,
                },
                { label: 'Relation', value: dilutionResult.value.relation },
              ]}
            />
          ) : (
            <Notice kind="error">{dilutionResult.message}</Notice>
          )
        ) : null}
        {mode === 'ph' ? (
          ph && ph.ok ? (
            <OutputList
              title="pH"
              rows={[
                { label: ph.label, value: nf(ph.value), emphasize: true },
                ...(phKind === 'from-ph'
                  ? [{ label: 'pH of that solution', value: nf(-Math.log10(ph.value)) }]
                  : [
                      { label: 'pOH', value: nf(14 - ph.value) },
                      { label: '[H⁺]', value: `${nf(10 ** -ph.value)} mol/L` },
                    ]),
              ]}
            />
          ) : ph ? (
            <Notice kind="error">{ph.message}</Notice>
          ) : null
        ) : null}
      </section>
    </div>
  );
}

function ReactionTool() {
  const settings = useSettings();
  const [rows, setRows] = useState([
    { formula: 'H2', moles: 5, coefficient: 2 },
    { formula: 'O2', moles: 1, coefficient: 1 },
  ]);
  const [yieldActual, setYieldActual] = useState<number | ''>(4.5);
  const [yieldTheoretical, setYieldTheoretical] = useState<number | ''>(5);
  const nf = (value: number) => formatNumber(value, { precision: settings.precision });

  const limiting = useMemo(() => {
    try {
      return { ok: true as const, value: chem.limitingReactant(rows) };
    } catch (error) {
      return { ok: false as const, message: errorMessage(error) };
    }
  }, [rows]);

  const yieldResult = useMemo(() => {
    if (yieldActual === '' || yieldTheoretical === '') return null;
    try {
      return { ok: true as const, value: chem.percentYield(yieldActual, yieldTheoretical) };
    } catch (error) {
      return { ok: false as const, message: errorMessage(error) };
    }
  }, [yieldActual, yieldTheoretical]);

  const setRow = (index: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  return (
    <div className="tool">
      <section className="tool__form" aria-label="Inputs">
        <div className="stack">
          <p className="field__hint">
            Write each reactant with the coefficient it has in the balanced equation and the moles you actually have.
          </p>
          {rows.map((row, index) => (
            <div key={index} className="grid grid--form">
              <TextField
                label={`Reactant ${index + 1}`}
                value={row.formula}
                onChange={(value) => setRow(index, { formula: value })}
              />
              <NumberField
                label="Moles present"
                unit="mol"
                value={row.moles}
                onChange={(value) => setRow(index, { moles: value === '' ? 0 : value })}
              />
              <NumberField
                label="Coefficient"
                hint="From the balanced equation."
                value={row.coefficient}
                onChange={(value) => setRow(index, { coefficient: value === '' ? 1 : value })}
              />
            </div>
          ))}
          <div className="row">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setRows((current) => [...current, { formula: '', moles: 1, coefficient: 1 }])}
            >
              Add a reactant
            </button>
            {rows.length > 2 ? (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => setRows((current) => current.slice(0, -1))}
              >
                Remove the last one
              </button>
            ) : null}
          </div>
          <NumberField label="Actual yield" unit="g or mol" value={yieldActual} onChange={setYieldActual} />
          <NumberField label="Theoretical yield" unit="same unit" value={yieldTheoretical} onChange={setYieldTheoretical} />
        </div>
      </section>
      <section className="tool__output" aria-label="Results" aria-live="polite">
        <div className="stack">
          {limiting.ok ? (
            <>
              <OutputList
                title="Limiting reactant"
                rows={[
                  { label: 'Runs out first', value: limiting.value.limiting, emphasize: true },
                  { label: 'Extent of reaction', value: nf(limiting.value.extentOfReaction), unit: 'mol' },
                ]}
              />
              <OutputList
                title="Every reactant"
                rows={limiting.value.rows.map((row) => ({
                  label: `${row.formula} — moles ÷ coefficient`,
                  value: nf(row.ratio),
                  unit: `left over: ${nf(row.excess)} mol`,
                }))}
              />
            </>
          ) : (
            <Notice kind="error">{limiting.message}</Notice>
          )}
          {yieldResult ? (
            yieldResult.ok ? (
              <OutputList
                title="Yield"
                rows={[
                  { label: 'Percentage yield', value: nf(yieldResult.value), unit: '%', emphasize: true },
                  { label: 'Percentage error vs 100 %', value: nf(chem.percentError(yieldResult.value, 100)), unit: '%' },
                ]}
              />
            ) : (
              <Notice kind="error">{yieldResult.message}</Notice>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
