import { useId, useState, type ChangeEvent, type ReactNode } from 'react';

/* ---------- Tabs ---------- */
export interface TabDef {
  id: string;
  label: string;
}

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
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
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
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">
        {label}
        {unit ? <span className="field__unit">{unit}</span> : null}
      </span>
      <input
        id={id}
        className="field__input"
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const raw = event.target.value;
          onChange(raw === '' ? '' : Number(raw));
        }}
      />
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
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
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">
        {label}
        {unit ? <span className="field__unit">{unit}</span> : null}
      </span>
      {multiline ? (
        <textarea
          id={id}
          className="field__input field__input--area"
          rows={rows}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
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
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
}: BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <select
        id={id}
        className="field__input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
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
