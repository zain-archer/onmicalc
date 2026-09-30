import { useMemo, useState } from 'react';
import { historyStore } from '@/history/store';
import { useStore } from '@/storage/useStore';
import { READY_TOOLS, getTool, NAV_GROUPS } from '@/ui/tools';
import { setDraft, setAsk } from '@/ui/bus';
import { useSettings } from '@/settings/useSettings';
import { formatNumber } from '@/core/precision/format';
import { createStore } from '@/storage/store';

const favStore = createStore<{ ids: string[] }>('omnica.favorites.v1', { ids: ['calculator', 'graph', 'conversions', 'equation'] });
const recentStore = createStore<{ ids: string[] }>('omnica.recentTools.v1', { ids: ['calculator', 'graph', 'ask'] });

export function HomePanel() {
  const settings = useSettings();
  const [askInput, setAskInput] = useState('');
  const history = useStore(historyStore);
  const favState = useStore(favStore);
  const recentState = useStore(recentStore);
  const favorites = favState.ids;
  const recentTools = recentState.ids;

  const recentCalculations = useMemo(() => {
    return (history.entries || []).slice(0, 8);
  }, [history]);

  const nf = (v: number) => formatNumber(v, { precision: settings.precision });

  const quickActions = [
    { label: 'Calculate', icon: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 3h8v3H8V6Z', action: () => { window.location.hash = '#/calculator'; } },
    { label: 'Graph', icon: 'M3 20h18M6 4v14m-3-3 4-6 4 3 5-8', action: () => { window.location.hash = '#/graph'; } },
    { label: 'Convert', icon: 'M4 8h13l-3-3m3 11H4l3 3', action: () => { window.location.hash = '#/conversions'; } },
    { label: 'Solve', icon: 'M8 4H4m4 16H4m0-8h16M15 4h5m-5 16h5', action: () => { window.location.hash = '#/equation'; } },
    { label: 'Physics', icon: 'M12 3v3m0 12v3M3 12h3m12 0h3', action: () => { window.location.hash = '#/physics'; } },
    { label: 'Ask Anything', icon: 'M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z', action: () => { window.location.hash = '#/ask'; } },
  ];

  const onAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!askInput.trim()) return;
    setAsk(askInput.trim());
    window.location.hash = '#/ask';
  };

  return (
    <div className="stack" style={{ maxWidth: 1200 }}>
      <section className="card" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--bg-elev)), var(--bg-elev))', borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--border))' }}>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>What do you want to calculate?</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Type in plain English — OmniCalc figures out the tool. Works offline.</p>
        <form onSubmit={onAskSubmit} className="row" style={{ gap: 8 }}>
          <input
            className="field__input"
            style={{ flex: 1, fontSize: 16, padding: '14px 16px' }}
            placeholder='e.g. "plot sin(x)", "convert 50 mph to km/h", "solve 2x+5=17"'
            value={askInput}
            onChange={e => setAskInput(e.target.value)}
            aria-label="Universal search"
          />
          <button type="submit" className="btn btn--primary" style={{ padding: '12px 20px' }}>Ask</button>
          <button type="button" className="btn" onClick={() => { window.location.hash = '#/tools'; }} title="Browse all tools">All Tools</button>
        </form>
        <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
          {['plot sin(x)', '20% of 250', '72 F to C', 'solve x^2-4=0', 'mean of 12,18,20'].map(ex => (
            <button key={ex} className="chip" onClick={() => { setAsk(ex); window.location.hash = '#/ask'; }}>{ex}</button>
          ))}
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        <section className="card">
          <h2>⚡ Quick Actions</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
            {quickActions.map(q => (
              <button key={q.label} className="btn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 16 }} onClick={q.action}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={q.icon} /></svg>
                <span style={{ fontSize: 12 }}>{q.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>🕒 Recent Calculations</h2>
          {recentCalculations.length === 0 ? (
            <p className="muted">No calculations yet. Try the calculator or ask something.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentCalculations.map((entry: any, i: number) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 8px', background: 'var(--bg-inset)', borderRadius: 8 }}>
                  <button className="history__expression" style={{ maxWidth: 180 }} onClick={() => { setDraft(entry.expression); window.location.hash = '#/calculator'; }}>{entry.expression}</button>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>= {entry.display ? entry.display : nf(entry.value)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn--small" onClick={() => { window.location.hash = '#/history'; }}>View all history</button>
            <button className="btn btn--small" onClick={() => { window.location.hash = '#/calculator'; }}>Open Calculator</button>
          </div>
        </section>

        <section className="card">
          <h2>⭐ Favorites & Recent Tools</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Favorites</div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {favorites.map((id: string) => {
                  const tool = getTool(id);
                  if (!tool) return null;
                  return <button key={id} className="chip chip--toggle is-active" onClick={() => { window.location.hash = `#/${id}`; }}>{tool.label}</button>;
                })}
                <button className="btn btn--tiny" onClick={() => { window.location.hash = '#/tools'; }}>+ Add</button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Recently Used</div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {recentTools.map((id: string) => {
                  const tool = getTool(id);
                  if (!tool) return null;
                  return <button key={id} className="chip" onClick={() => { window.location.hash = `#/${id}`; }}>{tool.label}</button>;
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Continue where you left off</div>
              <p className="muted" style={{ fontSize: 12 }}>Your last graph, conversions and calculations are saved locally and restored automatically.</p>
              <div className="row">
                <button className="btn btn--small" onClick={() => { window.location.hash = '#/graph'; }}>Open Graphing</button>
                <button className="btn btn--small" onClick={() => { window.location.hash = '#/conversions'; }}>Open Converter</button>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>📚 Explore by Intent</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {NAV_GROUPS.filter(g => g.id !== 'home' && g.id !== 'tools' && g.id !== 'settings' && g.id !== 'history').map(group => (
              <button key={group.id} className="tile" style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }} onClick={() => { window.location.hash = `#/${group.defaultTool}`; }}>
                <div className="tile__head">
                  <strong style={{ fontSize: 13 }}>{group.label}</strong>
                  <span className="badge">{group.tools.length}</span>
                </div>
                <p style={{ fontSize: 11, marginTop: 4, color: 'var(--text-dim)' }}>{group.tools.map(t => getTool(t)?.label || t).join(' • ')}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <h2>💡 How OmniCalc Works</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          <div><strong>Simple surface, powerful underneath</strong><p className="muted" style={{ fontSize: 12 }}>Beginner sees a calculator. Expert gets CAS, graphing, matrices, physics, chemistry, 3D — without fighting UI.</p></div>
          <div><strong>100% Offline & Private</strong><p className="muted" style={{ fontSize: 12 }}>No backend, no analytics, no network requests. History stored locally. Export anytime.</p></div>
          <div><strong>Accurate</strong><p className="muted" style={{ fontSize: 12 }}>Hand-written safe parser, never uses unsafe evaluation. Domain errors explain what/why/how to fix.</p></div>
          <div><strong>Cross-device</strong><p className="muted" style={{ fontSize: 12 }}>320px phone → 4K desktop, touch + keyboard + stylus, PWA installable, Tauri desktop.</p></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn--small" onClick={() => { window.location.hash = '#/about'; }}>About & Roadmap</button>
          <button className="btn btn--small" onClick={() => { window.location.hash = '#/settings'; }}>Settings</button>
          <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>{READY_TOOLS.length} tools • 151 knowledge • 129 units • MIT</span>
        </div>
      </section>
    </div>
  );
}
