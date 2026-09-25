import { useState } from 'react';
import { useSettings } from '@/settings/useSettings';
import { settingsStore } from '@/settings/store';
import { DEFAULT_SETTINGS, type NumberFormat, type ThemeMode } from '@/settings/types';
import { clearHistory } from '@/history/store';
import { memoryStore, memoryStoreValue } from '@/history/memory';
import { ANGLE_MODES } from '@/core/numbers/angle';
import { SelectField, Notice } from '@/ui/components/primitives';
import { ACCENT_PRESETS, CONTRAST_OPTIONS, THEME_OPTIONS, type ContrastMode } from '@/ui/theme/presets';
import {
  applyBackup,
  backupFileName,
  buildBackup,
  downloadText,
  historyToCsv,
  parseBackup,
  readTextFile,
  serializeBackup,
} from '@/storage/backup';
import { historyStore } from '@/history/store';
import { TextField } from '@/ui/components/primitives';

export function SettingsPanel() {
  const settings = useSettings();
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge');
  const [importMessage, setImportMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const [pasted, setPasted] = useState('');

  const runImport = (text: string, label: string) => {
    const result = parseBackup(text);
    if (!result.ok) {
      setImportMessage({ kind: 'error', text: result.error });
      return;
    }
    applyBackup(result.backup, { mode: importMode });
    const { historyCount, favourites, memorySlots } = result.summary;
    setImportMessage({
      kind: 'ok',
      text: `Imported ${historyCount} history entries (${favourites} favourites) and ${memorySlots} memory slots from ${label}.`,
    });
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Appearance</h2>
        <div className="grid grid--form">
          <SelectField
            label="Theme"
            value={settings.theme}
            onChange={(value) => settingsStore.set({ theme: value as ThemeMode })}
            options={THEME_OPTIONS}
          />
          <div className="field">
            <span className="field__label">Accent colour</span>
            <div className="swatches" role="group" aria-label="Accent colour">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`swatch${settings.accent === preset.value ? ' is-active' : ''}`}
                  style={{ background: preset.value }}
                  aria-label={`Accent ${preset.label} (${preset.value})`}
                  aria-pressed={settings.accent === preset.value}
                  onClick={() => settingsStore.set({ accent: preset.value })}
                />
              ))}
              <label className="swatch swatch--custom" title="Custom accent colour">
                <input
                  type="color"
                  value={settings.accent}
                  onChange={(event) => settingsStore.set({ accent: event.target.value })}
                  aria-label="Custom accent colour"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Calculation</h2>
        <div className="grid grid--form">
          <SelectField
            label="Angle mode"
            value={settings.angleMode}
            onChange={(value) => settingsStore.set({ angleMode: value as (typeof ANGLE_MODES)[number] })}
            options={ANGLE_MODES.map((mode) => ({ value: mode, label: mode }))}
          />
          <SelectField
            label="Number display"
            value={settings.numberFormat}
            onChange={(value) => settingsStore.set({ numberFormat: value as NumberFormat })}
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: 'scientific', label: 'Scientific (1.234e+5)' },
              { value: 'engineering', label: 'Engineering (123.4e+3)' },
            ]}
          />
          <SelectField
            label="Fractions"
            value={settings.fractionMode}
            onChange={(value) => settingsStore.set({ fractionMode: value as typeof settings.fractionMode })}
            options={[
              { value: 'auto', label: 'Show both number and fraction' },
              { value: 'fraction', label: 'Prefer fractions' },
              { value: 'decimal', label: 'Decimals only' },
            ]}
          />
          <label className="field">
            <span className="field__label">
              Precision <span className="field__unit">{settings.precision} significant digits</span>
            </span>
            <input
              className="field__input"
              type="range"
              min={2}
              max={15}
              value={settings.precision}
              onChange={(event) => settingsStore.set({ precision: Number(event.target.value) })}
            />
          </label>
          <label className="field field--check">
            <input
              type="checkbox"
              checked={settings.thousandsSeparator}
              onChange={(event) => settingsStore.set({ thousandsSeparator: event.target.checked })}
            />
            <span>Group thousands (1,234,567)</span>
          </label>
          <label className="field field--check">
            <input
              type="checkbox"
              checked={settings.persistHistory}
              onChange={(event) => settingsStore.set({ persistHistory: event.target.checked })}
            />
            <span>Keep history on this device</span>
          </label>
          <SelectField
            label="Contrast"
            value={settings.contrast}
            onChange={(value) => settingsStore.set({ contrast: value as ContrastMode })}
            options={CONTRAST_OPTIONS}
          />
          <label className="field field--check">
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(event) => settingsStore.set({ reducedMotion: event.target.checked })}
            />
            <span>Reduce motion and transitions</span>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Data</h2>
        <p>
          Everything is stored locally. Nothing is uploaded, and there is no account, tracking script or
          network request in the app.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              clearHistory();
              memoryStoreValue(0);
              memoryStore.set({ slots: {} });
            }}
          >
            Clear history and memory
          </button>
          <button type="button" className="btn btn--small" onClick={() => settingsStore.reset()}>
            Reset settings to defaults
          </button>
          <button
            type="button"
            className="btn btn--small"
            onClick={() => settingsStore.replace(DEFAULT_SETTINGS)}
          >
            Restore default theme and precision
          </button>
        </div>
        <Notice>
          Storage is versioned; clearing browser data removes history, memory and preferences.
        </Notice>
      </section>

      <section className="card">
        <h2>Backup &amp; export</h2>
        <p>
          Backups are plain JSON files written by your browser — no server is involved and nothing is
          uploaded. Import validates and cleans every field before it is applied.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn btn--small"
            onClick={() => downloadText(backupFileName(), serializeBackup(buildBackup()), 'application/json')}
          >
            Export everything (.json)
          </button>
          <button
            type="button"
            className="btn btn--small"
            onClick={() => downloadText('omnica-history.csv', historyToCsv(historyStore.get().entries), 'text/csv')}
          >
            Export history (.csv)
          </button>
        </div>
        <div className="grid grid--form">
          <SelectField
            label="Import mode"
            value={importMode}
            onChange={(value) => setImportMode(value as 'replace' | 'merge')}
            options={[
              { value: 'replace', label: 'Replace my data' },
              { value: 'merge', label: 'Merge history into my data' },
            ]}
          />
          <TextField
            label="Backup file"
            value={fileName}
            onChange={() => undefined}
            hint="Choose a previously exported .json file"
            type="file"
            onFile={async (file) => {
              setFileName(file.name);
              runImport(await readTextFile(file), file.name);
            }}
          />
        </div>
        <details className="details">
          <summary>Or paste a backup file’s contents</summary>
          <TextField
            label="Backup JSON"
            value={pasted}
            onChange={setPasted}
            multiline
            rows={6}
            placeholder='{"format":"omnica.backup", ...}'
          />
          <button
            type="button"
            className="btn btn--small"
            onClick={() => runImport(pasted, 'the pasted text')}
            disabled={pasted.trim().length === 0}
          >
            Import pasted backup
          </button>
        </details>
        {importMessage ? (
          <Notice kind={importMessage.kind === 'error' ? 'error' : undefined}>{importMessage.text}</Notice>
        ) : null}
      </section>
    </div>
  );
}
