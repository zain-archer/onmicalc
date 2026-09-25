import { useSyncExternalStore } from 'react';
import type { PersistentStore } from './store';

/** Subscribe a component to any persistent store. */
export function useStore<T extends object>(store: PersistentStore<T>): T {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.get(),
    () => store.get(),
  );
}
