import { createStore } from '@/storage/store';
import { DEFAULT_SETTINGS, type Settings } from './types';

export const SETTINGS_KEY = 'omnica.settings.v1';
export const settingsStore = createStore<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
