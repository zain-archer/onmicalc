import { useCallback, useEffect, useRef } from 'react';
import { pan, zoomAt, screenToWorldX, screenToWorldY, worldToScreenX, worldToScreenY, type Viewport } from '@/graphing/viewport';
import { renderGrid, renderPolylines, renderParametric, renderImplicit, renderInequalityRegion, renderIntegralShade, renderPoint } from '@/graphing/renderer';
import { formatNumber } from '@/core/precision/format';
import type { Polyline } from '@/graphing/sampling';
import type { GraphFunction } from '@/graphing/types';

interface Props {
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  graphSettings: any;
  sampled: any[];
  compiled: any[];
  analysis: any;
  analysisResults: any;
  selectedId: string;
  selectedCompiled: any;
  cursor: { x: number; y: number; sx: number; sy: number; active: boolean };
  setCursor: (c: any) => void;
  traceEnabled: boolean;
  traceX: number | null;
  setTraceX: (x: number | null) => void;
  sizeRef: React.MutableRefObject<{ width: number; height: number }>;
  precision: number;
  functions: GraphFunction[];
  fullscreen: boolean;
}

export function GraphCanvas({
  viewport, setViewport, graphSettings, sampled, compiled, analysis, analysisResults,
  selectedId, selectedCompiled, cursor, setCursor, traceEnabled, traceX, setTraceX, sizeRef, precision, functions, fullscreen
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const updateSize = () => {
      try {
        const rect = container.getBoundingClientRect();
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        const w = Math.max(300, rect.width || 800);
        const h = Math.max(300, rect.height || 500);
        sizeRef.current = { width: w, height: h };
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        setViewport(v => ({ ...v }));
      } catch {
        // ignore in test env
      }
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    try {
      const ro = new ResizeObserver(updateSize);
      ro.observe(container);
      return () => ro.disconnect();
    } catch {
      return;
    }
  }, [fullscreen, setViewport, sizeRef]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Theme colors - read once per render from computed styles to avoid doc in engine
    let theme = { bgInset: '#0e1425', border: 'rgba(128,128,128,0.2)', textDim: '#a3adc9' };
    try {
      const cs = getComputedStyle(document.documentElement);
      theme = {
        bgInset: cs.getPropertyValue('--bg-inset') || theme.bgInset,
        border: cs.getPropertyValue('--border') || theme.border,
        textDim: cs.getPropertyValue('--text-dim') || theme.textDim,
      };
    } catch {}

    renderGrid(ctx, viewport, size, {
      showGrid: graphSettings.showGrid,
      showAxes: graphSettings.showAxes,
      showLabels: graphSettings.showLabels,
      showMinorGrid: graphSettings.showMinorGrid,
    }, theme);

    for (const s of sampled) {
      if (!s.func.visible) continue;
      if (s.error) continue;
      if (s.kind === 'cartesian' || s.kind === 'inequality') {
        if (s.kind === 'inequality' && (s as any).regions?.length) {
          renderInequalityRegion(ctx, (s as any).regions, viewport, size, s.func.color);
        }
        renderPolylines(ctx, (s as any).polylines, viewport, size, s.func.color, s.func.lineWidth, s.func.lineStyle);
        if (s.func.showDerivative && s.func.id === selectedId && analysisResults?.derivative) {
          renderPolylines(ctx, analysisResults.derivative, viewport, size, s.func.derivativeColor || '#fbbf24', 1.8, 'dashed', 0.9);
        }
      } else if (s.kind === 'parametric' || s.kind === 'polar') {
        renderParametric(ctx, (s as any).parametric, viewport, size, s.func.color, s.func.lineWidth, s.func.lineStyle);
      } else if (s.kind === 'implicit') {
        renderImplicit(ctx, (s as any).implicit, viewport, size, s.func.color, s.func.lineWidth);
      }
    }

    if (analysis.type === 'integral' && analysisResults?.integral) {
      const shadeColor = selectedCompiled?.func.color || '#6366f1';
      renderIntegralShade(ctx, analysisResults.integral.points, viewport, size, shadeColor, 0);
    }
    if (analysis.type === 'area' && analysisResults?.area && selectedCompiled && analysis.secondId) {
      const second = compiled.find((c: any) => c.func.id === analysis.secondId);
      if (second && (second as any).data) {
        const fn = (selectedCompiled.data as any).fn as (x: number) => number;
        const g = ((second as any).data as any).fn as (x: number) => number;
        const a = analysis.lowerBound!;
        const b = analysis.upperBound!;
        const steps = 100;
        const dx = (b - a) / steps;
        ctx.fillStyle = '#10b981';
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        let first = true;
        for (let i = 0; i <= steps; i++) {
          const x = a + i * dx;
          try {
            const y1 = fn(x);
            if (!Number.isFinite(y1)) continue;
            const sx = worldToScreenX(viewport, x, size);
            const sy = worldToScreenY(viewport, y1, size);
            if (first) { ctx.moveTo(sx, sy); first = false; } else ctx.lineTo(sx, sy);
          } catch {}
        }
        for (let i = steps; i >= 0; i--) {
          const x = a + i * dx;
          try {
            const y2 = g(x);
            if (!Number.isFinite(y2)) continue;
            const sx = worldToScreenX(viewport, x, size);
            const sy = worldToScreenY(viewport, y2, size);
            ctx.lineTo(sx, sy);
          } catch {}
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    if (analysisResults?.tangent) {
      const t = analysisResults.tangent;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(worldToScreenX(viewport, t.line.x1, size), worldToScreenY(viewport, t.line.y1, size));
      ctx.lineTo(worldToScreenX(viewport, t.line.x2, size), worldToScreenY(viewport, t.line.y2, size));
      ctx.stroke();
      ctx.setLineDash([]);
      renderPoint(ctx, t.x, t.y, viewport, size, '#fbbf24', 5);
    }
    if (analysisResults?.normal) {
      const n = analysisResults.normal;
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(worldToScreenX(viewport, n.line.x1, size), worldToScreenY(viewport, n.line.y1, size));
      ctx.lineTo(worldToScreenX(viewport, n.line.x2, size), worldToScreenY(viewport, n.line.y2, size));
      ctx.stroke();
      ctx.setLineDash([]);
      renderPoint(ctx, n.x, n.y, viewport, size, '#ec4899', 5);
    }

    if (analysisResults) {
      for (const r of analysisResults.roots) renderPoint(ctx, r, 0, viewport, size, '#4ade80', 4);
      for (const e of analysisResults.extrema) renderPoint(ctx, e.x, e.y, viewport, size, '#fbbf24', 4);
      for (const inter of analysisResults.intersections) renderPoint(ctx, inter.x, inter.y, viewport, size, '#fb7185', 4);
      for (const asy of analysisResults.asymptotes) {
        if (asy.type === 'vertical' && asy.x !== undefined) {
          ctx.strokeStyle = 'rgba(251, 113, 133, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          const sx = worldToScreenX(viewport, asy.x, size);
          ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, size.height); ctx.stroke(); ctx.setLineDash([]);
        } else if (asy.type === 'horizontal' && asy.y !== undefined) {
          ctx.strokeStyle = 'rgba(251, 113, 133, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          const sy = worldToScreenY(viewport, asy.y, size);
          ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(size.width, sy); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }

    if (analysis.type === 'evaluate' && analysis.xValue !== undefined && analysisResults?.evaluate?.valid) {
      renderPoint(ctx, analysis.xValue, analysisResults.evaluate.y, viewport, size, '#6366f1', 6);
    }

    if (traceEnabled && traceX !== null && selectedCompiled && selectedCompiled.kind === 'cartesian' && selectedCompiled.data) {
      try {
        const fn = (selectedCompiled.data as any).fn as (x: number) => number;
        const y = fn(traceX);
        if (Number.isFinite(y)) {
          renderPoint(ctx, traceX, y, viewport, size, selectedCompiled.func.color, 6);
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          const sx = worldToScreenX(viewport, traceX, size);
          const sy = worldToScreenY(viewport, y, size);
          ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, size.height); ctx.moveTo(0, sy); ctx.lineTo(size.width, sy); ctx.stroke(); ctx.setLineDash([]);
        }
      } catch {}
    }

    if (cursor.active && !traceEnabled) {
      ctx.strokeStyle = 'rgba(128,128,128,0.35)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(cursor.sx, 0); ctx.lineTo(cursor.sx, size.height); ctx.moveTo(0, cursor.sy); ctx.lineTo(size.width, cursor.sy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cursor.sx, cursor.sy, 2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }, [viewport, sampled, graphSettings, cursor, traceEnabled, traceX, analysis, analysisResults, selectedCompiled, selectedId, compiled, sizeRef]);

  useEffect(() => { render(); }, [render]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setViewport(v => zoomAt(v, factor, px, py, sizeRef.current));
  }, [setViewport, sizeRef]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const wx = screenToWorldX(viewport, px, sizeRef.current);
    const wy = screenToWorldY(viewport, py, sizeRef.current);
    setCursor({ x: wx, y: wy, sx: px, sy: py, active: true });
    if (traceEnabled) setTraceX(wx);
    if (dragging.current) {
      const dx = e.clientX - dragging.current.x;
      const dy = e.clientY - dragging.current.y;
      dragging.current = { x: e.clientX, y: e.clientY };
      setViewport(v => pan(v, dx, dy));
    }
  }, [viewport, traceEnabled, setCursor, setTraceX, setViewport, sizeRef]);
  const onPointerUp = useCallback(() => { dragging.current = null; }, []);
  const onPointerLeave = useCallback(() => { dragging.current = null; setCursor((c: any) => ({ ...c, active: false })); }, [setCursor]);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
    }
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDist.current !== null) {
      const dx = e.touches[0]!.clientX - e.touches[1]!.clientX;
      const dy = e.touches[0]!.clientY - e.touches[1]!.clientY;
      const dist = Math.hypot(dx, dy);
      const factor = dist / lastPinchDist.current;
      if (Number.isFinite(factor) && factor > 0.5 && factor < 2) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const midX = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 - rect.left;
          const midY = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 - rect.top;
          setViewport(v => zoomAt(v, factor, midX, midY, sizeRef.current));
        }
      }
      lastPinchDist.current = dist;
      e.preventDefault();
    } else if (e.touches.length === 1) {
      const touch = e.touches[0]!;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = touch.clientX - rect.left;
      const py = touch.clientY - rect.top;
      const wx = screenToWorldX(viewport, px, sizeRef.current);
      const wy = screenToWorldY(viewport, py, sizeRef.current);
      setCursor({ x: wx, y: wy, sx: px, sy: py, active: true });
      if (traceEnabled) setTraceX(wx);
      if (dragging.current) {
        const dx = touch.clientX - dragging.current.x;
        const dy = touch.clientY - dragging.current.y;
        dragging.current = { x: touch.clientX, y: touch.clientY };
        setViewport(v => pan(v, dx, dy));
      } else {
        dragging.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, [viewport, traceEnabled, setCursor, setTraceX, setViewport, sizeRef]);
  const onTouchEnd = useCallback(() => { lastPinchDist.current = null; dragging.current = null; }, []);

  const nf = (v: number) => formatNumber(v, { precision });
  const cursorInfo = (() => {
    if (!cursor.active) return null;
    const nearby: Array<{ id: string; x: number; y: number; dist: number; label: string }> = [];
    for (const s of sampled) {
      if (!s.func.visible || s.error) continue;
      if (s.kind === 'cartesian' && (s as any).polylines) {
        const polylines = (s as any).polylines as Polyline[];
        let best: { x: number; y: number; dist: number } | null = null;
        for (const line of polylines) {
          for (const p of line.points) {
            const sx = worldToScreenX(viewport, p.x, sizeRef.current);
            const sy = worldToScreenY(viewport, p.y, sizeRef.current);
            const d = Math.hypot(sx - cursor.sx, sy - cursor.sy);
            if (d < 40 && (!best || d < best.dist)) best = { x: p.x, y: p.y, dist: d };
          }
        }
        if (best) nearby.push({ id: s.func.id, x: best.x, y: best.y, dist: best.dist, label: s.func.label || s.func.expression });
      }
    }
    nearby.sort((a, b) => a.dist - b.dist);
    return nearby.slice(0, 3);
  })();

  return (
    <div className="graph-center">
      <div
        className="graph-canvas-wrap"
        ref={containerRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <canvas ref={canvasRef} />
        {cursor.active && (
          <div className="graph-cursor-info">
            <div>X = {nf(cursor.x)}</div>
            <div>Y = {nf(cursor.y)}</div>
            {traceEnabled && traceX !== null && selectedCompiled && (
              <div>
                {(() => {
                  try {
                    const fn = (selectedCompiled.data as any)?.fn;
                    if (!fn) return null;
                    const y = fn(traceX);
                    if (!Number.isFinite(y)) return null;
                    return <div>f({nf(traceX)}) = {nf(y)}</div>;
                  } catch { return null; }
                })()}
              </div>
            )}
            {cursorInfo && cursorInfo.length > 0 && (
              <div className="graph-cursor-info__near">
                {cursorInfo.map(n => (
                  <div key={n.id} style={{ color: functions.find(f => f.id === n.id)?.color }}>
                    {n.label}: ({nf(n.x)}, {nf(n.y)})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
