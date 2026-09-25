import { useRoute } from '@/ui/router';
import { getTool } from '@/ui/tools';
import { AboutPanel } from '@/ui/panels/AboutPanel';
import { CalculatorPanel } from '@/ui/panels/CalculatorPanel';
import { HistoryPanel } from '@/ui/panels/HistoryPanel';
import { SettingsPanel } from '@/ui/panels/SettingsPanel';
import { BottomNav, Sidebar } from './Nav';
import { CommandPalette } from './CommandPalette';
import { AppStatus } from './AppStatus';
import { ShortcutsDialog } from './ShortcutsDialog';
import { settingsStore } from '@/settings/store';
import { answerStore, setDraft } from '@/ui/bus';
import { READY_TOOLS } from '@/ui/tools';
import { applyBackup, backupFileName, buildBackup, downloadText, parseBackup, readTextFile, serializeBackup } from '@/storage/backup';
import { pickFile } from '@/storage/pickFile';
import { notify } from '@/ui/notify';
import { isTypingTarget, matchesBinding } from '@/ui/shortcuts';
import { resolveTheme } from '@/ui/theme/theme';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';

/**
 * Panels load on demand so the first paint only ships the shell and the
 * calculator. Everything below is fetched the first time its tool is opened and
 * then cached by the service worker for offline use.
 */
const panel = (loader: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(async () => {
    const module = await loader();
    return { default: module[name] as ComponentType };
  });

const ConstantsPanel = panel(() => import('@/ui/panels/ConstantsPanel'), 'ConstantsPanel');
const ConversionsPanel = panel(() => import('@/ui/panels/ConversionsPanel'), 'ConversionsPanel');
const FractionsPanel = panel(() => import('@/ui/panels/FractionsPanel'), 'FractionsPanel');
const ComplexPanel = panel(() => import('@/ui/panels/ComplexPanel'), 'ComplexPanel');
const MatrixPanel = panel(() => import('@/ui/panels/MatrixPanel'), 'MatrixPanel');
const EquationPanel = panel(() => import('@/ui/panels/EquationPanel'), 'EquationPanel');
const StatisticsPanel = panel(() => import('@/ui/panels/StatisticsPanel'), 'StatisticsPanel');
const ProbabilityPanel = panel(() => import('@/ui/panels/ProbabilityPanel'), 'ProbabilityPanel');
const GraphPanel = panel(() => import('@/ui/panels/GraphPanel'), 'GraphPanel');
const CalculusPanel = panel(() => import('@/ui/panels/CalculusPanel'), 'CalculusPanel');
const NumberSystemsPanel = panel(() => import('@/ui/panels/NumberSystemsPanel'), 'NumberSystemsPanel');
const ProgrammerPanel = panel(() => import('@/ui/panels/ProgrammerPanel'), 'ProgrammerPanel');
const EngineeringPanel = panel(() => import('@/ui/panels/EngineeringPanel'), 'EngineeringPanel');
const FinancePanel = panel(() => import('@/ui/panels/FinancePanel'), 'FinancePanel');

/** Panels are registered here as each phase lands. */
const PANELS: Record<string, ComponentType> = {
  calculator: CalculatorPanel,
  fractions: FractionsPanel,
  complex: ComplexPanel,
  graph: GraphPanel,
  calculus: CalculusPanel,
  matrix: MatrixPanel,
  equation: EquationPanel,
  statistics: StatisticsPanel,
  probability: ProbabilityPanel,
  constants: ConstantsPanel,
  conversions: ConversionsPanel,
  history: HistoryPanel,
  settings: SettingsPanel,
  numbersystems: NumberSystemsPanel,
  programmer: ProgrammerPanel,
  engineering: EngineeringPanel,
  finance: FinancePanel,
  about: AboutPanel,
};

export function AppShell() {
  const [route, go] = useRoute();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const tool = getTool(route);
  const Panel = PANELS[route] ?? AboutPanel;

  const toggleTheme = useCallback(() => {
    const settings = settingsStore.get();
    const next = resolveTheme(settings.theme) === 'dark' ? 'light' : 'dark';
    settingsStore.set({ ...settings, theme: next });
  }, []);

  const handlers = useMemo(
    () => ({
      navigate: go,
      toggleTheme,
      setAngleMode: (mode: 'DEG' | 'RAD' | 'GRAD') => {
        const settings = settingsStore.get();
        settingsStore.set({ ...settings, angleMode: mode });
      },
      clearDraft: () => setDraft(''),
      copyResult: () => {
        const display = answerStore.get().display;
        void navigator.clipboard?.writeText(display).catch(() => undefined);
      },
      openShortcuts: () => setShortcutsOpen(true),
      exportData: () => {
        downloadText(backupFileName(), serializeBackup(buildBackup()), 'application/json');
        notify('Backup downloaded to your device.', 'ok');
      },
      importData: () => {
        void pickFile().then(async (file) => {
          if (!file) return;
          const result = parseBackup(await readTextFile(file));
          if (!result.ok) {
            notify(result.error, 'error');
            return;
          }
          applyBackup(result.backup, { mode: 'merge' });
          notify(
            `Imported ${result.summary.historyCount} history entries and ${result.summary.memorySlots} memory slots.`,
            'ok',
          );
        });
      },
    }),
    [go, toggleTheme],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = isTypingTarget(event.target);
      if (matchesBinding(event, { key: 'k', primary: true }) || (matchesBinding(event, { key: '/' }) && !typing)) {
        event.preventDefault();
        setShortcutsOpen(false);
        setPaletteOpen(true);
        return;
      }
      if (matchesBinding(event, { key: '?', shift: true }) && !typing) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false);
        setShortcutsOpen(false);
        return;
      }
      if (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const index = Math.max(0, READY_TOOLS.findIndex((entry) => entry.id === route));
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = READY_TOOLS[(((index + delta) % READY_TOOLS.length) + READY_TOOLS.length) % READY_TOOLS.length]!;
        go(next.id);
        return;
      }
      if (matchesBinding(event, { key: 'd', alt: true })) {
        event.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [go, route, toggleTheme]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to calculator content
      </a>
      <Sidebar route={route} onNavigate={go} />
      <div className="app__main">
        <header className="topbar">
          <h1 className="topbar__title">{tool?.label ?? 'OmniCalc'}</h1>
          <p className="topbar__summary">{tool?.summary}</p>
          <div className="topbar__actions">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setPaletteOpen(true)}
              title="Search tools and actions"
            >
              Commands <kbd className="kbd-inline">Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={toggleTheme}
              aria-label="Toggle light or dark theme"
              title="Toggle theme (Alt+D)"
            >
              ◐
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              ?
            </button>
          </div>
        </header>
        <main className="panel-host" id="main">
          <Suspense fallback={<PanelLoading />}>
            <Panel />
          </Suspense>
        </main>
      </div>
      <BottomNav route={route} onNavigate={go} />
      <AppStatus />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} handlers={handlers} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

/** Shown while a tool's code chunk is downloading (once, then cached). */
function PanelLoading() {
  return (
    <div className="stack" role="status" aria-live="polite">
      <section className="card">
        <p className="muted">Loading tool…</p>
      </section>
    </div>
  );
}
