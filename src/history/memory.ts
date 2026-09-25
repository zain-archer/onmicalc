import { createStore, type PersistentStore } from '@/storage/store';

export interface MemoryState {
  /** The classic M register. */
  main: number;
  /** Numbered registers m1 … m9. */
  slots: Record<string, number>;
}

export const MEMORY_SLOT_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'] as const;

export const memoryStore: PersistentStore<MemoryState> = createStore<MemoryState>('omnica.memory.v1', {
  main: 0,
  slots: {},
});

export function memoryClear(slot = 'main'): void {
  if (slot === 'main') memoryStore.set({ main: 0 });
  else {
    const slots = { ...memoryStore.get().slots };
    delete slots[slot];
    memoryStore.set({ slots });
  }
}

export function memoryStoreValue(value: number, slot = 'main'): void {
  if (slot === 'main') memoryStore.set({ main: value });
  else memoryStore.set({ slots: { ...memoryStore.get().slots, [slot]: value } });
}

export function memoryAdd(value: number, slot = 'main'): number {
  const next = memoryValue(slot) + value;
  memoryStoreValue(next, slot);
  return next;
}

export function memorySubtract(value: number, slot = 'main'): number {
  return memoryAdd(-value, slot);
}

export function memoryValue(slot = 'main'): number {
  if (slot === 'main') return memoryStore.get().main;
  return memoryStore.get().slots[slot] ?? 0;
}

/** Variables exposed to the engine so `M`, `m1` … work inside expressions. */
export function memoryVariables(): Record<string, number> {
  const state = memoryStore.get();
  const variables: Record<string, number> = { m: state.main };
  for (const [slot, value] of Object.entries(state.slots)) variables[slot] = value;
  return variables;
}
