import { createStore, type PersistentStore } from '@/storage/store';

export interface HistoryEntry {
  id: string;
  expression: string;
  display: string;
  value: number;
  at: number;
  favorite: boolean;
  tool?: string;
  angleMode?: string;
  precision?: number;
}

export interface HistoryState {
  entries: HistoryEntry[];
}

export const HISTORY_LIMIT = 500;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const historyStore: PersistentStore<HistoryState> = createStore<HistoryState>('omnica.history.v1', {
  entries: [],
});

export interface AddEntryInput {
  expression: string;
  display: string;
  value: number;
  at?: number;
  tool?: string;
  angleMode?: string;
  precision?: number;
}

/** Adds an entry, collapsing an immediate duplicate of the previous expression. */
export function addHistoryEntry(input: AddEntryInput): HistoryEntry {
  const entry: HistoryEntry = {
    id: newId(),
    expression: input.expression,
    display: input.display,
    value: input.value,
    at: input.at ?? Date.now(),
    favorite: false,
    tool: input.tool,
    angleMode: input.angleMode,
    precision: input.precision,
  };
  const entries = historyStore.get().entries;
  const deduped =
    entries[0] && entries[0].expression === entry.expression && entries[0].display === entry.display
      ? entries
      : [entry, ...entries];
  historyStore.set({ entries: deduped.slice(0, HISTORY_LIMIT) });
  return entry;
}

export function removeHistoryEntry(id: string): void {
  historyStore.set({ entries: historyStore.get().entries.filter((entry) => entry.id !== id) });
}

export function clearHistory(): void {
  historyStore.set({ entries: [] });
}

export function toggleHistoryFavorite(id: string): void {
  historyStore.set({
    entries: historyStore.get().entries.map((entry) =>
      entry.id === id ? { ...entry, favorite: !entry.favorite } : entry,
    ),
  });
}

/** Case-insensitive substring search across expression and result. */
export function filterHistory(entries: readonly HistoryEntry[], query: string): HistoryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...entries];
  return entries.filter(
    (entry) =>
      entry.expression.toLowerCase().includes(needle) ||
      entry.display.toLowerCase().includes(needle),
  );
}
