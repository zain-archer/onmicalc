import { getTool, type ToolDef } from '@/ui/tools';

const CATEGORY_META: Record<string, { label: string; description: string; tools: string[] }> = {
  MATHEMATICS: {
    label: 'MATHEMATICS',
    description: 'Core calculation and analysis',
    tools: ['calculator', 'fractions', 'complex', 'graph', 'graph3d', 'calculus', 'equation', 'matrix', 'statistics', 'probability', 'numbersystems'],
  },
  SCIENCE: {
    label: 'SCIENCE',
    description: 'Physics, Chemistry and 3D visualization',
    tools: ['physics', 'chemistry', 'graph3d', 'constants'],
  },
  ENGINEERING: {
    label: 'ENGINEERING',
    description: 'Electrical, mechanical, geometry',
    tools: ['engineering', 'conversions', 'constants'],
  },
  BUSINESS: {
    label: 'BUSINESS',
    description: 'Money and everyday',
    tools: ['finance'],
  },
  COMPUTING: {
    label: 'COMPUTING',
    description: 'Bases, bits and programmer',
    tools: ['programmer', 'numbersystems'],
  },
  REFERENCE: {
    label: 'REFERENCE',
    description: 'Knowledge and data',
    tools: ['constants', 'ask', 'history'],
  },
  SYSTEM: {
    label: 'SYSTEM',
    description: 'App controls',
    tools: ['history', 'settings', 'about'],
  },
};

export function ToolsPanel() {
  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <section className="card">
        <h2>All Tools — Browse by Category</h2>
        <p className="muted">OmniCalc has {Object.values(CATEGORY_META).flatMap(c => c.tools).length} tools across {Object.keys(CATEGORY_META).length} categories. Click any to open. Use Ctrl+K to search.</p>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn--small" onClick={() => { window.location.hash = '#/home'; }}>← Home</button>
          <button className="btn btn--small" onClick={() => { window.location.hash = '#/ask'; }}>Ask in plain English</button>
        </div>
      </section>

      {Object.entries(CATEGORY_META).map(([key, cat]) => {
        const tools = cat.tools.map(id => getTool(id)).filter(Boolean) as ToolDef[];
        // dedupe
        const unique = Array.from(new Map(tools.map(t => [t.id, t])).values());
        return (
          <section key={key} className="card">
            <h2>{cat.label} <span className="badge">{unique.length}</span> <small className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>{cat.description}</small></h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginTop: 8 }}>
              {unique.map(tool => (
                <button key={tool.id} className="tile" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => { window.location.hash = `#/${tool.id}`; }}>
                  <div className="tile__head">
                    <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={tool.icon} /></svg>
                      {tool.label}
                    </strong>
                    <span className="badge badge--ready">ready</span>
                  </div>
                  <p style={{ fontSize: 12, marginTop: 6 }}>{tool.summary}</p>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <section className="card">
        <h2>Quick Navigation</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {[
            { id: 'calculator', label: 'Calculator' },
            { id: 'graph', label: 'Graphing' },
            { id: 'conversions', label: 'Unit Converter' },
            { id: 'equation', label: 'Equation Solver' },
            { id: 'statistics', label: 'Statistics' },
            { id: 'physics', label: 'Physics' },
            { id: 'chemistry', label: 'Chemistry' },
            { id: 'finance', label: 'Finance' },
            { id: 'programmer', label: 'Programmer' },
            { id: 'ask', label: 'Ask OmniCalc' },
          ].map(q => (
            <button key={q.id} className="btn" onClick={() => { window.location.hash = `#/${q.id}`; }}>{q.label}</button>
          ))}
        </div>
      </section>
    </div>
  );
}
