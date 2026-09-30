import { useEffect, useMemo, useRef, useState } from 'react';
import { visibleBounds, type Viewport } from '@/graphing/viewport';
import { findRoots, findExtrema, findIntersections } from '@/graphing/analysis';
import {
  sampleCartesian,
  sampleParametric,
  samplePolar,
  sampleImplicit,
  tryCompileCartesian,
  tryCompileParametric,
  tryCompilePolar,
  tryCompileImplicit,
  tryCompileInequality,
  type ParametricPolyline,
} from '@/graphing/extendedSampling';
import {
  generateTable,
  evaluateAt,
  sampleDerivative,
  computeIntegral,
  computeTangent,
  computeNormal,
  detectAsymptotes,
  areaBetweenCurves,
} from '@/graphing/analysisExtended';
import { loadGraphState, saveGraphState } from '@/graphing/graphState';
import type { GraphFunction, AnalysisTool } from '@/graphing/types';
import type { Polyline } from '@/graphing/sampling';
import type { Segment2D } from '@/graphing/implicit';

function useDebouncedValue<T>(value: T, delay = 120): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useGraphCore() {
  const persisted = useMemo(() => loadGraphState(), []);
  const [functions, setFunctions] = useState<GraphFunction[]>(persisted.functions);
  const [viewport, setViewport] = useState<Viewport>(persisted.viewport);
  const [graphSettings, setGraphSettings] = useState(persisted.settings);
  const [analysis, setAnalysis] = useState<AnalysisTool>(persisted.analysis);
  const [selectedId, setSelectedId] = useState<string>(persisted.functions[0]?.id || 'f1');
  const [cursor, setCursor] = useState<{ x: number; y: number; sx: number; sy: number; active: boolean }>({ x: 0, y: 0, sx: 0, sy: 0, active: false });
  const [traceEnabled, setTraceEnabled] = useState(false);
  const [traceX, setTraceX] = useState<number | null>(null);

  const sizeRef = useRef({ width: 800, height: 500 });
  const debouncedFunctions = useDebouncedValue(functions, 140);
  const debouncedViewport = useDebouncedValue(viewport, 30);

  useEffect(() => {
    saveGraphState({ functions, viewport, settings: graphSettings, analysis });
  }, [functions, viewport, graphSettings, analysis]);

  const compiled = useMemo(() => {
    return debouncedFunctions.map(f => {
      if (!f.visible || (!f.expression.trim() && f.type === 'cartesian')) {
        return { func: f, kind: 'none' as const, error: null, data: null };
      }
      try {
        if (f.type === 'cartesian') {
          const fn = tryCompileCartesian(f.expression);
          if (!fn) return { func: f, kind: 'cartesian' as const, error: 'Invalid expression', data: null };
          return { func: f, kind: 'cartesian' as const, error: null, data: { fn } };
        } else if (f.type === 'parametric') {
          const res = tryCompileParametric(f.xExpression || 'cos(t)', f.yExpression || 'sin(t)');
          if (!res) return { func: f, kind: 'parametric' as const, error: 'Invalid parametric', data: null };
          return { func: f, kind: 'parametric' as const, error: null, data: res };
        } else if (f.type === 'polar') {
          const rFn = tryCompilePolar(f.expression);
          if (!rFn) return { func: f, kind: 'polar' as const, error: 'Invalid polar', data: null };
          return { func: f, kind: 'polar' as const, error: null, data: { rFn } };
        } else if (f.type === 'implicit') {
          const impl = tryCompileImplicit(f.expression);
          if (!impl) return { func: f, kind: 'implicit' as const, error: 'Invalid implicit', data: null };
          return { func: f, kind: 'implicit' as const, error: null, data: { fn: impl } };
        } else if (f.type === 'inequality') {
          const ineq = tryCompileInequality(f.expression);
          const fallback = tryCompileCartesian(f.expression.replace(/[<>=!]+.*/, '').trim() || f.expression);
          if (ineq) return { func: f, kind: 'inequality' as const, error: null, data: { fn: ineq.fn, op: ineq.op } };
          if (fallback) return { func: f, kind: 'inequality' as const, error: null, data: { fn: fallback, op: '>' as const } };
          return { func: f, kind: 'inequality' as const, error: 'Invalid inequality', data: null };
        }
      } catch (e) {
        return { func: f, kind: f.type as any, error: e instanceof Error ? e.message : String(e), data: null };
      }
      return { func: f, kind: 'none' as const, error: null, data: null };
    });
  }, [debouncedFunctions]);

  const sampled = useMemo(() => {
    const size = sizeRef.current;
    const bounds = visibleBounds(debouncedViewport, size);
    return compiled.map(c => {
      const base = { func: c.func, kind: c.kind, error: c.error, data: c.data } as const;
      if (c.error || !c.data) return { ...base, polylines: [] as Polyline[], parametric: [] as ParametricPolyline[], implicit: [] as Segment2D[], regions: [] as any[] };
      try {
        if (c.kind === 'cartesian') {
          const polylines = sampleCartesian((c.data as any).fn, debouncedViewport, size, { domain: c.func.domain, density: 1.4 });
          return { ...base, polylines, parametric: [] as ParametricPolyline[], implicit: [] as Segment2D[], regions: [] as any[] };
        } else if (c.kind === 'parametric') {
          const paramDomain = c.func.paramDomain || { min: -10, max: 10 };
          const parametric = sampleParametric((c.data as any).fx, (c.data as any).fy, debouncedViewport, size, { paramDomain, density: 1.6 });
          return { ...base, polylines: [] as Polyline[], parametric, implicit: [] as Segment2D[], regions: [] as any[] };
        } else if (c.kind === 'polar') {
          const paramDomain = c.func.paramDomain || { min: 0, max: Math.PI * 2 * 2 };
          const parametric = samplePolar((c.data as any).rFn, debouncedViewport, size, { paramDomain, density: 2 });
          return { ...base, polylines: [] as Polyline[], parametric, implicit: [] as Segment2D[], regions: [] as any[] };
        } else if (c.kind === 'implicit') {
          const implicit = sampleImplicit((c.data as any).fn, debouncedViewport, size, { domain: c.func.domain });
          return { ...base, polylines: [] as Polyline[], parametric: [] as ParametricPolyline[], implicit, regions: [] as any[] };
        } else if (c.kind === 'inequality') {
          const fn = (c.data as any).fn;
          const op = (c.data as any).op;
          const polylines = sampleCartesian(fn, debouncedViewport, size, { domain: c.func.domain, density: 1.2 });
          const regions: { x: number; y1: number; y2: number }[] = [];
          const minX = c.func.domain?.min ?? bounds.minX;
          const maxX = c.func.domain?.max ?? bounds.maxX;
          const steps = Math.round(size.width * 1.1);
          const dx = (maxX - minX) / steps;
          for (let i = 0; i <= steps; i++) {
            const x = minX + i * dx;
            try {
              const y = fn(x);
              if (!Number.isFinite(y)) continue;
              if (op === '>' || op === '>=') regions.push({ x, y1: y, y2: bounds.maxY });
              else regions.push({ x, y1: bounds.minY, y2: y });
            } catch {}
          }
          return { ...base, polylines, parametric: [] as ParametricPolyline[], implicit: [] as Segment2D[], regions };
        }
      } catch {
        return { ...base, polylines: [] as Polyline[], parametric: [] as ParametricPolyline[], implicit: [] as Segment2D[], regions: [] as any[] };
      }
      return { ...base, polylines: [] as Polyline[], parametric: [] as ParametricPolyline[], implicit: [] as Segment2D[], regions: [] as any[] };
    });
  }, [compiled, debouncedViewport]);

  const selectedCompiled = useMemo(() => {
    return compiled.find(c => c.func.id === selectedId) || compiled[0] || null;
  }, [compiled, selectedId]);

  const analysisResults = useMemo(() => {
    if (!selectedCompiled || selectedCompiled.error || !selectedCompiled.data) return null;
    const size = sizeRef.current;
    const bounds = visibleBounds(debouncedViewport, size);
    const minX = selectedCompiled.func.domain?.min ?? bounds.minX;
    const maxX = selectedCompiled.func.domain?.max ?? bounds.maxX;
    try {
      if (selectedCompiled.kind !== 'cartesian' && selectedCompiled.kind !== 'inequality') {
        return { roots: [], extrema: [], intersections: [], asymptotes: [], derivative: null, tangent: null, normal: null, integral: null, area: null, evaluate: null, table: [] };
      }
      const fn = (selectedCompiled.data as any).fn as (x: number) => number;
      const roots = analysis.type === 'root' || analysis.type === 'none' ? findRoots(fn, minX, maxX) : [];
      const extrema = analysis.type === 'minmax' || analysis.type === 'none' ? findExtrema(fn, minX, maxX) : [];
      const otherFns = compiled.filter(c => c.func.id !== selectedId && c.kind === 'cartesian' && c.data && !c.error).map(c => (c.data as any).fn as (x: number) => number);
      const intersections = analysis.type === 'intersection' ? otherFns.flatMap(ofn => findIntersections(fn, ofn, minX, maxX)) : [];
      const asymptotes = detectAsymptotes(fn, minX, maxX);
      let derivativePolys: Polyline[] | null = null;
      if (analysis.type === 'derivative' || selectedCompiled.func.showDerivative) {
        derivativePolys = sampleDerivative(fn, debouncedViewport, size, selectedCompiled.func.domain);
      }
      let tangent = null;
      let normal = null;
      if ((analysis.type === 'tangent' || analysis.type === 'normal') && analysis.xValue !== undefined) {
        try {
          const hw = (maxX - minX) / 8;
          if (analysis.type === 'tangent') tangent = computeTangent(fn, analysis.xValue, hw);
          else normal = computeNormal(fn, analysis.xValue, hw);
        } catch {}
      }
      let integral = null;
      let area = null;
      if (analysis.type === 'integral' && analysis.lowerBound !== undefined && analysis.upperBound !== undefined) {
        try { integral = computeIntegral(fn, analysis.lowerBound, analysis.upperBound); } catch {}
      }
      if (analysis.type === 'area' && analysis.lowerBound !== undefined && analysis.upperBound !== undefined && analysis.secondId) {
        const second = compiled.find(c => c.func.id === analysis.secondId);
        if (second && second.data) {
          try {
            const g = (second.data as any).fn as (x: number) => number;
            area = areaBetweenCurves(fn, g, analysis.lowerBound, analysis.upperBound);
          } catch {}
        }
      }
      let evaluate = null;
      if (analysis.type === 'evaluate' && analysis.xValue !== undefined) {
        evaluate = evaluateAt(fn, analysis.xValue);
      }
      let table: ReturnType<typeof generateTable> = [];
      if (analysis.type === 'table') {
        table = generateTable(fn, analysis.tableStart ?? -5, analysis.tableEnd ?? 5, analysis.tableStep ?? 1);
      }
      return { roots, extrema, intersections, asymptotes, derivative: derivativePolys, tangent, normal, integral, area, evaluate, table };
    } catch {
      return null;
    }
  }, [selectedCompiled, debouncedViewport, analysis, compiled, selectedId]);

  return {
    functions, setFunctions,
    viewport, setViewport,
    graphSettings, setGraphSettings,
    analysis, setAnalysis,
    selectedId, setSelectedId,
    cursor, setCursor,
    traceEnabled, setTraceEnabled,
    traceX, setTraceX,
    sizeRef,
    compiled,
    sampled,
    selectedCompiled,
    analysisResults,
    debouncedViewport,
  };
}
