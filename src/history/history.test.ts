import { beforeEach, describe, expect, it } from 'vitest';
import {
  addHistoryEntry,
  clearHistory,
  filterHistory,
  historyStore,
  removeHistoryEntry,
  toggleHistoryFavorite,
  HISTORY_LIMIT,
} from './store';
import {
  memoryAdd,
  memoryClear,
  memoryStoreValue,
  memorySubtract,
  memoryValue,
  memoryVariables,
} from './memory';

describe('history store', () => {
  beforeEach(() => clearHistory());

  it('adds newest first', () => {
    addHistoryEntry({ expression: '1+1', display: '2', value: 2 });
    addHistoryEntry({ expression: '2+2', display: '4', value: 4 });
    expect(historyStore.get().entries.map((e) => e.expression)).toEqual(['2+2', '1+1']);
  });

  it('collapses repeated identical evaluations', () => {
    addHistoryEntry({ expression: '1+1', display: '2', value: 2 });
    addHistoryEntry({ expression: '1+1', display: '2', value: 2 });
    expect(historyStore.get().entries).toHaveLength(1);
  });

  it('searches, deletes and clears', () => {
    const a = addHistoryEntry({ expression: 'sqrt(144)', display: '12', value: 12 });
    addHistoryEntry({ expression: '2^10', display: '1024', value: 1024 });
    expect(filterHistory(historyStore.get().entries, '144')).toHaveLength(1);
    expect(filterHistory(historyStore.get().entries, '1024')[0]!.expression).toBe('2^10');
    expect(filterHistory(historyStore.get().entries, '')).toHaveLength(2);

    removeHistoryEntry(a.id);
    expect(historyStore.get().entries).toHaveLength(1);
    clearHistory();
    expect(historyStore.get().entries).toHaveLength(0);
  });

  it('stores only real numbers (NaN would corrupt exports)', () => {
    addHistoryEntry({ expression: 'x', display: 'NaN', value: Number.NaN });
    const entry = historyStore.get().entries[0]!;
    expect(Number.isNaN(entry.value)).toBe(true);
    expect(entry.display).toBe('NaN');
  });

  it('toggles favourites and enforces the limit', () => {
    const entry = addHistoryEntry({ expression: '1', display: '1', value: 1 });
    toggleHistoryFavorite(entry.id);
    expect(historyStore.get().entries[0]!.favorite).toBe(true);

    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
      addHistoryEntry({ expression: `n${i}`, display: String(i), value: i });
    }
    expect(historyStore.get().entries).toHaveLength(HISTORY_LIMIT);
  });
});

describe('memory registers', () => {
  beforeEach(() => {
    memoryStoreValue(0, 'main');
    for (const slot of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9']) memoryClear(slot);
  });

  it('adds, subtracts and recalls', () => {
    memoryStoreValue(10);
    expect(memoryAdd(5)).toBe(15);
    expect(memorySubtract(3)).toBe(12);
    expect(memoryValue()).toBe(12);
    memoryClear();
    expect(memoryValue()).toBe(0);
  });

  it('keeps independent numbered slots', () => {
    memoryStoreValue(3, 'm1');
    memoryStoreValue(4, 'm2');
    expect(memoryValue('m1')).toBe(3);
    expect(memoryValue('m2')).toBe(4);
    memoryAdd(1, 'm1');
    expect(memoryValue('m1')).toBe(4);
    expect(memoryValue('m2')).toBe(4);
    expect(memoryValue('m9')).toBe(0);
  });

  it('exposes memory as engine variables', () => {
    memoryStoreValue(7);
    memoryStoreValue(2, 'm3');
    expect(memoryVariables()).toEqual({ m: 7, m3: 2 });
  });
});
