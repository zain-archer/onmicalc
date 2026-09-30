import { useMemo, useState } from 'react';
import { notify } from '@/ui/notify';
import { useSettings } from '@/settings/useSettings';
import { settingsStore } from '@/settings/store';
import { DEFAULT_SETTINGS, type NumberFormat, type ThemeMode, type GraphQuality, type ProgrammerBase, type BitWidth } from '@/settings/types';
import { clearHistory } from '@/history/store';
import { memoryStore, memoryStoreValue } from '@/history/memory';
import { ANGLE_MODES } from '@/core/numbers/angle';
import { SelectField, Notice, TextField } from '@/ui/components/primitives';
import { ACCENT_PRESETS, CONTRAST_OPTIONS, THEME_OPTIONS, type ContrastMode } from '@/ui/theme/presets';
import { PALETTE_PACKS, paletteById, paletteSwatchStyle } from '@/ui/theme/palettes';
import { applyBackup, backupFileName, buildBackup, downloadText, historyToCsv, parseBackup, readTextFile, serializeBackup } from '@/storage/backup';
import { historyStore } from '@/history/store';

type SettingsCategory =
  | 'general' | 'appearance' | 'calculator' | 'graphing' | 'threeD' | 'fractions' | 'complex' | 'matrices'
  | 'statistics' | 'probability' | 'physics' | 'chemistry' | 'engineering' | 'finance' | 'programmer'
  | 'converter' | 'constants' | 'history' | 'files' | 'accessibility' | 'keyboard' | 'touch' | 'performance'
  | 'offline' | 'privacy' | 'data' | 'about';

const CATEGORIES: { id: SettingsCategory; label: string; icon: string; keywords: string[] }[] = [
  { id: 'general', label: 'General', icon: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', keywords: ['general', 'default'] },
  { id: 'appearance', label: 'Appearance', icon: 'M12 3v1m0 16v1m8-9h1M3 12H2m15.5-6.5-.7.7M5.2 18.8l-.7.7m0-13-.7-.7M18.8 18.8l.7.7', keywords: ['theme', 'palette', 'accent', 'dark', 'light', 'color'] },
  { id: 'calculator', label: 'Calculator', icon: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 3h8v3H8V6Z', keywords: ['angle', 'degrees', 'radians', 'precision', 'format', 'thousands'] },
  { id: 'graphing', label: 'Graphing', icon: 'M3 20h18M6 4v14m-3-3 4-6 4 3 5-8', keywords: ['graph', 'grid', 'axes', 'labels', 'sampling', 'thickness', 'colors'] },
  { id: 'threeD', label: '3D & Fields', icon: 'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z', keywords: ['3d', 'fps', 'quality', 'performance', 'mesh', 'lighting'] },
  { id: 'fractions', label: 'Fractions', icon: 'M6 5h12m-12 14h12M9 5v14m6-14v14', keywords: ['fraction', 'rational', 'decimal'] },
  { id: 'complex', label: 'Complex Numbers', icon: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z', keywords: ['complex', 'imaginary', 'polar'] },
  { id: 'matrices', label: 'Matrices & Vectors', icon: 'M4 4h6v6H4V4Z', keywords: ['matrix', 'vector', 'determinant', 'rref'] },
  { id: 'statistics', label: 'Statistics', icon: 'M4 20V9m6 11V4m6 16v-7M2 20h20', keywords: ['statistics', 'mean', 'regression'] },
  { id: 'probability', label: 'Probability', icon: 'M5 19V5m0 14h14M8 16l3-4 3 2 4-6', keywords: ['probability', 'distribution', 'normal'] },
  { id: 'physics', label: 'Physics', icon: 'M12 3v3m0 12v3M3 12h3m12 0h3', keywords: ['physics', 'formulas'] },
  { id: 'chemistry', label: 'Chemistry', icon: 'M9 3v6.5L4.6 17A2 2 0 0 0 6.3 20h11.4a2 2 0 0 0 1.7-3L15 9.5V3', keywords: ['chemistry', 'periodic', 'molar'] },
  { id: 'engineering', label: 'Engineering', icon: 'M12 3v3m0 12v3M3 12h3m12 0h3', keywords: ['engineering', 'electrical', 'geometry'] },
  { id: 'finance', label: 'Finance', icon: 'M3 7h18v10H3V7Z', keywords: ['finance', 'currency', 'interest', 'loan'] },
  { id: 'programmer', label: 'Programmer', icon: 'M9 6 4 12l5 6m6-12 5 6-5 6', keywords: ['programmer', 'base', 'binary', 'hex', 'bit', 'width'] },
  { id: 'converter', label: 'Unit Converter', icon: 'M4 8h13l-3-3m3 11H4l3 3', keywords: ['unit', 'converter', 'length', 'mass'] },
  { id: 'constants', label: 'Constants', icon: 'M12 3l2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.1l5.9-.8L12 3Z', keywords: ['constants', 'physical', 'mathematical'] },
  { id: 'history', label: 'History & Memory', icon: 'M12 7v5l3 2m6-2a9 9 0 1 1-3.6-7.2M21 3v5h-5', keywords: ['history', 'memory', 'favorites'] },
  { id: 'files', label: 'Files', icon: 'M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z', keywords: ['files', 'pdf', 'docx', 'import'] },
  { id: 'accessibility', label: 'Accessibility', icon: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', keywords: ['accessibility', 'contrast', 'motion', 'screen reader'] },
  { id: 'keyboard', label: 'Keyboard & Shortcuts', icon: 'M4 6h16v12H4V6Z', keywords: ['keyboard', 'shortcuts', 'ctrl', 'k'] },
  { id: 'touch', label: 'Touch & Gestures', icon: 'M8 5v6h8V5H8Z', keywords: ['touch', 'gestures', 'pinch', 'swipe'] },
  { id: 'performance', label: 'Performance', icon: 'M13 2L3 14h7l-1 8 10-12h-7l1-8Z', keywords: ['performance', 'fps', 'quality', 'balanced'] },
  { id: 'offline', label: 'Offline / Storage', icon: 'M12 3v1m0 16v1m8-9h1M3 12H2', keywords: ['offline', 'pwa', 'storage', 'cache'] },
  { id: 'privacy', label: 'Privacy', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', keywords: ['privacy', 'telemetry', 'data'] },
  { id: 'data', label: 'Data / Backup', icon: 'M12 3v1m0 16v1', keywords: ['backup', 'export', 'import', 'csv', 'json'] },
  { id: 'about', label: 'About', icon: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', keywords: ['about', 'version', 'license'] },
];

export function SettingsPanel() {
  const settings = useSettings();
  const [active, setActive] = useState<SettingsCategory>('appearance');
  const [search, setSearch] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge');
  const [importMessage, setImportMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [fileName, setFileName] = useState('');
  const [pasted, setPasted] = useState('');

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.filter(c => c.label.toLowerCase().includes(q) || c.keywords.some(k => k.includes(q)));
  }, [search]);

  const runImport = (text: string, label: string) => {
    const result = parseBackup(text);
    if (!result.ok) {
      setImportMessage({ kind: 'error', text: result.error });
      return;
    }
    applyBackup(result.backup, { mode: importMode });
    const { historyCount, favourites, memorySlots } = result.summary;
    setImportMessage({ kind: 'ok', text: `Imported ${historyCount} history entries (${favourites} fav) and ${memorySlots} memory slots from ${label}.` });
  };

  const renderCategory = () => {
    switch (active) {
      case 'appearance':
        return (
          <>
            <h3>Appearance</h3>
            <div className="grid grid--form">
              <SelectField label="Light or dark" value={settings.theme} onChange={v => settingsStore.set({ theme: v as ThemeMode })} options={THEME_OPTIONS} />
              <SelectField label="Contrast" value={settings.contrast} onChange={v => settingsStore.set({ contrast: v as ContrastMode })} options={CONTRAST_OPTIONS} />
              <label className="field field--check"><input type="checkbox" checked={settings.reducedMotion} onChange={e => settingsStore.set({ reducedMotion: e.target.checked })} aria-label="Reduce motion and transitions" /><span>Reduce motion and transitions</span></label>
              <div className="field">
                <span className="field__label">Accent colour</span>
                <div className="swatches" role="group" aria-label="Accent colour">
                  {ACCENT_PRESETS.map(p => (
                    <button key={p.id} type="button" className={`swatch${settings.accent === p.value ? ' is-active' : ''}`} style={{ background: p.value }} aria-label={`Accent ${p.label}`} aria-pressed={settings.accent === p.value} onClick={() => settingsStore.set({ accent: p.value })} />
                  ))}
                  <button type="button" className="btn btn--small" onClick={() => settingsStore.set({ accent: '' })}>Palette accent</button>
                  <label className="swatch swatch--custom"><input type="color" value={settings.accent || paletteById(settings.palette ?? 'classic').light.accent} onChange={e => settingsStore.set({ accent: e.target.value })} aria-label="Custom accent colour" /></label>
                </div>
              </div>
            </div>
            <div data-testid="theme-current" style={{ display: 'none' }}>{paletteById(settings.palette ?? 'classic').label}</div>
            <h4 style={{ marginTop: 16 }}>Theme gallery — {PALETTE_PACKS.length} palettes</h4>
            <ul className="themes" role="list">
              {PALETTE_PACKS.map(pack => {
                const isActive = (settings.palette ?? 'classic') === pack.id;
                return (
                  <li key={pack.id}><button type="button" className={`theme-card${isActive ? ' is-active' : ''}`} aria-label={`${pack.label} palette`} aria-pressed={isActive} onClick={() => settingsStore.set({ palette: pack.id, accent: '' })}>
                    <span className="theme-card__preview" aria-hidden="true">
                      <span className="theme-card__preview-pane" style={paletteSwatchStyle(pack.id, 'dark', true)}><span className="theme-card__bar" /><span className="theme-card__bar theme-card__bar--short" /><span className="theme-card__dot" /></span>
                      <span className="theme-card__preview-pane" style={paletteSwatchStyle(pack.id, 'light', false)}><span className="theme-card__bar" /><span className="theme-card__bar theme-card__bar--short" /><span className="theme-card__dot" /></span>
                    </span>
                    <span className="theme-card__text"><strong>{pack.label} {pack.tags.includes('accessibility') ? <span className="badge">high contrast</span> : null} {pack.tags.includes('popular') ? <span className="badge">popular</span> : null}</strong><span className="theme-card__desc">{pack.description}</span></span>
                  </button></li>
                );
              })}
            </ul>
          </>
        );
      case 'calculator':
        return (
          <>
            <h3>Calculator</h3>
            <div className="grid grid--form">
              <SelectField label="Angle mode" value={settings.angleMode} onChange={v => settingsStore.set({ angleMode: v as any })} options={ANGLE_MODES.map(m => ({ value: m, label: m }))} />
              <SelectField label="Number display" value={settings.numberFormat} onChange={v => settingsStore.set({ numberFormat: v as NumberFormat })} options={[{ value: 'auto', label: 'Automatic' }, { value: 'scientific', label: 'Scientific' }, { value: 'engineering', label: 'Engineering' }]} />
              <SelectField label="Fractions" value={settings.fractionMode} onChange={v => settingsStore.set({ fractionMode: v as any })} options={[{ value: 'auto', label: 'Show both' }, { value: 'fraction', label: 'Prefer fractions' }, { value: 'decimal', label: 'Decimals only' }]} />
              <label className="field"><span className="field__label">Precision <span className="field__unit">{settings.precision} digits</span></span><input className="field__input" type="range" min={2} max={15} value={settings.precision} onChange={e => settingsStore.set({ precision: Number(e.target.value) })} /></label>
              <label className="field field--check"><input type="checkbox" checked={settings.thousandsSeparator} onChange={e => settingsStore.set({ thousandsSeparator: e.target.checked })} /><span>Group thousands</span></label>
              <label className="field field--check"><input type="checkbox" checked={settings.showTips} onChange={e => settingsStore.set({ showTips: e.target.checked })} /><span>Show tips</span></label>
            </div>
          </>
        );
      case 'graphing':
        return (
          <>
            <h3>Graphing</h3>
            <div className="grid grid--form">
              <SelectField label="Default graph mode" value={settings.graphDefaultMode} onChange={v => settingsStore.set({ graphDefaultMode: v as any })} options={[{ value: 'cartesian', label: 'Cartesian y=f(x)' }, { value: 'parametric', label: 'Parametric' }, { value: 'polar', label: 'Polar' }, { value: 'implicit', label: 'Implicit' }]} />
              <SelectField label="Quality" value={settings.graphQuality} onChange={v => settingsStore.set({ graphQuality: v as GraphQuality })} options={[{ value: 'performance', label: 'Performance' }, { value: 'balanced', label: 'Balanced' }, { value: 'quality', label: 'Quality' }]} />
              <label className="field"><span className="field__label">Line thickness <span className="field__unit">{settings.graphLineThickness}px</span></span><input type="range" min={1} max={5} step={0.5} value={settings.graphLineThickness} onChange={e => settingsStore.set({ graphLineThickness: Number(e.target.value) })} className="field__input" /></label>
              <label className="field field--check"><input type="checkbox" checked={settings.graphGrid} onChange={e => settingsStore.set({ graphGrid: e.target.checked })} /><span>Show grid by default</span></label>
              <label className="field field--check"><input type="checkbox" checked={settings.graphAxes} onChange={e => settingsStore.set({ graphAxes: e.target.checked })} /><span>Show axes by default</span></label>
              <label className="field field--check"><input type="checkbox" checked={settings.graphLabels} onChange={e => settingsStore.set({ graphLabels: e.target.checked })} /><span>Show labels by default</span></label>
            </div>
            <Notice>These are defaults — each graph can override them in the Graphing panel.</Notice>
          </>
        );
      case 'threeD':
        return (
          <>
            <h3>3D & Fields</h3>
            <div className="grid grid--form">
              <SelectField label="Quality" value={settings.threeDQuality} onChange={v => settingsStore.set({ threeDQuality: v as GraphQuality })} options={[{ value: 'performance', label: 'Performance' }, { value: 'balanced', label: 'Balanced' }, { value: 'quality', label: 'Quality' }]} />
              <SelectField label="FPS target" value={String(settings.threeDFps)} onChange={v => settingsStore.set({ threeDFps: Number(v) })} options={[{ value: '30', label: '30 FPS' }, { value: '60', label: '60 FPS' }, { value: '120', label: '120 FPS' }]} />
              <label className="field field--check"><input type="checkbox" checked={settings.threeDGrid} onChange={e => settingsStore.set({ threeDGrid: e.target.checked })} /><span>Grid by default</span></label>
              <label className="field field--check"><input type="checkbox" checked={settings.threeDAxes} onChange={e => settingsStore.set({ threeDAxes: e.target.checked })} /><span>Axes by default</span></label>
            </div>
          </>
        );
      case 'programmer':
        return (
          <>
            <h3>Programmer</h3>
            <div className="grid grid--form">
              <SelectField label="Default base" value={settings.programmerBase} onChange={v => settingsStore.set({ programmerBase: v as ProgrammerBase })} options={[{ value: 'bin', label: 'Binary' }, { value: 'oct', label: 'Octal' }, { value: 'dec', label: 'Decimal' }, { value: 'hex', label: 'Hexadecimal' }]} />
              <SelectField label="Bit width" value={String(settings.programmerBitWidth)} onChange={v => settingsStore.set({ programmerBitWidth: Number(v) as BitWidth })} options={[{ value: '8', label: '8-bit' }, { value: '16', label: '16-bit' }, { value: '32', label: '32-bit' }, { value: '64', label: '64-bit' }]} />
              <label className="field field--check"><input type="checkbox" checked={settings.programmerSigned} onChange={e => settingsStore.set({ programmerSigned: e.target.checked })} /><span>Signed integers</span></label>
            </div>
          </>
        );
      case 'finance':
        return (
          <>
            <h3>Finance</h3>
            <div className="grid grid--form">
              <SelectField label="Currency" value={settings.financeCurrency} onChange={v => settingsStore.set({ financeCurrency: v })} options={[{ value: 'USD', label: 'USD ($)' }, { value: 'EUR', label: 'EUR (€)' }, { value: 'GBP', label: 'GBP (£)' }, { value: 'JPY', label: 'JPY (¥)' }, { value: 'PKR', label: 'PKR (₨)' }]} />
              <label className="field"><span className="field__label">Decimal precision</span><input type="number" min={0} max={6} value={settings.financePrecision} onChange={e => settingsStore.set({ financePrecision: Number(e.target.value) })} className="field__input" /></label>
            </div>
          </>
        );
      case 'accessibility':
        return (
          <>
            <h3>Accessibility</h3>
            <div className="grid grid--form">
              <SelectField label="Contrast" value={settings.contrast} onChange={v => settingsStore.set({ contrast: v as ContrastMode })} options={CONTRAST_OPTIONS} />
              <label className="field field--check"><input type="checkbox" checked={settings.reducedMotion} onChange={e => settingsStore.set({ reducedMotion: e.target.checked })} /><span>Reduce motion</span></label>
              <label className="field field--check"><input type="checkbox" checked={settings.thousandsSeparator} onChange={e => settingsStore.set({ thousandsSeparator: e.target.checked })} /><span>Group thousands (a11y)</span></label>
            </div>
            <Notice>OmniCalc follows WCAG 2.2: keyboard navigation, focus rings, screen reader labels, large touch targets, high contrast.</Notice>
          </>
        );
      case 'keyboard':
        return (
          <>
            <h3>Keyboard & Shortcuts</h3>
            <div className="grid grid--form">
              <label className="field field--check"><input type="checkbox" checked={settings.keyboardShortcutsEnabled} onChange={e => settingsStore.set({ keyboardShortcutsEnabled: e.target.checked })} /><span>Enable keyboard shortcuts</span></label>
            </div>
            <div className="output">
              <h4 className="output__title">Shortcuts</h4>
              <dl className="output__list">
                <div className="output__row"><dt>Ctrl+K or /</dt><dd>Command palette</dd></div>
                <div className="output__row"><dt>?</dt><dd>Shortcuts help</dd></div>
                <div className="output__row"><dt>Alt+↑/↓</dt><dd>Walk tools</dd></div>
                <div className="output__row"><dt>Alt+D</dt><dd>Toggle theme</dd></div>
                <div className="output__row"><dt>Esc</dt><dd>Close modal</dd></div>
              </dl>
            </div>
          </>
        );
      case 'performance':
        return (
          <>
            <h3>Performance</h3>
            <div className="grid grid--form">
              <SelectField label="Mode" value={settings.performanceMode} onChange={v => settingsStore.set({ performanceMode: v as any })} options={[{ value: 'auto', label: 'Automatic (recommended)' }, { value: 'performance', label: 'Performance' }, { value: 'balanced', label: 'Balanced' }, { value: 'quality', label: 'Quality' }]} />
            </div>
            <Notice>Automatic mode adapts graphing and 3D quality based on device. Math correctness is never reduced, only visualization.</Notice>
          </>
        );
      case 'data':
        return (
          <>
            <h3>Data / Backup</h3>
            <p>Backups are plain JSON, on your device, never uploaded.</p>
            <div className="row">
              <button type="button" className="btn btn--small" onClick={() => { const s = downloadText(backupFileName(), serializeBackup(buildBackup()), 'application/json'); if (!s) notify('Blocked', 'error'); }}>Export .json</button>
              <button type="button" className="btn btn--small" onClick={() => { const s = downloadText('omnica-history.csv', historyToCsv(historyStore.get().entries), 'text/csv'); if (!s) notify('Blocked', 'error'); }}>Export .csv</button>
              <button type="button" className="btn btn--small" onClick={() => { clearHistory(); memoryStoreValue(0); memoryStore.set({ slots: {} }); }}>Clear history</button>
              <button type="button" className="btn btn--small" onClick={() => settingsStore.reset()}>Reset settings</button>
            </div>
            <div className="grid grid--form" style={{ marginTop: 12 }}>
              <SelectField label="Import mode" value={importMode} onChange={v => setImportMode(v as any)} options={[{ value: 'replace', label: 'Replace' }, { value: 'merge', label: 'Merge' }]} />
              <TextField label="Backup file" value={fileName} onChange={() => undefined} hint="Choose .json" type="file" onFile={async f => { setFileName(f.name); runImport(await readTextFile(f), f.name); }} />
            </div>
            <details className="details" open><summary>Paste JSON</summary><TextField label="Backup JSON" value={pasted} onChange={setPasted} multiline rows={6} placeholder='{"format":"omnica.backup", ...}' /><button type="button" className="btn btn--small" onClick={() => runImport(pasted, 'pasted text')} disabled={!pasted.trim()}>Import pasted backup</button></details>
            {importMessage && <Notice kind={importMessage.kind === 'error' ? 'error' : undefined}>{importMessage.text}</Notice>}
          </>
        );
      case 'about':
        return (
          <>
            <h3>About OmniCalc</h3>
            <p>OmniCalc v1.3.0 — Free, offline-first, private, MIT licensed.</p>
            <p className="muted">19 tools, 151 knowledge entries, 129 units, 10 palettes, 980 tests, no backend, no analytics.</p>
            <div className="row"><button className="btn btn--small" onClick={() => { window.location.hash = '#/about'; }}>Open About & Roadmap</button></div>
          </>
        );
      default:
        return (
          <>
            <h3>{CATEGORIES.find(c => c.id === active)?.label}</h3>
            <p className="muted">Settings for this section are coming soon. Current global settings apply.</p>
            <div className="grid grid--form">
              <SelectField label="Angle mode" value={settings.angleMode} onChange={v => settingsStore.set({ angleMode: v as any })} options={ANGLE_MODES.map(m => ({ value: m, label: m }))} />
              <label className="field"><span className="field__label">Precision <span className="field__unit">{settings.precision}</span></span><input className="field__input" type="range" min={2} max={15} value={settings.precision} onChange={e => settingsStore.set({ precision: Number(e.target.value) })} /></label>
            </div>
          </>
        );
    }
  };

  return (
    <div className="settings-center">
      <style>{`
        .settings-center{display:grid;grid-template-columns:260px 1fr;gap:16px;max-width:1100px}
        .settings-nav{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);padding:8px;display:flex;flex-direction:column;gap:4px;max-height:80vh;overflow-y:auto;position:sticky;top:12px}
        .settings-nav__search{padding:4px;margin-bottom:8px}
        .settings-nav__item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;border:1px solid transparent;background:transparent;cursor:pointer;text-align:left;color:var(--text-dim);font-size:13px}
        .settings-nav__item.is-active{background:color-mix(in srgb, var(--accent) 16%, transparent);border-color:color-mix(in srgb, var(--accent) 45%, transparent);color:var(--text)}
        .settings-content{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);padding:16px;display:flex;flex-direction:column;gap:12px;min-height:400px}
        @media(max-width:900px){.settings-center{grid-template-columns:1fr}.settings-nav{position:static;max-height:40vh;flex-direction:row;flex-wrap:wrap;overflow-x:auto}.settings-nav__item{flex:0 0 auto}}
      `}</style>

      <div className="settings-nav" role="navigation" aria-label="Settings categories">
        <div className="settings-nav__search">
          <input className="field__input" type="search" placeholder="Search settings… e.g. degrees, graph colors, FPS" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search settings" />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>{filteredCategories.length} categories</div>
        </div>
        {filteredCategories.map(cat => (
          <button key={cat.id} type="button" className={`settings-nav__item${active === cat.id ? ' is-active' : ''}`} aria-current={active === cat.id ? 'page' : undefined} onClick={() => setActive(cat.id)} title={cat.keywords.join(', ')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={cat.icon} /></svg>
            <span>{cat.label}</span>
          </button>
        ))}
        <div style={{ marginTop: 'auto', padding: '8px 4px', fontSize: 11, color: 'var(--text-dim)' }}>
          <button className="btn btn--tiny" onClick={() => settingsStore.reset()}>Reset all to defaults</button>
          <button className="btn btn--tiny" style={{ marginLeft: 6 }} onClick={() => settingsStore.replace(DEFAULT_SETTINGS)}>Restore theme & precision</button>
        </div>
      </div>

      <div className="settings-content">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{CATEGORIES.find(c => c.id === active)?.label} Settings</h2>
          <span className="badge">{active}</span>
        </div>
        {renderCategory()}
      </div>
    </div>
  );
}
