import { TOOLS } from '@/ui/tools';
import { APP_LICENSE, APP_NAME, APP_TAGLINE, APP_VERSION } from '@/version';

const PHASES = [
  { n: 0, title: 'Foundation', done: true },
  { n: 1, title: 'Core calculator', done: true },
  { n: 2, title: 'Scientific functions', done: true },
  { n: 3, title: 'Calculator UI', done: true },
  { n: 4, title: 'History & memory', done: true },
  { n: 5, title: 'Constants', done: true },
  { n: 6, title: 'Units', done: true },
  { n: 7, title: 'Fractions', done: true },
  { n: 8, title: 'Complex numbers', done: true },
  { n: 9, title: 'Matrices & vectors', done: true },
  { n: 10, title: 'Equation solver', done: true },
  { n: 11, title: 'Statistics', done: true },
  { n: 12, title: 'Probability', done: true },
  { n: 13, title: 'Graphing', done: true },
  { n: 14, title: 'Calculus', done: true },
  { n: 15, title: 'Number systems', done: true },
  { n: 16, title: 'Engineering', done: true },
  { n: 17, title: 'Finance & everyday', done: true },
  { n: 18, title: 'Programmer calculator', done: true },
  { n: 19, title: 'Advanced UX', done: true },
  { n: 20, title: 'Themes', done: true },
  { n: 21, title: 'Offline / PWA', done: true },
  { n: 22, title: 'Import / export', done: true },
  { n: 23, title: 'Testing expansion', done: true },
  { n: 24, title: 'Performance', done: true },
  { n: 25, title: 'Hardening', done: true },
  { n: 26, title: 'Deployment', done: true },
  { n: 27, title: 'Desktop packaging', done: true },
  { n: 28, title: 'Release docs', done: true },
  { n: 29, title: 'Ask OmniCalc (plain language)', done: true },
];

export function AboutPanel() {
  const done = PHASES.filter((p) => p.done).length;
  return (
    <div className="stack">
      <section className="card">
        <h2>
          {APP_NAME} <span className="pill">v{APP_VERSION}</span>
        </h2>
        <p>
          {APP_TAGLINE}. Completely free: no subscriptions, no premium tiers, no account, no ads,
          no paid APIs. Every calculation runs on your device.
        </p>
        <ul className="ticks">
          <li>Ask in plain words — “how many miles is 42 km”</li>
          <li>Definitions on demand — “what is pi”, “define acceleration”, “what unit is N”</li>
          <li>Drop in a PDF, Word, Excel, PowerPoint or text file and solve its questions</li>
          <li>Ten colour palettes, light and dark, in Settings</li>
          <li>100% offline capable</li>
          <li>No data ever leaves the device</li>
          <li>Open source ({APP_LICENSE})</li>
        </ul>
      </section>

      <section className="card">
        <h2>
          Build progress <span className="pill">{done}/{PHASES.length} phases</span>
        </h2>
        <ol className="phases">
          {PHASES.map((phase) => (
            <li key={phase.n} className={phase.done ? 'is-done' : undefined}>
              <span className="phases__dot" aria-hidden="true" />
              <span>
                <strong>Phase {phase.n}</strong> — {phase.title}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>Keyboard</h2>
        <p>
          Press <kbd>Ctrl</kbd>+<kbd>K</kbd> (or <kbd>/</kbd>) for the command palette,{' '}
          <kbd>?</kbd> for the full shortcut list, <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> to walk
          through tools and <kbd>Alt</kbd>+<kbd>D</kbd> to switch theme.
        </p>
      </section>

      <section className="card">
        <h2>Documentation</h2>
        <ul className="ticks">
          <li><code>README.md</code> — what OmniCalc is and how the code is organised</li>
          <li><code>PROJECT_STATUS.md</code> — phase-by-phase status, test and build numbers</li>
          <li><code>DEPLOYMENT.md</code> — static hosting, PWA and desktop packaging</li>
          <li><code>CONTRIBUTING.md</code> — development workflow and code rules</li>
          <li><code>CHANGELOG.md</code> — release history</li>
        </ul>
        <p className="muted">
          Version {APP_VERSION} · {APP_LICENSE} licensed · no network requests at runtime, and no
          accounts: every calculation runs on this device.
        </p>
      </section>

      <section className="card">
        <h2>Tools</h2>
        <div className="grid">
          {TOOLS.filter((t) => t.id !== 'about').map((tool) => (
            <div className="tile" key={tool.id}>
              <div className="tile__head">
                <strong>{tool.label}</strong>
                <span className={`badge badge--${tool.status}`}>
                  {tool.status === 'ready' ? 'Ready' : `Phase ${tool.phase}`}
                </span>
              </div>
              <p>{tool.summary}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
