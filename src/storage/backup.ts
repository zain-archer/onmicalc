import { settingsStore } from '@/settings/store';
import { DEFAULT_SETTINGS, type Settings } from '@/settings/types';
import { historyStore, type HistoryEntry } from '@/history/store';
import { memoryStore } from '@/history/memory';
import { draftStore } from '@/ui/bus';
import { APP_VERSION } from '@/version';
import { isPaletteId } from '@/ui/theme/palettes';

/**
 * Local backup format. Everything lives in this file — no account, no server,
 * no telemetry — so exporting is simply a JSON download.
 */
export const BACKUP_FORMAT = 'omnica.backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: string;
  exportedAt: string;
  settings: Settings;
  history: HistoryEntry[];
  memory: { main: number; slots: Record<string, number> };
  draft: string;
}

export interface BackupSummary {
  historyCount: number;
  favourites: number;
  memorySlots: number;
  exportedAt: string;
  version: number;
}

export type ParseResult =
  | { ok: true; backup: BackupFile; summary: BackupSummary }
  | { ok: false; error: string };

export function buildBackup(now = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: APP_VERSION,
    exportedAt: now.toISOString(),
    settings: settingsStore.get(),
    history: historyStore.get().entries,
    memory: memoryStore.get(),
    draft: draftStore.get().text,
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

export function summarise(backup: BackupFile): BackupSummary {
  return {
    historyCount: backup.history.length,
    favourites: backup.history.filter((entry) => entry.favorite).length,
    memorySlots: Object.keys(backup.memory.slots ?? {}).length + (backup.memory.main ? 1 : 0),
    exportedAt: backup.exportedAt,
    version: backup.version,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cleanSettings(value: unknown): Settings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
  const base = { ...DEFAULT_SETTINGS };
  const settings: Settings = { ...base };
  if (value.theme === 'light' || value.theme === 'dark' || value.theme === 'system') settings.theme = value.theme;
  // An empty accent means "use the palette's own colour", so it is valid too.
  if (typeof value.accent === 'string' && (value.accent === '' || /^#[0-9a-f]{6}$/i.test(value.accent))) {
    settings.accent = value.accent;
  }
  if (typeof value.palette === 'string' && isPaletteId(value.palette)) settings.palette = value.palette;
  if (value.angleMode === 'DEG' || value.angleMode === 'RAD' || value.angleMode === 'GRAD') {
    settings.angleMode = value.angleMode;
  }
  if (value.numberFormat === 'auto' || value.numberFormat === 'scientific' || value.numberFormat === 'engineering') {
    settings.numberFormat = value.numberFormat;
  }
  if (value.fractionMode === 'auto' || value.fractionMode === 'decimal' || value.fractionMode === 'fraction') {
    settings.fractionMode = value.fractionMode;
  }
  settings.precision = Math.min(15, Math.max(2, Math.round(cleanNumber(value.precision, base.precision))));
  settings.thousandsSeparator = typeof value.thousandsSeparator === 'boolean' ? value.thousandsSeparator : base.thousandsSeparator;
  settings.persistHistory = typeof value.persistHistory === 'boolean' ? value.persistHistory : base.persistHistory;
  settings.reducedMotion = typeof value.reducedMotion === 'boolean' ? value.reducedMotion : base.reducedMotion;
  settings.contrast = value.contrast === 'high' ? 'high' : 'normal';
  return settings;
}

function cleanHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .filter((entry) => typeof entry.expression === 'string' && entry.expression.trim().length > 0)
    .slice(0, 500)
    .map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `imported-${index}`,
      expression: String(entry.expression),
      display: typeof entry.display === 'string' ? entry.display : String(entry.expression),
      value: cleanNumber(entry.value, 0),
      at: cleanNumber(entry.at, Date.now()),
      favorite: entry.favorite === true,
    }));
}

function cleanMemory(value: unknown): { main: number; slots: Record<string, number> } {
  if (!isRecord(value)) return { main: 0, slots: {} };
  const slots: Record<string, number> = {};
  if (isRecord(value.slots)) {
    for (const [key, slot] of Object.entries(value.slots)) {
      if (/^m[1-9]$/.test(key) && typeof slot === 'number' && Number.isFinite(slot)) slots[key] = slot;
    }
  }
  return { main: cleanNumber(value.main, 0), slots };
}

/** Validates and normalises a backup file. Never throws. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!isRecord(raw)) return { ok: false, error: 'The backup file is empty or malformed.' };
  if (raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This is not an OmniCalc backup file.' };
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `This backup was made by a newer version of OmniCalc (format ${String(raw.version)}).`,
    };
  }

  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: typeof raw.app === 'string' ? raw.app : APP_VERSION,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    settings: cleanSettings(raw.settings),
    history: cleanHistory(raw.history),
    memory: cleanMemory(raw.memory),
    draft: typeof raw.draft === 'string' ? raw.draft.slice(0, 2000) : '',
  };
  return { ok: true, backup, summary: summarise(backup) };
}

export interface ApplyOptions {
  /** `replace` overwrites local data, `merge` unions history by expression. */
  mode?: 'replace' | 'merge';
}

export function applyBackup(backup: BackupFile, options: ApplyOptions = {}): void {
  const mode = options.mode ?? 'replace';
  settingsStore.set(backup.settings);
  memoryStore.set(backup.memory);
  draftStore.set({ text: backup.draft, revision: draftStore.get().revision + 1 });

  if (mode === 'replace') {
    historyStore.set({ entries: backup.history });
    return;
  }
  const existing = historyStore.get().entries;
  const seen = new Set(existing.map((entry) => entry.expression));
  const merged = [...existing, ...backup.history.filter((entry) => !seen.has(entry.expression))];
  merged.sort((a, b) => b.at - a.at);
  historyStore.set({ entries: merged.slice(0, 500) });
}

/** CSV export of the history, using RFC 4180 quoting. */
export function historyToCsv(entries: readonly HistoryEntry[]): string {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const rows = [['expression', 'display', 'value', 'date', 'favourite']];
  for (const entry of entries) {
    rows.push([
      entry.expression,
      entry.display,
      String(entry.value),
      new Date(entry.at).toISOString(),
      entry.favorite ? 'yes' : 'no',
    ]);
  }
  return rows.map((row) => row.map(escape).join(',')).join('\r\n');
}

export function backupFileName(now = new Date()): string {
  return `omnica-backup-${now.toISOString().slice(0, 10)}.json`;
}

/* -------------------------- browser plumbing -------------------------- */

export function downloadText(fileName: string, text: string, mime = 'application/json'): boolean {
  if (typeof document === 'undefined') return false;
  if (typeof URL?.createObjectURL !== 'function') {
    // Nothing sensible to click: a data URI would navigate instead of download
    // on strict browsers, so the caller is told instead of pretending.
    return false;
  }
  let url: string;
  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    url = URL.createObjectURL(blob);
  } catch {
    return false;
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
  return true;
}

export function readTextFile(file: File): Promise<string> {
  return file.text();
}
