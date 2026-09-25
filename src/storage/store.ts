import { readJSON, writeJSON } from './local';

export interface PersistentStore<T extends object> {
  get(): T;
  set(patch: Partial<T>): void;
  replace(next: T): void;
  reset(): void;
  subscribe(listener: (state: T) => void): () => void;
}

/**
 * Tiny observable store persisted to localStorage. Deliberately dependency-free:
 * the whole app is offline-first and must not need a state library.
 */
export function createStore<T extends object>(key: string, initial: T): PersistentStore<T> {
  const listeners = new Set<(state: T) => void>();
  let state: T = { ...initial, ...readJSON<Partial<T>>(key, {}) };

  const emit = () => {
    for (const listener of listeners) listener(state);
  };

  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      writeJSON(key, state);
      emit();
    },
    replace(next) {
      state = { ...next };
      writeJSON(key, state);
      emit();
    },
    reset() {
      state = { ...initial };
      writeJSON(key, state);
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
