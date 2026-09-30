/**
 * Professional graphing types – supports Cartesian, Parametric, Polar, Implicit, Inequality
 */

export type GraphType = 'cartesian' | 'parametric' | 'polar' | 'implicit' | 'inequality';

export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface Domain {
  min: number;
  max: number;
}

export interface GraphFunction {
  id: string;
  type: GraphType;
  /** For cartesian: y = expr(x). For inequality: y op expr(x). For polar: r = expr(theta). */
  expression: string;
  /** For parametric: x(t) */
  xExpression?: string;
  /** For parametric: y(t) */
  yExpression?: string;
  visible: boolean;
  color: string;
  lineWidth: number;
  lineStyle: LineStyle;
  label: string;
  domain: Domain | null; // null = auto from viewport
  /** For parametric/polar t/theta range */
  paramDomain: Domain | null;
  /** For inequality: shading */
  inequalityOp?: '>' | '<' | '>=' | '<=' | '=' | '!=';
  showDerivative?: boolean;
  derivativeColor?: string;
}

export interface GraphViewport {
  centerX: number;
  centerY: number;
  scaleX: number;
  scaleY: number;
}

export interface GraphSettings {
  showGrid: boolean;
  showAxes: boolean;
  showLabels: boolean;
  showMinorGrid: boolean;
  lockAspect: boolean;
  backgroundColor?: string;
}

export interface CursorState {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  active: boolean;
  nearFunctions: Array<{ id: string; x: number; y: number; dist: number }>;
}

export interface AnalysisTool {
  type: 'none' | 'trace' | 'root' | 'intersection' | 'minmax' | 'derivative' | 'integral' | 'tangent' | 'normal' | 'area' | 'evaluate' | 'table';
  selectedId?: string;
  secondId?: string;
  xValue?: number;
  lowerBound?: number;
  upperBound?: number;
  tableStart?: number;
  tableEnd?: number;
  tableStep?: number;
}

export interface GraphState {
  functions: GraphFunction[];
  viewport: GraphViewport;
  settings: GraphSettings;
  analysis: AnalysisTool;
}

export const DEFAULT_COLORS = [
  '#6366f1', '#f97316', '#10b981', '#ec4899', '#0ea5e9', '#eab308',
  '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f59e0b', '#a855f7'
];

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  showGrid: true,
  showAxes: true,
  showLabels: true,
  showMinorGrid: true,
  lockAspect: false,
};

export function createDefaultFunction(id: string, index: number, type: GraphType = 'cartesian'): GraphFunction {
  return {
    id,
    type,
    expression: type === 'cartesian' ? 'x^2' : type === 'polar' ? 'sin(3*theta)' : type === 'implicit' ? 'x^2 + y^2 - 25' : type === 'parametric' ? 'cos(t)' : 'x^2',
    xExpression: type === 'parametric' ? 'cos(t)' : undefined,
    yExpression: type === 'parametric' ? 'sin(t)' : undefined,
    visible: true,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length]!,
    lineWidth: 2,
    lineStyle: 'solid',
    label: '',
    domain: null,
    paramDomain: type === 'parametric' ? { min: -6.283185307179586, max: 6.283185307179586 } : type === 'polar' ? { min: 0, max: 6.283185307179586 * 2 } : null,
    inequalityOp: type === 'inequality' ? '>' : undefined,
    showDerivative: false,
  };
}
