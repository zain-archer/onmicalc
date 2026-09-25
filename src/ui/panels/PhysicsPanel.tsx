import { useMemo, useState } from 'react';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import {
  PHYSICS_CATEGORIES,
  PHYSICS_FORMULAS,
  getPhysicsFormula,
  searchPhysicsFormulas,
  solvePhysics,
  type PhysicsCategory,
  type PhysicsFormula,
  type PhysicsSolution,
} from '@/math/physics';
import { appendToDraft } from '@/ui/bus';
import { CopyButton, EmptyState, Notice, NumberField, OutputList, SelectField, TextField } from '@/ui/components/primitives';

/**
 * Physics library: pick a relation, fill in what you know, and the solver
 * returns whichever symbol is missing — with the check, the unit and the other
 * algebraic solutions. All the mathematics lives in `src/math/physics`; this
 * file only collects input and draws the result.
 */
export function PhysicsPanel() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | PhysicsCategory>('all');
  const [formulaId, setFormulaId] = useState('newton-second');

  const matches = useMemo(
    () => searchPhysicsFormulas(query).filter((formula) => category === 'all' || formula.category === category),
    [query, category],
  );
  // Keep the open formula while it survives the filter; otherwise open the
  // first match. With no matches at all, keep the current one so the form
  // never disappears under the user's fingers.
  const selected = getPhysicsFormula(formulaId) ?? PHYSICS_FORMULAS[0]!;
  const formula =
    matches.length === 0 || matches.some((entry) => entry.id === selected.id) ? selected : matches[0]!;

  return (
    <div className="tool tool--wide">
      <section className="tool__form" aria-label="Formula library">
        <div className="stack">
          <TextField
            label="Search formulas"
            hint="Name, symbol or unit — try “ohm”, “λ” or “J/kg”."
            value={query}
            onChange={setQuery}
            placeholder="momentum"
          />
          <SelectField
            label="Category"
            value={category}
            onChange={(value) => setCategory(value as 'all' | PhysicsCategory)}
            options={[
              { value: 'all', label: `All categories (${searchPhysicsFormulas('').length} formulas)` },
              ...PHYSICS_CATEGORIES.map((name) => ({ value: name, label: name })),
            ]}
          />
          <p className="field__hint" aria-live="polite">
            {matches.length} of {searchPhysicsFormulas('').length} formulas shown.
          </p>
          {matches.length === 0 ? (
            <EmptyState>No formula matches that search. Try a symbol such as “ρ”, or a unit such as “Pa”.</EmptyState>
          ) : (
            <ul className="formula-list" aria-label="Formulas">
              {matches.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`btn btn--ghost btn--small${entry.id === formula.id ? ' is-active' : ''}`}
                    aria-pressed={entry.id === formula.id}
                    onClick={() => setFormulaId(entry.id)}
                  >
                    {entry.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section className="tool__output" aria-label="Result" aria-live="polite">
        <FormulaTool key={formula.id} formula={formula} />
      </section>
    </div>
  );
}

function FormulaTool({ formula }: { formula: PhysicsFormula }) {
  const settings = useSettings();
  const [solveFor, setSolveFor] = useState(formula.quantities[0]!.symbol);
  const [values, setValues] = useState<Record<string, number | ''>>(() =>
    Object.fromEntries(
      formula.quantities.map((quantity) => [
        quantity.symbol,
        quantity.defaultValue === undefined ? '' : quantity.defaultValue,
      ]),
    ),
  );
  const [showSteps, setShowSteps] = useState(false);

  const unknown = formula.quantities.find((quantity) => quantity.symbol === solveFor) ?? formula.quantities[0]!;
  const precision = settings.precision;
  const nf = (value: number) => formatNumber(value, { precision });

  const attempt = useMemo(() => {
    const known: Record<string, number> = {};
    for (const quantity of formula.quantities) {
      if (quantity.symbol === unknown.symbol) continue;
      const value = values[quantity.symbol];
      if (value !== '' && value !== undefined) known[quantity.symbol] = value;
    }
    try {
      return { ok: true as const, solution: solvePhysics(formula.id, known, unknown.symbol) };
    } catch (error) {
      return {
        ok: false as const,
        message: errorMessage(error),
        details: (error as { details?: string }).details,
      };
    }
  }, [formula, unknown.symbol, values]);

  const solution: PhysicsSolution | null = attempt.ok ? attempt.solution : null;
  const answer = solution ? `${nf(solution.value)}${solution.unit === '—' ? '' : ` ${solution.unit}`}` : '';

  return (
    <div className="stack">
      <header>
        <h2>{formula.name}</h2>
        <p className="field__hint">
          {formula.category} · {formula.relation}
        </p>
      </header>

      <SelectField
        label="Solve for"
        hint="Everything else in the relation is taken from the fields below."
        value={unknown.symbol}
        onChange={setSolveFor}
        options={formula.quantities.map((quantity) => ({
          value: quantity.symbol,
          label: `${quantity.display ?? quantity.symbol} — ${quantity.name}`,
        }))}
      />

      <div className="grid grid--form">
        {formula.quantities
          .filter((quantity) => quantity.symbol !== unknown.symbol)
          .map((quantity) => (
            <NumberField
              key={quantity.symbol}
              label={`${quantity.display ?? quantity.symbol} — ${quantity.name}`}
              unit={quantity.unit === '—' ? undefined : quantity.unit}
              hint={quantity.constant ? 'Physical constant — edit to use a different value.' : undefined}
              value={values[quantity.symbol] ?? ''}
              onChange={(value) =>
                setValues((current) => ({ ...current, [quantity.symbol]: value }))
              }
            />
          ))}
      </div>

      {attempt.ok ? (
        <>
          <OutputList
            rows={[
              {
                label: `${unknown.display ?? unknown.symbol} — ${unknown.name}`,
                value: nf(solution!.value),
                unit: solution!.unit === '—' ? undefined : solution!.unit,
                emphasize: true,
              },
              {
                label: 'Check (residual after substituting back)',
                value: nf(solution!.residual),
              },
              ...solution!.alternatives.map((alternative) => ({
                label: `Other algebraic solution (${unknown.display ?? unknown.symbol} = ${nf(alternative.value)})`,
                value: nf(alternative.value),
                unit: solution!.unit === '—' ? undefined : solution!.unit,
              })),
            ]}
            title="Answer"
          />
          {solution!.notes.length > 0 ? (
            <ul className="field__hint">
              {solution!.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
              {solution!.alternatives.map((alternative) => (
                <li key={alternative.value}>{alternative.note}</li>
              ))}
            </ul>
          ) : null}
          <div className="row">
            <CopyButton text={`${unknown.display ?? unknown.symbol} = ${answer}`} label="Copy answer" />
            <button type="button" className="btn btn--ghost btn--small" onClick={() => appendToDraft(nf(solution!.value))}>
              Use in calculator
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              aria-expanded={showSteps}
              onClick={() => setShowSteps((open) => !open)}
            >
              {showSteps ? 'Hide the working' : 'Show the working'}
            </button>
          </div>
          {showSteps ? (
            <ol className="steps">
              {solution!.steps.map((step) => (
                <li key={step}>
                  <span className="steps__text">{step}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : (
        <>
          <Notice kind="error">{attempt.message}</Notice>
          {attempt.details ? <p className="field__hint">{attempt.details}</p> : null}
        </>
      )}
    </div>
  );
}
