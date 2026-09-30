import { useState } from 'react';
import { DEFAULT_VIEWPORT, zoomAt } from '@/graphing/viewport';
import { useGraphCore } from './graph/useGraphCore';
import { FunctionList } from './graph/FunctionList';
import { GraphCanvas } from './graph/GraphCanvas';
import { AnalysisPanel } from './graph/AnalysisPanel';
import { useSettings } from '@/settings/useSettings';

export function GraphPanel() {
  const settings = useSettings();
  const core = useGraphCore();
  const [fullscreen, setFullscreen] = useState(false);
  const [showFuncDrawer, setShowFuncDrawer] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(true);

  const resetView = () => core.setViewport(DEFAULT_VIEWPORT);
  const centerOrigin = () => core.setViewport(v => ({ ...v, centerX: 0, centerY: 0 }));
  const fitView = () => {
    const size = core.sizeRef.current;
    if (core.analysisResults && (core.analysisResults.roots.length > 0 || core.analysisResults.extrema.length > 0)) {
      const xs = [...core.analysisResults.roots, ...core.analysisResults.extrema.map((e: any) => e.x)];
      if (xs.length > 0) {
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const centerX = (minX + maxX) / 2;
        const spanX = Math.max(10, (maxX - minX) * 2.5);
        const scaleX = spanX / (size.width / 100);
        core.setViewport(v => ({ ...v, centerX, scaleX, scaleY: scaleX }));
        return;
      }
    }
    resetView();
  };

  const updateFunction = (id: string, patch: any) => {
    core.setFunctions(fs => fs.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  return (
    <div className={`graph-workspace ${fullscreen ? 'is-fullscreen' : ''}`}>
      <style>{`
        .graph-workspace{display:grid;grid-template-columns:320px 1fr 340px;grid-template-rows:auto 1fr auto;gap:12px;height:calc(100vh - 120px);min-height:560px;max-width:100%;position:relative}
        .graph-workspace.is-fullscreen{position:fixed;inset:0;z-index:100;background:var(--bg);padding:12px;height:100vh;grid-template-columns:340px 1fr 360px}
        .graph-toolbar{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px}
        .graph-toolbar__group{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
        .graph-toolbar__sep{width:1px;height:24px;background:var(--border);margin:0 4px}
        .graph-left{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);display:flex;flex-direction:column;overflow:hidden;min-height:0}
        .graph-left__header{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px}
        .graph-left__header h2{margin:0;font-size:14px}
        .graph-left__list{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px}
        .graph-fn{background:var(--bg-inset);border:1px solid var(--border);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;transition:border-color .15s}
        .graph-fn.is-selected{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent)}
        .graph-fn__top{display:flex;align-items:center;gap:8px}
        .graph-fn__color{width:16px;height:16px;border-radius:4px;flex:none;border:1px solid var(--border);cursor:pointer}
        .graph-fn__type{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-dim);background:var(--bg-elev);border:1px solid var(--border);border-radius:6px;padding:2px 6px}
        .graph-fn__input{font-family:var(--mono);font-size:13px;width:100%;background:var(--bg-elev);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text)}
        .graph-fn__input:focus{outline:none;border-color:var(--accent)}
        .graph-fn__row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
        .graph-fn__label-input{font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-elev);color:var(--text-dim);width:100px}
        .graph-center{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);display:flex;flex-direction:column;overflow:hidden;min-height:0;position:relative}
        .graph-canvas-wrap{flex:1;position:relative;overflow:hidden;background:var(--bg-inset);min-height:400px;touch-action:none;cursor:crosshair}
        .graph-canvas-wrap canvas{display:block;width:100%;height:100%}
        .graph-cursor-info{position:absolute;top:8px;left:8px;background:var(--bg-elev);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-family:var(--mono);font-size:11px;color:var(--text);pointer-events:none;box-shadow:var(--shadow);min-width:140px}
        .graph-cursor-info__near{margin-top:4px;padding-top:4px;border-top:1px solid var(--border);color:var(--text-dim)}
        .graph-right{background:var(--bg-elev);border:1px solid var(--border);border-radius:var(--radius);display:flex;flex-direction:column;overflow:hidden;min-height:0}
        .graph-right__header{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
        .graph-right__header h2{margin:0;font-size:14px}
        .graph-right__body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:14px}
        .graph-tool-tabs{display:flex;flex-wrap:wrap;gap:6px}
        .graph-tool-tab{padding:6px 10px;border-radius:999px;border:1px solid var(--border);background:var(--bg-inset);font-size:12px;cursor:pointer;color:var(--text-dim)}
        .graph-tool-tab.is-active{background:color-mix(in srgb, var(--accent) 18%, transparent);border-color:var(--accent);color:var(--text)}
        .graph-field{display:flex;flex-direction:column;gap:4px}
        .graph-field label{font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em}
        .graph-field input,.graph-field select{background:var(--bg-inset);border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-size:13px;color:var(--text);font-family:var(--mono)}
        .graph-analysis-result{background:var(--bg-inset);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:12px}
        .graph-analysis-result h4{margin:0 0 6px;font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em}
        .graph-table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:11px}
        .graph-table th,.graph-table td{padding:4px 8px;border-bottom:1px solid var(--border);text-align:right}
        .graph-table th{color:var(--text-dim);font-weight:600;position:sticky;top:0;background:var(--bg-inset)}
        .graph-table td:first-child,.graph-table th:first-child{text-align:left}
        .graph-footer{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:11px;color:var(--text-dim);padding:0 2px}
        .graph-fab{display:none}
        @media(max-width:1200px){.graph-workspace{grid-template-columns:300px 1fr;grid-template-rows:auto 1fr auto auto;height:auto;min-height:700px}.graph-right{grid-column:1/-1}}
        @media(max-width:760px){.graph-workspace{grid-template-columns:1fr;grid-template-rows:auto auto 1fr auto auto;height:auto}.graph-left{max-height:${showFuncDrawer ? '60vh' : '0'};overflow:${showFuncDrawer ? 'auto' : 'hidden'};border:${showFuncDrawer ? '1px solid var(--border)' : '0'}}.graph-fab{display:flex;position:fixed;bottom:90px;right:16px;z-index:10;flex-direction:column;gap:8px}.graph-fab button{width:48px;height:48px;border-radius:50%;background:var(--accent);color:#fff;border:none;box-shadow:var(--shadow);font-size:20px;display:flex;align-items:center;justify-content:center}}
      `}</style>

      <div className="graph-toolbar">
        <div className="graph-toolbar__group">
          <button className="btn btn--small" onClick={() => setShowFuncDrawer(v => !v)}>☰ Functions</button>
          <button className="btn btn--small" onClick={() => setShowAnalysis(v => !v)}>◧ Analysis</button>
          <button className="btn btn--small" onClick={() => setFullscreen(v => !v)}>{fullscreen ? '↙ Exit Fullscreen' : '⛶ Fullscreen'}</button>
        </div>
        <div className="graph-toolbar__sep" />
        <div className="graph-toolbar__group">
          <button className="btn btn--small" onClick={() => core.setViewport(v => zoomAt(v, 1.3, core.sizeRef.current.width / 2, core.sizeRef.current.height / 2, core.sizeRef.current))}>Zoom +</button>
          <button className="btn btn--small" onClick={() => core.setViewport(v => zoomAt(v, 1 / 1.3, core.sizeRef.current.width / 2, core.sizeRef.current.height / 2, core.sizeRef.current))}>Zoom −</button>
          <button className="btn btn--small" onClick={resetView}>Reset</button>
          <button className="btn btn--small" onClick={fitView}>Fit</button>
          <button className="btn btn--small" onClick={centerOrigin}>Center</button>
        </div>
        <div className="graph-toolbar__sep" />
        <div className="graph-toolbar__group">
          <label className="field field--check" style={{ margin: 0 }}><input type="checkbox" checked={core.graphSettings.showGrid} onChange={e => core.setGraphSettings(s => ({ ...s, showGrid: e.target.checked }))} /><span>Grid</span></label>
          <label className="field field--check" style={{ margin: 0 }}><input type="checkbox" checked={core.graphSettings.showAxes} onChange={e => core.setGraphSettings(s => ({ ...s, showAxes: e.target.checked }))} /><span>Axes</span></label>
          <label className="field field--check" style={{ margin: 0 }}><input type="checkbox" checked={core.graphSettings.showLabels} onChange={e => core.setGraphSettings(s => ({ ...s, showLabels: e.target.checked }))} /><span>Labels</span></label>
          <label className="field field--check" style={{ margin: 0 }}><input type="checkbox" checked={core.traceEnabled} onChange={e => core.setTraceEnabled(e.target.checked)} /><span>Trace</span></label>
        </div>
        <div className="graph-toolbar__sep" />
        <div className="graph-toolbar__group"><span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Drag pan • Wheel zoom • Pinch zoom • Hover coords</span></div>
      </div>

      {showFuncDrawer && (
        <FunctionList
          functions={core.functions}
          setFunctions={core.setFunctions}
          selectedId={core.selectedId}
          setSelectedId={core.setSelectedId}
          compiled={core.compiled}
        />
      )}

      <GraphCanvas
        viewport={core.viewport}
        setViewport={core.setViewport}
        graphSettings={core.graphSettings}
        sampled={core.sampled}
        compiled={core.compiled}
        analysis={core.analysis}
        analysisResults={core.analysisResults}
        selectedId={core.selectedId}
        selectedCompiled={core.selectedCompiled}
        cursor={core.cursor}
        setCursor={core.setCursor}
        traceEnabled={core.traceEnabled}
        traceX={core.traceX}
        setTraceX={core.setTraceX}
        sizeRef={core.sizeRef}
        precision={settings.precision}
        functions={core.functions}
        fullscreen={fullscreen}
      />

      {showAnalysis && (
        <AnalysisPanel
          functions={core.functions}
          selectedId={core.selectedId}
          setSelectedId={core.setSelectedId}
          analysis={core.analysis}
          setAnalysis={core.setAnalysis}
          analysisResults={core.analysisResults}
          selectedCompiled={core.selectedCompiled}
          viewport={core.viewport}
          sizeRef={core.sizeRef}
          precision={settings.precision}
          updateFunction={updateFunction}
        />
      )}

      <div className="graph-footer">
        <span>Professional Graphing • {core.functions.length} fn • {core.graphSettings.showGrid ? 'Grid ON' : 'Grid OFF'}</span>
        <span style={{ marginLeft: 'auto' }}>Safe parser • No dynamic code • Adaptive sampling • Discontinuity aware</span>
      </div>

      <div className="graph-fab">
        <button onClick={() => setShowFuncDrawer(v => !v)}>ƒ</button>
        <button onClick={() => setShowAnalysis(v => !v)}>◧</button>
        <button onClick={() => setFullscreen(v => !v)}>⛶</button>
      </div>
    </div>
  );
}

export default GraphPanel;
