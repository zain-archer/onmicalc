import { CalcError } from '@/core/errors';

/**
 * Defensive localStorage access. Storage can be unavailable (private mode,
 * sandboxed iframe, disabled cookies) or full — the app must keep working.
 */
const memory = new Map<string, string>();
let useMemory = false;

function backend(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (useMemory) return null;
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__omnica_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    useMemory = true;
    return null;
  }
}

export function readRaw(key: string): string | null {
  const b = backend();
  if (!b) return memory.get(key) ?? null;
  try {
    return b.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export function writeRaw(key: string, value: string): void {
  const b = backend();
  if (!b) {
    memory.set(key, value);
    return;
  }
  try {
    b.setItem(key, value);
  } catch {
    // Quota exceeded or blocked: fall back to memory-only so the session survives.
    memory.set(key, value);
  }
}

export function removeRaw(key: string): void {
  memory.delete(key);
  try {
    backend()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    removeRaw(key);
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch (err) {
    throw new CalcError('INTERNAL', 'Could not save data to local storage', {
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
