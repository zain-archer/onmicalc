import { useStore } from '@/storage/useStore';
import { settingsStore } from './store';
import type { Settings } from './types';

export function useSettings(): Settings {
  return useStore(settingsStore);
}
