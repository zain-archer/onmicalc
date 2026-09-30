import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateExpression } from '@/core/engine';
import { ALL_CONSTANT_VALUES } from '@/constants';
import {
  memoryAdd,
  memoryStore,
  memorySubtract,
  memoryValue,
  memoryVariables,
} from '@/history/memory';
import { addHistoryEntry, historyStore } from '@/history/store';
import { useSettings } from '@/settings/useSettings';
import { settingsStore } from '@/settings/store';
import { answerStore, appendToDraft, draftStore, setDraft } from '@/ui/bus';
import { useStore } from '@/storage/useStore';
import { BASIC_KEYS, SCIENTIFIC_KEYS, trigKeys, type KeyDef } from '@/ui/keypad/keys';
import { backspace, insertSnippet } from '@/ui/keypad/insert';
import { CopyButton, Notice, Tabs } from '@/ui/components/primitives';
import { SendTo } from '@/ui/components/SendTo';
import { formatFraction, fromDecimal } from '@/math/arithmetic/fractions';
import type { AngleMode } from '@/core/numbers/angle';

const ANGLE_MODES: readonly AngleMode[] = ['DEG', 'RAD', 'GRAD'];

export function CalculatorPanel() {
  const settings = useSettings();
  const draft = useStore(draftStore);
  const memory = useStore(memoryStore);
  const history = useStore(historyStore);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pad, setPad] = useState<'basic' | 'scientific'>('basic');
  const [inverse, setInverse] = useState(false);
  const [hyperbolic, setHyperbolic] = useState(false);

  // `answer` is read through the store so `ans` is always the latest result.
  const answer = useStore(answerStore);
  const variables = useMemo(
    () => ({ ...memoryVariables(), ans: answer.value }),
    [memory, answer],
  );

  const evaluation = useMemo(
    () =>
      evaluateExpression(draft.text, {
        angleMode: settings.angleMode,
        precision: settings.precision,
        numberFormat: settings.numberFormat,
        thousandsSeparator: settings.thousandsSeparator,
        variables,
        constants: ALL_CONSTANT_VALUES,
      }),
    [draft.text, settings, variables],
  );

  // Keep the caret where the user expects it after every insertion.
  const pendingCaret = useRef<number | null>(null);
  useEffect(() => {
    if (pendingCaret.current === null) return;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(caret, caret);
  }, [draft.text]);

  const applyInsert = useCallback(
    (snippet: string, caretOffset = 0) => {
      const input = inputRef.current;
      const start = input?.selectionStart ?? draft.text.length;
      const end = input?.selectionEnd ?? start;
      const next = insertSnippet(draft.text, snippet, start, end, caretOffset);
      pendingCaret.current = next.caret;
      setDraft(next.text);
    },
    [draft.text],
  );

  const commit = useCallback(() => {
    if (!draft.text.trim() || !evaluation.ok) return;
    addHistoryEntry({
      expression: evaluation.source,
      display: evaluation.display,
      value: evaluation.value,
      tool: 'calculator',
      angleMode: settings.angleMode,
      precision: settings.precision,
    });
    answerStore.set({ value: evaluation.value, display: evaluation.display });
  }, [draft.text, evaluation, settings.angleMode, settings.precision]);

  const onKey = useCallback(
    (key: KeyDef) => {
      if (key.action === 'clear') {
        setDraft('');
        pendingCaret.current = 0;
        return;
      }
      if (key.action === 'backspace') {
        const input = inputRef.current;
        const start = input?.selectionStart ?? draft.text.length;
        const end = input?.selectionEnd ?? start;
        const next = backspace(draft.text, start, end);
        pendingCaret.current = next.caret;
        setDraft(next.text);
        return;
      }
      if (key.action === 'equals') {
        if (evaluation.ok) setDraft(evaluation.display);
        commit();
        return;
      }
      if (key.action === 'ans') {
        applyInsert(evaluation.ok ? `ans` : 'ans');
        return;
      }
      if (key.action === 'memory-add' || key.action === 'memory-subtract') {
        if (!evaluation.ok) return;
        const delta = key.action === 'memory-add' ? evaluation.value : -evaluation.value;
        memoryAdd(delta);
        return;
      }
      if (key.action === 'memory-recall') {
        applyInsert('m');
        return;
      }
      if (key.action === 'memory-clear') {
        memorySubtract(memoryValue());
        return;
      }
      applyInsert(key.insert ?? '', key.caret ?? 0);
    },
    [applyInsert, commit, draft.text, evaluation],
  );

  // Keyboard support lives here so the pad and the physical keyboard share one path.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commit]);

  // Fraction display: only shown when an exact rational within a sane
  // denominator range represents the result, so it is never misleading.
  const fractionHint = useMemo(() => {
    if (!evaluation.ok || settings.fractionMode === 'decimal') return null;
    const value = evaluation.value;
    if (!Number.isFinite(value) || Number.isInteger(value)) return null;
    const converted = fromDecimal(value, { maxDenominator: 10_000 });
    if (converted.fraction.denominator === 1) return null;
    if (settings.fractionMode === 'fraction' && !converted.exact) return null;
    const text = formatFraction(converted.fraction);
    return text;
  }, [evaluation, settings.fractionMode]);

  const recentHistory = history.entries.slice(0, 4);
  const padKeys = pad === 'basic' ? BASIC_KEYS : [...trigKeys({ inverse, hyperbolic }), ...SCIENTIFIC_KEYS];

  return (
    <div className="calc">
      <section className="calc__display" aria-label="Expression and result">
        <div className="calc__toolbar">
          <div className="segmented" role="group" aria-label="Angle mode">
            {ANGLE_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`segmented__item${settings.angleMode === mode ? ' is-active' : ''}`}
                aria-pressed={settings.angleMode === mode}
                onClick={() => settingsStore.set({ angleMode: mode })}
              >
                {mode}
              </button>
            ))}
          </div>
          <span className="calc__memory" title="Main memory register">
            M = {memoryValue().toString()}
          </span>
          <div className="calc__memory-keys">
            {(['memory-clear', 'memory-recall', 'memory-add', 'memory-subtract'] as const).map((action) => {
              const meta = {
                'memory-clear': { label: 'MC', title: 'Clear memory' },
                'memory-recall': { label: 'MR', title: 'Recall memory' },
                'memory-add': { label: 'M+', title: 'Add result to memory' },
                'memory-subtract': { label: 'M−', title: 'Subtract result from memory' },
              } as const;
              return (
                <button
                  key={action}
                  type="button"
                  className="btn btn--ghost btn--tiny"
                  title={meta[action].title}
                  onClick={() => onKey({ label: meta[action].label, action })}
                >
                  {meta[action].label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="calc__input-wrap">
          <span className="visually-hidden">Expression</span>
          <input
            ref={inputRef}
            className="calc__input"
            value={draft.text}
            placeholder="2+3*4"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!evaluation.ok && draft.text.trim().length > 0}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
            }}
          />
        </label>

        <div className="calc__result" aria-live="polite" data-testid="calc-result">
          {evaluation.ok ? (
            <>
              <output className="calc__value" data-testid="calc-value">
                {evaluation.display}
              </output>
              {fractionHint ? (
                <button
                  type="button"
                  className="chip"
                  title="Click to insert the fraction form"
                  onClick={() => appendToDraft(fractionHint)}
                >
                  = {fractionHint}
                </button>
              ) : null}
              <CopyButton text={evaluation.display} label="Copy result" />
              <CopyButton text={evaluation.source} label="Copy expression" />
              <SendTo expression={evaluation.source} value={evaluation.value} display={evaluation.display} />
            </>
          ) : draft.text.trim() === '' ? (
            <output className="calc__value calc__value--idle" data-testid="calc-value">
              0
            </output>
          ) : (
            <span className="calc__error" role="alert">
              {evaluation.error.message}
              {evaluation.error.details ? <em className="calc__error-detail"> {evaluation.error.details}</em> : null}
            </span>
          )}
        </div>

        {recentHistory.length > 0 ? (
          <div className="calc__recent">
            {recentHistory.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="chip"
                title={`Insert ${entry.expression}`}
                onClick={() => appendToDraft(entry.expression)}
              >
                {entry.expression} = {entry.display}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="calc__pad" aria-label="Keypad">
        <Tabs
          tabs={[
            { id: 'basic', label: 'Basic' },
            { id: 'scientific', label: 'Scientific' },
          ]}
          value={pad}
          onChange={(id) => setPad(id as 'basic' | 'scientific')}
          label="Keypad mode"
        />

        {pad === 'scientific' ? (
          <div className="calc__toggles">
            <button
              type="button"
              className={`chip chip--toggle${inverse ? ' is-active' : ''}`}
              aria-pressed={inverse}
              onClick={() => setInverse((value) => !value)}
            >
              INV
            </button>
            <button
              type="button"
              className={`chip chip--toggle${hyperbolic ? ' is-active' : ''}`}
              aria-pressed={hyperbolic}
              onClick={() => setHyperbolic((value) => !value)}
            >
              HYP
            </button>
          </div>
        ) : null}

        <div className={`keys keys--${pad}`}>
          {padKeys.map((key, index) => (
            <button
              key={`${key.label}-${index}`}
              type="button"
              className={`key key--${key.variant ?? 'function'}`}
              title={key.title ?? key.label}
              onClick={() => onKey(key)}
            >
              {key.label}
            </button>
          ))}
        </div>
      </section>

      {!evaluation.ok && evaluation.error.code === 'NOT_SUPPORTED' ? (
        <Notice kind="warn">{evaluation.error.message} — {evaluation.error.details}</Notice>
      ) : null}
    </div>
  );
}
