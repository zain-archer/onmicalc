import { useMemo, useState } from 'react';
import {
  clearHistory,
  filterHistory,
  historyStore,
  removeHistoryEntry,
  toggleHistoryFavorite,
} from '@/history/store';
import { MEMORY_SLOT_IDS, memoryClear, memoryStore, memoryStoreValue } from '@/history/memory';
import { useStore } from '@/storage/useStore';
import { appendToDraft } from '@/ui/bus';
import { CopyButton, EmptyState, Tabs, TextField } from '@/ui/components/primitives';

function formatTime(at: number): string {
  const date = new Date(at);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryPanel() {
  const { entries } = useStore(historyStore);
  const memory = useStore(memoryStore);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'all' | 'favorites'>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const visible = useMemo(() => {
    const filtered = filterHistory(entries, query);
    return view === 'favorites' ? filtered.filter((entry) => entry.favorite) : filtered;
  }, [entries, query, view]);

  return (
    <div className="stack">
      <section className="card">
        <Tabs
          tabs={[
            { id: 'all', label: `All (${entries.length})` },
            { id: 'favorites', label: `Favourites (${entries.filter((e) => e.favorite).length})` },
          ]}
          value={view}
          onChange={(id) => setView(id as 'all' | 'favorites')}
          label="History filter"
        />
        <div className="history__search">
          <TextField label="Search history" value={query} onChange={setQuery} placeholder="sqrt, 12, 1024…" />
          {confirmClear ? (
            <span className="history__confirm">
              <button
                type="button"
                className="btn btn--danger btn--small"
                onClick={() => {
                  clearHistory();
                  setConfirmClear(false);
                }}
              >
                Delete all
              </button>
              <button type="button" className="btn btn--small" onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="btn btn--small"
              disabled={entries.length === 0}
              onClick={() => setConfirmClear(true)}
            >
              Clear history
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState>
            {entries.length === 0
              ? 'No calculations yet. Press = on the calculator to record one.'
              : 'Nothing matches that search.'}
          </EmptyState>
        ) : (
          <ul className="history">
            {visible.map((entry) => (
              <li key={entry.id} className="history__item">
                <button
                  type="button"
                  className="history__expression"
                  title="Load this expression into the calculator"
                  onClick={() => appendToDraft(entry.expression)}
                >
                  {entry.expression}
                </button>
                <span className="history__value">= {entry.display}</span>
                <span className="history__time">{formatTime(entry.at)}</span>
                <span className="history__actions">
                  <CopyButton text={`${entry.expression} = ${entry.display}`} label="Copy" />
                  <button
                    type="button"
                    className={`btn btn--ghost btn--tiny${entry.favorite ? ' is-on' : ''}`}
                    aria-pressed={entry.favorite}
                    title={entry.favorite ? 'Remove from favourites' : 'Add to favourites'}
                    onClick={() => toggleHistoryFavorite(entry.id)}
                  >
                    {entry.favorite ? '★' : '☆'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--tiny"
                    title="Delete entry"
                    onClick={() => removeHistoryEntry(entry.id)}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Memory registers</h2>
        <p>
          Recalled inside expressions as <code>m</code> for the main register and <code>m1</code>–<code>m9</code> for
          the numbered slots.
        </p>
        <div className="memory-grid">
          <div className="memory-grid__row memory-grid__row--main">
            <span className="memory-grid__label">M</span>
            <input
              className="field__input"
              type="number"
              step="any"
              value={memory.main}
              aria-label="Memory register M value"
              title="Memory register M"
              onChange={(event) => memoryStoreValue(Number(event.target.value))}
            />
            <CopyButton text={String(memory.main)} label="Copy" />
            <button
              type="button"
              className="btn btn--small"
              aria-label="Clear memory register M"
              title="Clear memory register M"
              onClick={() => memoryClear('main')}
            >
              Clear
            </button>
          </div>
          {MEMORY_SLOT_IDS.map((slot) => (
            <div className="memory-grid__row" key={slot}>
              <span className="memory-grid__label">{slot.toUpperCase()}</span>
              <input
                className="field__input"
                type="number"
                step="any"
                value={memory.slots[slot] ?? 0}
                aria-label={`Memory slot ${slot.toUpperCase()} value`}
                title={`Memory slot ${slot.toUpperCase()} — usable in expressions as ${slot}`}
                onChange={(event) => memoryStoreValue(Number(event.target.value), slot)}
              />
              <button
                type="button"
                className="btn btn--small"
                aria-label={`Clear memory slot ${slot.toUpperCase()}`}
                title={`Clear memory slot ${slot.toUpperCase()}`}
                onClick={() => memoryClear(slot)}
              >
                Clear
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
