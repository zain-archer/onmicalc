import { useId, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

/* ---------- Tabs ---------- */
export interface TabDef {
  id: string;
  label: string;
}

/**
 * Tabs follow the WAI-ARIA "tabs with automatic activation" pattern: one tab
 * stop in the tab list, arrow keys move between tabs, Home/End jump to the
 * ends. Without this a keyboard user has to Tab through every tab button and
 * cannot discover the others at all.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly TabDef[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const focusTab = (index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    if (!buttons || buttons.length === 0) return;
    const next = ((index % buttons.length) + buttons.length) % buttons.length;
    buttons[next]?.focus();
    const id = tabs[next]?.id;
    if (id && id !== value) onChange(id);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.id === value);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusTab(current + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusTab(current - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  };

  return (
    <div className="tabs" role="tablist" aria-label={label} ref={listRef} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          // Roving tab stop: only the selected tab is in the page tab order.
          tabIndex={tab.id === value ? 0 : -1}
          className={`tabs__tab${tab.id === value ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Fields ---------- */
interface BaseFieldProps {
  label: string;
  hint?: string;
  unit?: string;
}

export function NumberField({
  label,
  hint,
  unit,
  value,
  onChange,
  step,
  min,
  max,
}: BaseFieldProps & {
  value: number | '';
  onChange: (value: number | '') => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    // The hint is a sibling of the label, not part of it: anything inside the
    // <label> becomes part of the field's accessible name, so a hint in there
    // makes a screen reader read the whole sentence as the field's name.
    // `aria-describedby` keeps it announced, after the name, on request.
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {unit ? <span className="field__unit">{unit}</span> : null}
      </label>
      <input
        id={id}
        className="field__input"
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        min={min}
        max={max}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const raw = event.target.value;
          onChange(raw === '' ? '' : Number(raw));
        }}
      />
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  unit,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
  type,
  onFile,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  /** Optional native input type, e.g. "date", "time" or "file". */
  type?: 'text' | 'date' | 'time' | 'file';
  /** Called with the chosen file when `type` is "file". */
  onFile?: (file: File) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {unit ? <span className="field__unit">{unit}</span> : null}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="field__input field__input--area"
          rows={rows}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className="field__input"
          type={type ?? 'text'}
          value={type === 'file' ? undefined : value}
          placeholder={placeholder}
          spellCheck={false}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => {
            if (type === 'file') {
              const file = event.target.files?.[0];
              if (file && onFile) void onFile(file);
              return;
            }
            onChange(event.target.value);
          }}
        />
      )}
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  unit,
  value,
  onChange,
  options,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {unit ? <span className="field__unit">{unit}</span> : null}
      </label>
      <select
        id={id}
        className="field__input"
        value={value}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/* ---------- Output ---------- */
export interface OutputRow {
  label: string;
  value: string;
  unit?: string;
  emphasize?: boolean;
}

export function OutputList({ rows, title }: { rows: readonly OutputRow[]; title?: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="output">
      {title ? <h3 className="output__title">{title}</h3> : null}
      <dl className="output__list">
        {rows.map((row, index) => (
          // Two rows can legitimately share a label (two roots, two solutions),
          // so the position is part of the key.
          <div key={`${row.label}#${index}`} className={`output__row${row.emphasize ? ' is-emphasized' : ''}`}>
            <dt>{row.label}</dt>
            <dd>
              <span className="output__value">{row.value}</span>
              {row.unit ? <span className="output__unit">{row.unit}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'warn'; children: ReactNode }) {
  return (
    <p className={`notice notice--${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  );
}

/* ---------- Copy ---------- */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    if (typeof document === 'undefined') return false;
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  text,
  label = 'Copy',
  title,
}: {
  text: string;
  label?: string;
  title?: string;
}) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <button
      type="button"
      className="btn btn--ghost btn--small"
      title={title ?? `Copy ${label.toLowerCase()}`}
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? 'done' : 'failed');
        window.setTimeout(() => setState('idle'), 1500);
      }}
    >
      <span aria-live="polite">{state === 'done' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}</span>
    </button>
  );
}

/* ---------- Layout ---------- */
export function ToolLayout({
  form,
  output,
  wide = false,
}: {
  form: ReactNode;
  output: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`tool${wide ? ' tool--wide' : ''}`}>
      <section className="tool__form" aria-label="Inputs">
        {form}
      </section>
      <section className="tool__output" aria-label="Results" aria-live="polite">
        {output}
      </section>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
