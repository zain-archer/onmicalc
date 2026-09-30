import { useState } from 'react';
import { getTool } from '@/ui/tools';
import { setDraft } from '@/ui/bus';

interface SendToProps {
  expression?: string;
  value?: number;
  display?: string;
  label?: string;
}

const SENDABLE_TOOLS = ['graph', 'graph3d', 'equation', 'matrix', 'statistics', 'calculus', 'conversions', 'calculator'];

export function SendTo({ expression, value, display, label = 'Send to...' }: SendToProps) {
  const [open, setOpen] = useState(false);
  if (!expression && value === undefined) return null;

  const tools = SENDABLE_TOOLS.map(id => getTool(id)).filter(Boolean) as any[];

  const send = (toolId: string) => {
    const text = expression || String(value);
    if (toolId === 'calculator') {
      setDraft(text);
    } else if (toolId === 'graph') {
      // For graphing, set as function
      setDraft(`y=${text}`);
    } else {
      setDraft(text);
    }
    window.location.hash = `#/${toolId}`;
    setOpen(false);
  };

  return (
    <div className="sendto" style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="btn btn--small btn--ghost" onClick={() => setOpen(!open)} title="Send result to another tool" aria-expanded={open}>
        {label} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="sendto__menu" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {tools.map(tool => (
            <button key={tool.id} type="button" className="btn btn--small" style={{ justifyContent: 'flex-start' }} onClick={() => send(tool.id)}>
              → {tool.label}
            </button>
          ))}
          <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: '4px 6px' }}>
            {expression ? `Expression: ${expression.slice(0, 30)}` : ''} {display ? `= ${display}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
