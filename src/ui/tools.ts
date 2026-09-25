/**
 * Single source of truth for navigation and tool metadata.
 * `status: 'planned'` entries are not reachable in the UI until implemented,
 * so the app never shows a button that does nothing.
 */
export type ToolStatus = 'ready' | 'planned';

export interface ToolDef {
  id: string;
  label: string;
  group: ToolGroup;
  /** Inline SVG path data (24x24 viewBox) used by the shell icons. */
  icon: string;
  status: ToolStatus;
  /** Phase that delivers the tool; shown in the roadmap panel. */
  phase: number;
  summary: string;
}

export type ToolGroup = 'Calculate' | 'Analyse' | 'Convert' | 'Applied' | 'System';

export const TOOL_GROUPS: readonly ToolGroup[] = [
  'Calculate',
  'Analyse',
  'Convert',
  'Applied',
  'System',
];

export const TOOLS: readonly ToolDef[] = [
  {
    id: 'ask',
    label: 'Ask OmniCalc',
    group: 'Calculate',
    icon: 'M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3 4h10v2H7V8Zm0 4h6v2H7v-2Z',
    status: 'ready',
    phase: 29,
    summary: 'Type what you want in your own words — OmniCalc picks the right tool and fills it in.',
  },
  {
    id: 'calculator',
    label: 'Calculator',
    group: 'Calculate',
    icon: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 3h8v3H8V6Z',
    status: 'ready',
    phase: 3,
    summary: 'Basic and scientific keypad with safe expression parsing.',
  },
  {
    id: 'fractions',
    label: 'Fractions',
    group: 'Calculate',
    icon: 'M6 5h12m-12 14h12M9 5v14m6-14v14',
    status: 'ready',
    phase: 7,
    summary: 'Exact fraction arithmetic, simplification and decimal conversion.',
  },
  {
    id: 'complex',
    label: 'Complex Numbers',
    group: 'Calculate',
    icon: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 0v8m0 0 6 4',
    status: 'ready',
    phase: 8,
    summary: 'Rectangular and polar form, arithmetic, powers, roots and functions.',
  },
  {
    id: 'graph',
    label: 'Graphing',
    group: 'Analyse',
    icon: 'M3 20h18M6 4v14m-3-3 4-6 4 3 5-8',
    status: 'ready',
    phase: 13,
    summary: 'Plot multiple functions with zoom, roots and intersections.',
  },
  {
    id: 'matrix',
    label: 'Matrices & Vectors',
    group: 'Analyse',
    icon: 'M4 4h6v6H4V4Zm10 10h6v6h-6v-6ZM4 14h6v6H4v-6Zm10-10h6v6h-6V4Z',
    status: 'ready',
    phase: 9,
    summary: 'Determinants, inverses, RREF, eigenvalues and vector algebra.',
  },
  {
    id: 'statistics',
    label: 'Statistics',
    group: 'Analyse',
    icon: 'M4 20V9m6 11V4m6 16v-7M2 20h20',
    status: 'ready',
    phase: 11,
    summary: 'Descriptive statistics, regression and distributions.',
  },
  {
    id: 'equation',
    label: 'Equation Solver',
    group: 'Analyse',
    icon: 'M8 4H4m4 16H4m0-8h16M15 4h5m-5 16h5',
    status: 'ready',
    phase: 10,
    summary: 'Linear, quadratic, polynomial and linear systems with steps.',
  },
  {
    id: 'probability',
    label: 'Probability',
    group: 'Analyse',
    icon: 'M5 19V5m0 14h14M8 16l3-4 3 2 4-6',
    status: 'ready',
    phase: 12,
    summary: 'Normal, binomial, Poisson, uniform, exponential and t distributions.',
  },
  {
    id: 'calculus',
    label: 'Calculus',
    group: 'Analyse',
    icon: 'M20 18c-6 0-4-12-10-12M3 6h4m10 12h4',
    status: 'ready',
    phase: 14,
    summary: 'Derivatives, integrals, limits with verified accuracy.',
  },
  {
    id: 'conversions',
    label: 'Unit Converter',
    group: 'Convert',
    icon: 'M4 8h13l-3-3m3 11H4l3 3',
    status: 'ready',
    phase: 6,
    summary: 'Length, mass, temperature, data, energy and more.',
  },
  {
    id: 'constants',
    label: 'Constants',
    group: 'Convert',
    icon: 'M12 3l2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.1l5.9-.8L12 3Z',
    status: 'ready',
    phase: 5,
    summary: 'Searchable mathematical and physical constants with sources.',
  },
  {
    id: 'numbersystems',
    label: 'Number Systems',
    group: 'Convert',
    icon: 'M7 8h10M7 16h10M9 4 6 20m9-16-3 16',
    status: 'ready',
    phase: 15,
    summary: 'Binary, octal, hex and bitwise programmer operations.',
  },
  {
    id: 'engineering',
    label: 'Engineering',
    group: 'Applied',
    icon: 'M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3 8.4 8.4m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1M8.4 15.6l-2.1 2.1',
    status: 'ready',
    phase: 16,
    summary: 'Electrical, physics and geometry calculators.',
  },
  {
    id: 'finance',
    label: 'Finance & Everyday',
    group: 'Applied',
    icon: 'M3 7h18v10H3V7Zm0 4h18M7 15h3',
    status: 'ready',
    phase: 17,
    summary: 'Interest, EMI, loans, tips, dates and bill splitting.',
  },
  {
    id: 'programmer',
    label: 'Programmer',
    group: 'Convert',
    icon: 'M9 6 4 12l5 6m6-12 5 6-5 6M13 4l-3 16',
    status: 'ready',
    phase: 18,
    summary: 'Fixed-width integer arithmetic, bitwise logic and base display.',
  },
  {
    id: 'history',
    label: 'History & Memory',
    group: 'System',
    icon: 'M12 7v5l3 2m6-2a9 9 0 1 1-3.6-7.2M21 3v5h-5',
    status: 'ready',
    phase: 4,
    summary: 'Searchable history, favourites and memory slots.',
  },
  {
    id: 'settings',
    label: 'Settings',
    group: 'System',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3 2 1.5-2 3.5-2.4-1a7.5 7.5 0 0 1-1.6 1l-.3 2.5h-4l-.3-2.5a7.5 7.5 0 0 1-1.6-1L5 16 3 12.5 5 11a7.5 7.5 0 0 1 0-2L3 7.5 5 4l2.4 1a7.5 7.5 0 0 1 1.6-1L9.3 1.5h4l.3 2.5a7.5 7.5 0 0 1 1.6 1L17.6 4 20 7.5 18 9a7.5 7.5 0 0 1 0 2Z',
    status: 'ready',
    phase: 3,
    summary: 'Theme, precision, angle mode and data controls.',
  },
  {
    id: 'about',
    label: 'About & Roadmap',
    group: 'System',
    icon: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    status: 'ready',
    phase: 28,
    summary: 'Project status, build information and privacy statement.',
  },
];

export const READY_TOOLS = TOOLS.filter((tool) => tool.status === 'ready');

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((tool) => tool.id === id);
}

/** Default route used when the URL hash is empty or unknown. */
export function defaultRoute(): string {
  return READY_TOOLS[0]?.id ?? 'about';
}
