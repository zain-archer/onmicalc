import { useState } from 'react';
import { notify } from '@/ui/notify';
import { useSettings } from '@/settings/useSettings';
import { settingsStore } from '@/settings/store';
import { type NumberFormat, type ThemeMode } from '@/settings/types';
import { clearHistory } from '@/history/store';
import { memoryStore, memoryStoreValue } from '@/history/memory';
import { ANGLE_MODES } from '@/core/numbers/angle';
import { SelectField, Notice, TextField } from '@/ui/components/primitives';
import { ACCENT_PRESETS, CONTRAST_OPTIONS, THEME_OPTIONS, type ContrastMode } from '@/ui/theme/presets';
import { PALETTE_PACKS, paletteById } from '@/ui/theme/palettes';
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

  const currentPalette = paletteById(settings.palette ?? 'classic');

  return (
    <div className="stack">
      <section className="card">
        <h2>Appearance</h2>
        <div className="grid grid--form">
          <SelectField
            label="Light or dark"
            value={settings.theme}
            onChange={(value) => settingsStore.set({ theme: value as ThemeMode })}
            options={THEME_OPTIONS}
          />
          <SelectField
            label="Colour palette"
            value={settings.palette ?? 'classic'}
            onChange={(value) => settingsStore.set({ palette: value, accent: '' })}
            options={PALETTE_PACKS.map((pack) => ({ value: pack.id, label: pack.label }))}
            hint={currentPalette.description}
          />
        </div>
        <div className="field settings__accent">
          <span className="field__label">Accent colour</span>
          <div className="accent-controls">
            <button
              type="button"
              className={`btn btn--small${settings.accent ? '' : ' is-active'}`}
              onClick={() => settingsStore.set({ accent: '' })}
              aria-label="Use the palette's own accent colour"
              aria-pressed={!settings.accent}
            >
              Palette default
            </button>
            <div className="swatches" role="group" aria-label="Accent colour presets">
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
                  value={settings.accent || currentPalette.light.accent}
                  onChange={(event) => settingsStore.set({ accent: event.target.value })}
                  aria-label="Custom accent colour"
                />
              </label>
            </div>
          </div>
        </div>
        <p className="field__hint" data-testid="theme-current">
          Using <strong>{currentPalette.label}</strong>
          {settings.accent ? ` with custom accent ${settings.accent}` : ' with its default accent'}.
        </p>
      </section>

      <section className="card">
        <h2>Calculation &amp; accessibility</h2>
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
        <h2>Data &amp; privacy</h2>
        <p>History, memory and preferences stay on this device. Nothing is uploaded.</p>
        <div className="row settings__actions">
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
        </div>
      </section>

      <section className="card">
        <details className="settings-disclosure">
          <summary>
            <span>
              <strong>Backup &amp; export</strong>
              <span className="settings-disclosure__hint">Move your data between devices</span>
            </span>
          </summary>
          <div className="settings-disclosure__body">
            <p>Export a local JSON backup or a CSV copy of your history. No server is involved.</p>
            <div className="row">
              <button
                type="button"
                className="btn btn--small"
                onClick={() => {
                  const started = downloadText(backupFileName(), serializeBackup(buildBackup()), 'application/json');
                  if (!started) notify('This browser blocked the download, so the backup was not saved.', 'error');
                }}
              >
                Export everything (.json)
              </button>
              <button
                type="button"
                className="btn btn--small"
                onClick={() => {
                  const started = downloadText('omnica-history.csv', historyToCsv(historyStore.get().entries), 'text/csv');
                  if (!started) notify('This browser blocked the download, so the CSV was not saved.', 'error');
                }}
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
          </div>
        </details>
      </section>
    </div>
  );
}
