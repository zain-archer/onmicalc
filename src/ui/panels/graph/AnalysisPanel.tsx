import { formatNumber } from '@/core/precision/format';
import { visibleBounds } from '@/graphing/viewport';
import type { GraphFunction } from '@/graphing/types';

interface Props {
  functions: GraphFunction[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  analysis: any;
  setAnalysis: (a: any) => void;
  analysisResults: any;
  selectedCompiled: any;
  viewport: any;
  sizeRef: React.MutableRefObject<{ width: number; height: number }>;
  precision: number;
  updateFunction: (id: string, patch: Partial<GraphFunction>) => void;
}

export function AnalysisPanel({
  functions, selectedId, setSelectedId, analysis, setAnalysis, analysisResults, selectedCompiled, viewport, sizeRef, precision, updateFunction
}: Props) {
  const nf = (v: number) => formatNumber(v, { precision });
  return (
    <div className="graph-right">
      <div className="graph-right__header">
        <h2>Analysis</h2>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="graph-fn__label-input" style={{ width: 120 }}>
          {functions.map(f => <option key={f.id} value={f.id}>{f.label || f.expression.slice(0, 20) || f.id}</option>)}
        </select>
      </div>
      <div className="graph-right__body">
        <div className="graph-tool-tabs">
          {[
            { id: 'none', label: 'Overview' },
            { id: 'trace', label: 'Trace' },
            { id: 'root', label: 'Roots' },
            { id: 'intersection', label: 'Intersect' },
            { id: 'minmax', label: 'Min/Max' },
            { id: 'derivative', label: "f'" },
            { id: 'integral', label: '∫' },
            { id: 'tangent', label: 'Tangent' },
            { id: 'normal', label: 'Normal' },
            { id: 'area', label: 'Area' },
            { id: 'evaluate', label: 'Eval' },
            { id: 'table', label: 'Table' },
          ].map(tab => (
            <button key={tab.id} className={`graph-tool-tab ${analysis.type === tab.id ? 'is-active' : ''}`} onClick={() => setAnalysis((a: any) => ({ ...a, type: tab.id }))}>{tab.label}</button>
          ))}
        </div>

        {analysis.type === 'none' && analysisResults && (
          <>
            <div className="graph-analysis-result"><h4>Roots (zeros)</h4><div>{analysisResults.roots.length ? analysisResults.roots.map((r: number) => nf(r)).join(', ') : 'None in view'}</div></div>
            <div className="graph-analysis-result"><h4>Extrema</h4><div>{analysisResults.extrema.length ? analysisResults.extrema.map((p: any) => `(${nf(p.x)}, ${nf(p.y)})`).join(', ') : 'None in view'}</div></div>
            <div className="graph-analysis-result"><h4>Asymptotes</h4><div>{analysisResults.asymptotes.length ? analysisResults.asymptotes.map((a: any) => a.equation).join(', ') : 'None detected'}</div></div>
            <div className="graph-analysis-result"><h4>Selected</h4><div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{selectedCompiled?.func.expression || '—'}</div></div>
          </>
        )}

        {analysis.type === 'trace' && (
          <div className="graph-analysis-result"><h4>Trace Mode</h4><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Enable trace in toolbar, then move cursor along graph to see values.</div></div>
        )}

        {analysis.type === 'root' && (
          <div className="graph-analysis-result"><h4>Root Finder</h4><div>Found {analysisResults?.roots.length || 0} root(s):</div><div style={{ fontFamily: 'var(--mono)', marginTop: 6 }}>{analysisResults?.roots.map((r: number) => `x = ${nf(r)}`).join('\n') || 'None'}</div></div>
        )}

        {analysis.type === 'intersection' && (
          <div className="graph-analysis-result">
            <h4>Intersection</h4>
            <div className="graph-field"><label>Second function</label><select value={analysis.secondId || ''} onChange={e => setAnalysis((a: any) => ({ ...a, secondId: e.target.value }))}><option value="">Select…</option>{functions.filter(f => f.id !== selectedId).map(f => <option key={f.id} value={f.id}>{f.label || f.expression.slice(0, 30)}</option>)}</select></div>
            <div style={{ marginTop: 8 }}>{analysisResults?.intersections.length ? analysisResults.intersections.map((p: any, i: number) => <div key={i} style={{ fontFamily: 'var(--mono)' }}>({nf(p.x)}, {nf(p.y)})</div>) : 'No intersections or select second'}</div>
          </div>
        )}

        {analysis.type === 'minmax' && (
          <div className="graph-analysis-result"><h4>Min / Max</h4><div>{analysisResults?.extrema.length ? analysisResults.extrema.map((p: any) => `${p.y > 0 ? 'Max' : 'Min'} at (${nf(p.x)}, ${nf(p.y)})`).join('\n') : 'None'}</div></div>
        )}

        {analysis.type === 'derivative' && (
          <div className="graph-analysis-result">
            <h4>Derivative</h4>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Dashed line shows f'. Enable per-function in left panel.</div>
            {selectedCompiled && <div style={{ marginTop: 8 }}><label className="field field--check"><input type="checkbox" checked={!!selectedCompiled.func.showDerivative} onChange={e => updateFunction(selectedCompiled.func.id, { showDerivative: e.target.checked })} /><span>Show derivative</span></label></div>}
          </div>
        )}

        {analysis.type === 'integral' && (
          <div className="graph-analysis-result">
            <h4>Integral</h4>
            <div className="graph-field"><label>Lower a</label><input type="number" step="0.1" value={analysis.lowerBound ?? ''} onChange={e => setAnalysis((a: any) => ({ ...a, lowerBound: Number(e.target.value) }))} /></div>
            <div className="graph-field"><label>Upper b</label><input type="number" step="0.1" value={analysis.upperBound ?? ''} onChange={e => setAnalysis((a: any) => ({ ...a, upperBound: Number(e.target.value) }))} /></div>
            {analysisResults?.integral && <div style={{ marginTop: 8, fontFamily: 'var(--mono)' }}><div>∫ = {nf(analysisResults.integral.value)}</div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Err {analysisResults.integral.error.toExponential(2)}</div></div>}
          </div>
        )}

        {analysis.type === 'tangent' && (
          <div className="graph-analysis-result">
            <h4>Tangent</h4>
            <div className="graph-field"><label>x</label><input type="number" step="0.1" value={analysis.xValue ?? ''} onChange={e => setAnalysis((a: any) => ({ ...a, xValue: Number(e.target.value) }))} /></div>
            {analysisResults?.tangent && <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 12 }}><div>Point ({nf(analysisResults.tangent.x)}, {nf(analysisResults.tangent.y)})</div><div>Slope {nf(analysisResults.tangent.slope)}</div><div>{analysisResults.tangent.equation}</div></div>}
          </div>
        )}

        {analysis.type === 'normal' && (
          <div className="graph-analysis-result">
            <h4>Normal</h4>
            <div className="graph-field"><label>x</label><input type="number" step="0.1" value={analysis.xValue ?? ''} onChange={e => setAnalysis((a: any) => ({ ...a, xValue: Number(e.target.value) }))} /></div>
            {analysisResults?.normal && <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 12 }}><div>Point ({nf(analysisResults.normal.x)}, {nf(analysisResults.normal.y)})</div><div>{analysisResults.normal.equation}</div></div>}
          </div>
        )}

        {analysis.type === 'area' && (
          <div className="graph-analysis-result">
            <h4>Area Between</h4>
            <div className="graph-field"><label>Second</label><select value={analysis.secondId || ''} onChange={e => setAnalysis((a: any) => ({ ...a, secondId: e.target.value }))}><option value="">Select…</option>{functions.filter(f => f.id !== selectedId).map(f => <option key={f.id} value={f.id}>{f.label || f.expression.slice(0, 30)}</option>)}</select></div>
            <div className="graph-field"><label>From</label><input type="number" step="0.1" value={analysis.lowerBound ?? ''} onChange={e => setAnalysis((a: any) => ({ ...a, lowerBound: Number(e.target.value) }))} /></div>
            <div className="graph-field"><label>To</label><input type="number" step="0.1" value={analysis.upperBound ?? ''} onChange={e => setAnalysis((a: any) => ({ ...a, upperBound: Number(e.target.value) }))} /></div>
            {analysisResults?.area && <div style={{ marginTop: 8, fontFamily: 'var(--mono)' }}>Area = {nf(analysisResults.area.value)}</div>}
          </div>
        )}

        {analysis.type === 'evaluate' && (
          <div className="graph-analysis-result">
            <h4>Evaluate</h4>
            <div className="graph-field"><label>x =</label><input type="number" step="0.1" value={analysis.xValue ?? ''} onChange={e => setAnalysis((a: any) => ({ ...a, xValue: Number(e.target.value) }))} /></div>
            {analysisResults?.evaluate && <div style={{ marginTop: 8, fontFamily: 'var(--mono)' }}>{analysisResults.evaluate.valid ? `f(${nf(analysis.xValue!)}) = ${nf(analysisResults.evaluate.y)}` : analysisResults.evaluate.error}</div>}
          </div>
        )}

        {analysis.type === 'table' && (
          <div className="graph-analysis-result">
            <h4>Table</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <div className="graph-field"><label>Start</label><input type="number" step="0.5" value={analysis.tableStart ?? ''} onChange={e => setAnalysis((a: any) => ({ ...a, tableStart: Number(e.target.value) }))} /></div>
              <div className="graph-field"><label>End</label><input type="number" step="0.5" value={analysis.tableEnd ?? ''} onChange={e => setAnalysis((a: any) => ({ ...a, tableEnd: Number(e.target.value) }))} /></div>
              <div className="graph-field"><label>Step</label><input type="number" step="0.1" value={analysis.tableStep ?? ''} onChange={e => setAnalysis((a: any) => ({ ...a, tableStep: Number(e.target.value) }))} /></div>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 8, border: '1px solid var(--border)', borderRadius: 8 }}>
              <table className="graph-table"><thead><tr><th>x</th><th>f(x)</th></tr></thead><tbody>{analysisResults?.table.map((row: any, i: number) => <tr key={i}><td>{nf(row.x)}</td><td>{row.valid ? nf(row.y) : '—'}</td></tr>)}</tbody></table>
            </div>
          </div>
        )}

        <div className="graph-analysis-result">
          <h4>View</h4>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
            Center ({nf(viewport.centerX)}, {nf(viewport.centerY)})<br />
            Scale X={nf(viewport.scaleX)} Y={nf(viewport.scaleY)}<br />
            Bounds [{nf(visibleBounds(viewport, sizeRef.current).minX)}, {nf(visibleBounds(viewport, sizeRef.current).maxX)}]
          </div>
        </div>

        <div className="graph-analysis-result">
          <h4>Tips</h4>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            <li>y = x^2, sin(x), cos(x), tan(x), sqrt(x), ln(x), abs(x)</li>
            <li>e^x, 2x+3, constants pi, e, tau</li>
            <li>Parametric x(t), y(t)</li>
            <li>Polar r(theta)</li>
            <li>Implicit x^2 + y^2 = 25</li>
            <li>Inequality y {'>'} x^2</li>
            <li>Drag pan, wheel zoom, pinch zoom</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
