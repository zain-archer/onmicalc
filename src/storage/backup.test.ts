import { beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  applyBackup,
  backupFileName,
  buildBackup,
  historyToCsv,
  parseBackup,
  serializeBackup,
  summarise,
} from './backup';
import { settingsStore } from '@/settings/store';
import { historyStore } from '@/history/store';
import { memoryStore } from '@/history/memory';
import { draftStore } from '@/ui/bus';
import { DEFAULT_SETTINGS } from '@/settings/types';
import type { HistoryEntry } from '@/history/store';

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'e1',
  expression: '2+2',
  display: '4',
  value: 4,
  at: 1_700_000_000_000,
  favorite: false,
  ...over,
});

beforeEach(() => {
  settingsStore.reset();
  historyStore.reset();
  memoryStore.reset();
  draftStore.reset();
});

describe('backup files', () => {
  it('captures settings, history, memory and draft', () => {
    settingsStore.set({ precision: 8, theme: 'dark' });
    historyStore.set({ entries: [entry(), entry({ id: 'e2', expression: '3', favorite: true })] });
    memoryStore.set({ main: 42, slots: { m1: 7 } });
    draftStore.set({ text: '1+', revision: 3 });

    const backup = buildBackup(new Date('2026-09-25T10:00:00Z'));
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toBe('2026-09-25T10:00:00.000Z');
    expect(backup.settings.precision).toBe(8);
    expect(backup.history).toHaveLength(2);
    expect(backup.memory.main).toBe(42);
    expect(summarise(backup)).toMatchObject({ historyCount: 2, favourites: 1, memorySlots: 2 });
    expect(backupFileName(new Date('2026-09-25T10:00:00Z'))).toBe('omnica-backup-2026-09-25.json');
  });

  it('round trips through JSON', () => {
    historyStore.set({ entries: [entry()] });
    const text = serializeBackup(buildBackup());
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.history[0]!.expression).toBe('2+2');
    expect(parsed.summary.historyCount).toBe(1);
  });

  it('rejects files that are not OmniCalc backups', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'That file is not valid JSON.' });
    expect(parseBackup('[]')).toEqual({ ok: false, error: 'The backup file is empty or malformed.' });
    expect(parseBackup('{"format":"something-else"}')).toEqual({
      ok: false,
      error: 'This is not an OmniCalc backup file.',
    });
    const newer = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }));
    expect(newer.ok).toBe(false);
  });

  it('sanitises imported data instead of trusting it', () => {
    const messy = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      settings: { precision: 999, theme: 'neon', accent: 'javascript:', thousandSeparator: 'yes' },
      history: [
        { expression: '  ', value: 1 },
        { expression: 'ok', value: 'nope', at: 'yesterday', favorite: 'true' },
        'garbage',
      ],
      memory: { main: 'x', slots: { m1: 5, m10: 9, bad: 1 } },
      draft: 'x'.repeat(5000),
    });
    const parsed = parseBackup(messy);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.settings.precision).toBe(15);
    expect(parsed.backup.settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(parsed.backup.settings.accent).toBe(DEFAULT_SETTINGS.accent);
    expect(parsed.backup.history).toHaveLength(1);
    expect(parsed.backup.history[0]!.value).toBe(0);
    expect(parsed.backup.history[0]!.favorite).toBe(false);
    expect(parsed.backup.memory.slots).toEqual({ m1: 5 });
    expect(parsed.backup.memory.main).toBe(0);
    expect(parsed.backup.draft).toHaveLength(2000);
  });

  it('restores data in replace mode', () => {
    historyStore.set({ entries: [entry({ expression: 'old' })] });
    const parsed = parseBackup(
      serializeBackup({
        ...buildBackup(),
        history: [entry({ expression: 'new', favorite: true })],
        memory: { main: 3, slots: { m2: 9 } },
        draft: '5*5',
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    applyBackup(parsed.backup);
    expect(historyStore.get().entries.map((item) => item.expression)).toEqual(['new']);
    expect(memoryStore.get()).toEqual({ main: 3, slots: { m2: 9 } });
    expect(draftStore.get().text).toBe('5*5');
  });

  it('merges history without duplicating expressions', () => {
    historyStore.set({ entries: [entry({ expression: '1+1', at: 100 })] });
    const parsed = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        history: [entry({ id: 'x', expression: '1+1', at: 200 }), entry({ id: 'y', expression: '9-3', at: 50 })],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    applyBackup(parsed.backup, { mode: 'merge' });
    const expressions = historyStore.get().entries.map((item) => item.expression);
    expect(expressions).toEqual(['1+1', '9-3']);
  });
});

describe('history CSV', () => {
  it('quotes fields containing commas, quotes and newlines', () => {
    const csv = historyToCsv([
      entry({ expression: 'sum(1,2)', display: 'he said "hi"', value: 3 }),
      entry({ id: 'e2', expression: 'line1\nline2', display: '4' }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('expression,display,value,date,favourite');
    expect(lines[1]).toContain('"sum(1,2)"');
    expect(lines[1]).toContain('"he said ""hi"""');
    expect(csv).toContain('"line1\nline2"');
    expect(csv).toContain('no');
  });

  it('exports an empty history as just the header', () => {
    expect(historyToCsv([])).toBe('expression,display,value,date,favourite');
  });
});
