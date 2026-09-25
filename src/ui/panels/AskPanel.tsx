import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResultBlock, SolveOutcome } from '@/intents/types';
import { groupedCapabilities, plan, runPlan, type Plan, type PlanFailure } from '@/intents/solve';
import { addHistoryEntry } from '@/history/store';
import { appendToDraft, askStore } from '@/ui/bus';
import { useStore } from '@/storage/useStore';
import { notify } from '@/ui/notify';
import { CopyButton, Notice, NumberField, TextField } from '@/ui/components/primitives';

/**
 * "Ask OmniCalc" — the plain-language front door.
 *
 * The panel knows nothing about maths: it shows what the intent layer understood
 * and renders the blocks a capability returns. If the sentence cannot be matched
 * it offers alternatives instead of guessing.
 */

const STARTERS = [
  'compound interest on 1000 at 5 percent for 10 years',
  'solve 3x + 5 = 20',
  'plot x^2 - 4',
  'integrate x^2 from 0 to 3',
  'convert 5 km to miles',
  'summarise 12, 15, 11, 19, 15',
  'days between 2024-01-01 and 2026-09-25',
];

function firstNumber(text: string): number | null {
  const match = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(text.replace(/,/g, ''));
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function BlockView({ block }: { block: ResultBlock }) {
  if (block.kind === 'stats' && block.rows) {
    return (
      <div className="ask-block">
        {block.title ? <h3 className="ask-block__title">{block.title}</h3> : null}
        <dl className="ask-stats">
          {block.rows.map((row, index) => (
            <div className={`ask-stats__row${row.emphasize ? ' is-emphasis' : ''}`} key={`${row.label}-${index}`}>
              <dt>{row.label}</dt>
              <dd>{row.unit ? `${row.value} ${row.unit}` : row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (block.kind === 'table' && block.table) {
    return (
      <div className="ask-block">
        {block.title ? <h3 className="ask-block__title">{block.title}</h3> : null}
        <div className="ask-table-wrap">
          <table className="ask-table">
            <thead>
              <tr>
                {block.table.columns.map((column) => (
                  <th scope="col" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (block.kind === 'list' && block.items) {
    return (
      <div className="ask-block">
        {block.title ? <h3 className="ask-block__title">{block.title}</h3> : null}
        <ul className="ask-list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (block.kind === 'note') {
    return <Notice kind="info">{block.text}</Notice>;
  }

  return (
    <div className="ask-block">
      {block.kind === 'math' ? <code className="ask-math">{block.text}</code> : <p className="ask-text">{block.text}</p>}
    </div>
  );
}

export function AskPanel() {
  const [request, setRequest] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [settled, setSettled] = useState<{ plan: Plan; outcome: SolveOutcome } | null>(null);
  const [failure, setFailure] = useState<PlanFailure | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const ask = useStore(askStore);
  const handled = useRef(0);

  const preview = useMemo(() => {
    if (request.trim().length < 3) return null;
    const result = plan(request, pinned ? { capabilityId: pinned } : {});
    return result.capability ? result : null;
  }, [request, pinned]);

  const run = (text: string, capabilityId?: string) => {
    const planned = plan(text, capabilityId ? { capabilityId } : {});
    if (planned.capability === null) {
      setFailure(planned);
      setSettled(null);
      return;
    }

    const numbers: Record<string, number> = {};
    const texts: Record<string, string> = {};
    for (const spec of planned.capability.inputs) {
      const raw = fields[`${planned.capability.id}.${spec.name}`];
      if (!raw || raw.trim() === '') continue;
      const trimmed = raw.trim();
      const numeric = Number(trimmed);
      if (spec.kind === 'text' || spec.kind === 'dataset' || spec.expression || !Number.isFinite(numeric)) {
        texts[spec.name] = trimmed;
      }
      if (Number.isFinite(numeric)) numbers[spec.name] = numeric;
    }

    // Values typed into the form win over whatever the sentence said.
    const merged: Plan = {
      ...planned,
      captures: { ...planned.captures, ...numbers },
      text: { ...planned.text, ...texts },
    };
    const outcome = runPlan(merged);
    setSettled({ plan: planned, outcome });
    setFailure(null);

    if (outcome.ok) {
      addHistoryEntry({
        expression: text,
        display: outcome.copyText || outcome.headline,
        value: firstNumber(outcome.copyText) ?? firstNumber(outcome.headline) ?? 0,
      });
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!request.trim()) return;
    run(request, pinned ?? undefined);
  };

  // A request handed over from the command palette runs immediately, once.
  useEffect(() => {
    if (ask.token === handled.current || !ask.text.trim()) return;
    handled.current = ask.token;
    const handedOver = ask.text;
    askStore.set({ text: '', token: ask.token });
    setPinned(null);
    setRequest(handedOver);
    setFields({});
    run(handedOver);
  }, [ask]);

  const useExample = (text: string) => {
    setPinned(null);
    setRequest(text);
    setFields({});
    run(text);
  };

  const groups = useMemo(() => groupedCapabilities(), []);

  const answer = settled && settled.outcome.ok ? settled.outcome : null;

  return (
    <div className="stack ask">
      <form className="card ask__form" onSubmit={submit}>
        <h2>What do you want to do?</h2>
        <p>
          Type it in your own words — OmniCalc works out the maths, unit or tool. No account, no sending your data
          anywhere: the matching runs on your device.
        </p>
        <label className="field">
          <span className="field__label">Your request</span>
          <input
            className="field__input ask__input"
            type="text"
            value={request}
            placeholder="e.g. how many miles is 42 km"
            autoComplete="off"
            enterKeyHint="go"
            aria-describedby="ask-help"
            onChange={(event) => {
              setRequest(event.target.value);
              setPinned(null);
              setFields({});
            }}
          />
        </label>
        <p className="field__hint" id="ask-help">
          {preview
            ? `I will ${preview.capability.title.toLowerCase()} — ${preview.capability.promise}`
            : 'Describe the result you want; I will pick the right tool and fill it in.'}
        </p>
        <div className="ask__actions">
          <button className="btn btn--primary" type="submit">
            Solve it
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setRequest('');
              setSettled(null);
              setFailure(null);
              setPinned(null);
            }}
          >
            Clear
          </button>
        </div>
        <div className="ask__starters">
          <span className="ask__label">Try one:</span>
          {STARTERS.map((example) => (
            <button className="chip" type="button" key={example} onClick={() => useExample(example)}>
              {example}
            </button>
          ))}
        </div>
      </form>

      {failure ? (
        <Notice kind="error">
          {failure.reason === 'empty'
            ? 'Type what you would like to work out.'
            : 'I could not tell which tool you meant. Try rephrasing, or pick one below.'}
        </Notice>
      ) : null}

      {failure && failure.suggestions.length > 0 ? (
        <div className="ask__starters">
          <span className="ask__label">Did you mean:</span>
          {failure.suggestions.map((capability) => (
            <button
              className="chip"
              type="button"
              key={capability.id}
              onClick={() => {
                setPinned(capability.id);
                const example = capability.examples[0]?.text ?? '';
                if (example) useExample(example);
                else run(request, capability.id);
              }}
            >
              {capability.title}
            </button>
          ))}
        </div>
      ) : null}

      {settled ? (
        <div className="card ask__answer">
          <h2>{settled.plan.capability.title}</h2>
          {answer ? (
            <>
              <p className="ask__understood" data-testid="ask-understood">
                <span className="ask__label">Understood</span> {answer.understood}
              </p>
              <p className="ask__headline" data-testid="ask-headline">
                {answer.headline}
              </p>
              <div className="ask__blocks">
                {answer.blocks.map((block, index) => (
                  <BlockView block={block} key={index} />
                ))}
              </div>
              <div className="ask__actions">
                <CopyButton text={answer.copyText} label="Copy the answer" />
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    appendToDraft(answer.copyText.split('\n')[0] ?? answer.headline);
                    notify('Sent to the calculator', 'ok');
                  }}
                >
                  Send to calculator
                </button>
              </div>
            </>
          ) : (
            <Notice kind="error">{settled.outcome.ok ? '' : settled.outcome.message}</Notice>
          )}
        </div>
      ) : null}

      {settled ? (
        <details className="card ask__details" open={!answer}>
          <summary>Enter the values instead</summary>
          <p className="field__hint">
            Prefer typing numbers into boxes? Fill what you know — anything left empty is still read from your sentence.
          </p>
          <form
            className="grid grid--form"
            onSubmit={(event) => {
              event.preventDefault();
              run(request, settled.plan.capability.id);
            }}
          >
            {settled.plan.capability.inputs.map((spec) => {
              const key = `${settled.plan.capability.id}.${spec.name}`;
              const captured = settled.plan.captures[spec.name];
              const value = fields[key] ?? (captured !== undefined ? String(captured) : '');
              const setValue = (next: string) => setFields((current) => ({ ...current, [key]: next }));
              if (spec.kind === 'text' || spec.kind === 'dataset' || spec.expression) {
                return (
                  <TextField
                    key={key}
                    label={`${spec.label}${spec.optional ? ' (optional)' : ''}`}
                    value={value}
                    hint={spec.hint ?? spec.example}
                    onChange={(next) => setValue(next)}
                  />
                );
              }
              return (
                <NumberField
                  key={key}
                  label={`${spec.label}${spec.optional ? ' (optional)' : ''}`}
                  value={value === '' ? '' : Number(value)}
                  hint={spec.hint ?? spec.example}
                  onChange={(next) => setValue(next === '' ? '' : String(next))}
                />
              );
            })}
            <div className="ask__actions">
              <button className="btn btn--primary" type="submit">
                Solve with these values
              </button>
            </div>
          </form>
        </details>
      ) : null}

      <details className="card ask__details">
        <summary>Everything you can ask</summary>
        <div className="ask__groups">
          {groups.map((entry) => (
            <section key={entry.group}>
              <h3 className="ask-block__title">{entry.group}</h3>
              <div className="ask__starters">
                {entry.capabilities.map((capability) => (
                  <button
                    className="chip"
                    type="button"
                    key={capability.id}
                    title={capability.promise}
                    onClick={() => useExample(capability.examples[0]?.text ?? `${capability.title} `)}
                  >
                    {capability.title}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </details>
    </div>
  );
}
