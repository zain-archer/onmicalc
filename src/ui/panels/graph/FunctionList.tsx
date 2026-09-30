import { useState } from 'react';
import type { GraphFunction, GraphType } from '@/graphing/types';
import { createDefaultFunction } from '@/graphing/types';

function uid() { return Math.random().toString(36).slice(2, 9); }

interface Props {
  functions: GraphFunction[];
  setFunctions: React.Dispatch<React.SetStateAction<GraphFunction[]>>;
  selectedId: string;
  setSelectedId: (id: string) => void;
  compiled: any[];
}

export function FunctionList({ functions, setFunctions, selectedId, setSelectedId, compiled }: Props) {
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);

  const addFunction = (type: GraphType = 'cartesian') => {
    const id = `f${Date.now().toString(36)}${uid()}`;
    const fn = createDefaultFunction(id, functions.length, type);
    if (type === 'cartesian') fn.expression = 'x';
    else if (type === 'parametric') { fn.xExpression = '2*cos(t)'; fn.yExpression = '2*sin(t)'; fn.expression = ''; }
    else if (type === 'polar') fn.expression = '2 + sin(5*theta)';
    else if (type === 'implicit') fn.expression = 'x^2 + y^2 - 9';
    else if (type === 'inequality') fn.expression = 'y > x^2 - 2';
    setFunctions(f => [...f, fn]);
    setSelectedId(id);
  };

  const updateFunction = (id: string, patch: Partial<GraphFunction>) => {
    setFunctions(fs => fs.map(f => f.id === id ? { ...f, ...patch } : f));
  };
  const removeFunction = (id: string) => {
    if (functions.length <= 1) return;
    setFunctions(fs => fs.filter(f => f.id !== id));
    if (selectedId === id) setSelectedId(functions.find(f => f.id !== id)?.id || functions[0]!.id);
  };
  const duplicateFunction = (id: string) => {
    const f = functions.find(x => x.id === id);
    if (!f) return;
    const newId = `f${Date.now().toString(36)}${uid()}`;
    const copy = { ...f, id: newId, label: f.label ? `${f.label} copy` : '' };
    setFunctions(fs => [...fs, copy]);
    setSelectedId(newId);
  };

  return (
    <div className="graph-left">
      <div className="graph-left__header">
        <h2>Functions ({functions.length})</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn--tiny" onClick={() => addFunction('cartesian')}>+ y=</button>
          <button className="btn btn--tiny" onClick={() => addFunction('parametric')}>+ param</button>
          <button className="btn btn--tiny" onClick={() => addFunction('polar')}>+ polar</button>
          <button className="btn btn--tiny" onClick={() => addFunction('implicit')}>+ impl</button>
        </div>
      </div>
      <div className="graph-left__list">
        {functions.map(f => {
          const comp = compiled.find((c: any) => c.func.id === f.id);
          const hasError = !!comp?.error;
          return (
            <div key={f.id} className={`graph-fn ${selectedId === f.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(f.id)}>
              <div className="graph-fn__top">
                <input type="color" className="graph-fn__color" value={f.color} onChange={e => updateFunction(f.id, { color: e.target.value })} title="Color" style={{ background: f.color } as any} />
                <span className="graph-fn__type">{f.type}</span>
                <input className="graph-fn__label-input" placeholder="Label" value={f.label} onChange={e => updateFunction(f.id, { label: e.target.value })} onClick={e => e.stopPropagation()} />
                <button className={`btn btn--tiny ${f.visible ? 'is-on' : ''}`} onClick={e => { e.stopPropagation(); updateFunction(f.id, { visible: !f.visible }); }}>{f.visible ? '👁' : '🚫'}</button>
              </div>
              {f.type === 'cartesian' && (
                <input className="graph-fn__input" value={f.expression} placeholder="y = x^2" onChange={e => updateFunction(f.id, { expression: e.target.value })} spellCheck={false} />
              )}
              {f.type === 'parametric' && (
                <>
                  <div className="graph-fn__row"><span style={{ fontSize: 11, color: 'var(--text-dim)' }}>x(t)=</span><input className="graph-fn__input" value={f.xExpression || ''} onChange={e => updateFunction(f.id, { xExpression: e.target.value })} placeholder="cos(t)" style={{ flex: 1 }} /></div>
                  <div className="graph-fn__row"><span style={{ fontSize: 11, color: 'var(--text-dim)' }}>y(t)=</span><input className="graph-fn__input" value={f.yExpression || ''} onChange={e => updateFunction(f.id, { yExpression: e.target.value })} placeholder="sin(t)" style={{ flex: 1 }} /></div>
                  <div className="graph-fn__row">
                    <input className="graph-fn__label-input" type="number" placeholder="tMin" value={f.paramDomain?.min ?? ''} onChange={e => updateFunction(f.id, { paramDomain: { min: Number(e.target.value), max: f.paramDomain?.max ?? 10 } })} style={{ width: 70 }} />
                    <input className="graph-fn__label-input" type="number" placeholder="tMax" value={f.paramDomain?.max ?? ''} onChange={e => updateFunction(f.id, { paramDomain: { min: f.paramDomain?.min ?? -10, max: Number(e.target.value) } })} style={{ width: 70 }} />
                  </div>
                </>
              )}
              {f.type === 'polar' && (
                <>
                  <input className="graph-fn__input" value={f.expression} onChange={e => updateFunction(f.id, { expression: e.target.value })} placeholder="r = sin(3θ)" />
                  <div className="graph-fn__row">
                    <input className="graph-fn__label-input" type="number" placeholder="θMin" value={f.paramDomain?.min ?? ''} onChange={e => updateFunction(f.id, { paramDomain: { min: Number(e.target.value), max: f.paramDomain?.max ?? 6.28 } })} style={{ width: 70 }} />
                    <input className="graph-fn__label-input" type="number" placeholder="θMax" value={f.paramDomain?.max ?? ''} onChange={e => updateFunction(f.id, { paramDomain: { min: f.paramDomain?.min ?? 0, max: Number(e.target.value) } })} style={{ width: 70 }} />
                  </div>
                </>
              )}
              {f.type === 'implicit' && <input className="graph-fn__input" value={f.expression} onChange={e => updateFunction(f.id, { expression: e.target.value })} placeholder="x^2 + y^2 = 25" />}
              {f.type === 'inequality' && <input className="graph-fn__input" value={f.expression} onChange={e => updateFunction(f.id, { expression: e.target.value })} placeholder="y > x^2" />}
              {hasError && <span style={{ color: 'var(--danger)', fontSize: 11 }}>⚠ {comp?.error}</span>}
              <div className="graph-fn__row">
                <select value={f.lineStyle} onChange={e => updateFunction(f.id, { lineStyle: e.target.value as any })} className="graph-fn__label-input" style={{ width: 80 }}>
                  <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option>
                </select>
                <input type="range" min={1} max={5} step={0.5} value={f.lineWidth} onChange={e => updateFunction(f.id, { lineWidth: Number(e.target.value) })} style={{ width: 60 }} title="Thickness" />
                <button className="btn btn--tiny" onClick={e => { e.stopPropagation(); setEditingDomainId(editingDomainId === f.id ? null : f.id); }}>Domain</button>
                <button className="btn btn--tiny" onClick={e => { e.stopPropagation(); duplicateFunction(f.id); }}>⎘</button>
                <button className="btn btn--tiny" disabled={functions.length <= 1} onClick={e => { e.stopPropagation(); removeFunction(f.id); }}>✕</button>
              </div>
              {editingDomainId === f.id && (
                <div className="graph-fn__row">
                  <input className="graph-fn__label-input" type="number" placeholder="X min" value={f.domain?.min ?? ''} onChange={e => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    if (v === null) updateFunction(f.id, { domain: null });
                    else updateFunction(f.id, { domain: { min: v, max: f.domain?.max ?? 10 } });
                  }} style={{ width: 70 }} />
                  <input className="graph-fn__label-input" type="number" placeholder="X max" value={f.domain?.max ?? ''} onChange={e => {
                    const v = e.target.value === '' ? null : Number(e.target.value);
                    if (v === null) updateFunction(f.id, { domain: null });
                    else updateFunction(f.id, { domain: { min: f.domain?.min ?? -10, max: v } });
                  }} style={{ width: 70 }} />
                  <button className="btn btn--tiny" onClick={() => updateFunction(f.id, { domain: null })}>Auto</button>
                </div>
              )}
              <div className="graph-fn__row">
                <label className="field field--check" style={{ margin: 0, fontSize: 11 }}><input type="checkbox" checked={!!f.showDerivative} onChange={e => updateFunction(f.id, { showDerivative: e.target.checked })} /><span>Show f'</span></label>
                {f.type === 'cartesian' && <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>{f.domain ? `Domain: [${f.domain.min}, ${f.domain.max}]` : 'Domain: Auto'}</span>}
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn btn--small" onClick={() => addFunction('cartesian')}>+ Cartesian</button>
          <button className="btn btn--small" onClick={() => addFunction('inequality')}>+ Inequality</button>
          <button className="btn btn--small" onClick={() => setFunctions(fs => fs.map(f => ({ ...f, visible: true })))}>Show All</button>
          <button className="btn btn--small" onClick={() => setFunctions(fs => fs.map(f => ({ ...f, visible: false })))}>Hide All</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.4 }}>
          <strong>Examples:</strong><br />• y = x^2, sin(x), cos(x), tan(x), sqrt(x), ln(x), abs(x)<br />• e^x, 2x+3, x^3 - 3x<br />• Parametric: x=cos(t), y=sin(t)<br />• Polar: r=sin(5*theta)<br />• Implicit: x^2 + y^2 = 25<br />• Inequality: y {'>'} x^2
        </div>
      </div>
    </div>
  );
}
