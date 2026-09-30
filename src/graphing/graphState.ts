import { createStore } from '@/storage/store';
import { DEFAULT_VIEWPORT, type Viewport } from './viewport';
import { DEFAULT_GRAPH_SETTINGS, type GraphFunction, type GraphSettings, type AnalysisTool, DEFAULT_COLORS } from './types';

export interface PersistedGraphState {
  functions: GraphFunction[];
  viewport: Viewport;
  settings: GraphSettings;
  analysis: AnalysisTool;
}

const DEFAULT_ANALYSIS: AnalysisTool = {
  type: 'none',
  tableStart: -5,
  tableEnd: 5,
  tableStep: 1,
  lowerBound: -2,
  upperBound: 2,
  xValue: 1,
};

const INITIAL_FUNCTIONS: GraphFunction[] = [
  {
    id: 'f1',
    type: 'cartesian',
    expression: 'x^2',
    visible: true,
    color: DEFAULT_COLORS[0]!,
    lineWidth: 2.2,
    lineStyle: 'solid',
    label: 'Parabola',
    domain: null,
    paramDomain: null,
    showDerivative: false,
  },
  {
    id: 'f2',
    type: 'cartesian',
    expression: 'sin(x)*3',
    visible: true,
    color: DEFAULT_COLORS[1]!,
    lineWidth: 2,
    lineStyle: 'solid',
    label: '',
    domain: null,
    paramDomain: null,
    showDerivative: false,
  },
];

const DEFAULT_STATE: PersistedGraphState = {
  functions: INITIAL_FUNCTIONS,
  viewport: DEFAULT_VIEWPORT,
  settings: DEFAULT_GRAPH_SETTINGS,
  analysis: DEFAULT_ANALYSIS,
};

const STORAGE_KEY = 'omnica.graph.v2';

export const graphStore = createStore<PersistedGraphState>(STORAGE_KEY, DEFAULT_STATE);

export function loadGraphState(): PersistedGraphState {
  try {
    const stored = graphStore.get();
    // Validate basic shape
    if (!stored.functions || !Array.isArray(stored.functions) || stored.functions.length === 0) {
      return DEFAULT_STATE;
    }
    return {
      functions: stored.functions.map((f, i) => ({
        ...f,
        id: f.id || `f${i + 1}`,
        type: (f.type as any) || 'cartesian',
        color: f.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]!,
        lineWidth: f.lineWidth ?? 2,
        lineStyle: (f.lineStyle as any) || 'solid',
        visible: f.visible ?? true,
        label: f.label || '',
        domain: f.domain || null,
        paramDomain: f.paramDomain || null,
      })),
      viewport: stored.viewport || DEFAULT_VIEWPORT,
      settings: { ...DEFAULT_GRAPH_SETTINGS, ...(stored.settings || {}) },
      analysis: { ...DEFAULT_ANALYSIS, ...(stored.analysis || {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveGraphState(state: Partial<PersistedGraphState>) {
  graphStore.set(state);
}
