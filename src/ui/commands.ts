import { READY_TOOLS } from '@/ui/tools';
import { constantRecords } from '@/constants';
import { CATEGORIES as UNIT_CATEGORIES } from '@/conversions/definitions';
import { allEntries } from '@/knowledge';

/**
 * Command palette model. Commands are plain data plus a handler id so that the
 * palette stays a thin view and the behaviour is unit-testable without a DOM.
 */

export type CommandKind = 'navigate' | 'action';

export interface CommandHandlers {
  navigate: (toolId: string) => void;
  toggleTheme: () => void;
  setAngleMode: (mode: 'DEG' | 'RAD' | 'GRAD') => void;
  clearDraft: () => void;
  copyResult: () => void;
  openShortcuts: () => void;
  exportData?: () => void;
  importData?: () => void;
  setDraft?: (text: string) => void;
}

export type CommandGroup = 'Tools' | 'Appearance' | 'Angle mode' | 'Calculator' | 'Data' | 'Help' | 'Ask OmniCalc' | 'Constants' | 'Units' | 'History' | 'Settings' | 'Knowledge' | 'Formulas';

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  hint?: string;
  keywords: string[];
  kind: CommandKind;
  run: () => void;
}

const TOOL_KEYWORDS: Record<string, string[]> = {
  home: ['home', 'dashboard', 'recent', 'favorites', 'start'],
  tools: ['all tools', 'discover', 'catalog'],
  ask: ['ask', 'plain english', 'natural language', 'what do you want', 'intent', 'help me', 'do this'],
  calculator: ['keypad', 'calculate', 'expression', 'basic', 'scientific'],
  fractions: ['rational', 'mixed', 'numerator', 'denominator'],
  complex: ['imaginary', 'polar', 'i'],
  graph: ['plot', 'chart', 'function', 'zoom', 'trace'],
  graph3d: ['3d', 'surface', 'mesh', 'contour', 'vector field'],
  calculus: ['derivative', 'integral', 'limit', 'taylor'],
  matrix: ['vector', 'determinant', 'inverse', 'eigenvalue', 'rref'],
  equation: ['solve', 'roots', 'system', 'quadratic'],
  statistics: ['mean', 'median', 'regression', 'variance'],
  probability: ['distribution', 'normal', 'binomial', 'poisson'],
  constants: ['physical', 'codata', 'pi', 'planck', 'gravitational', 'boltzmann'],
  conversions: ['units', 'length', 'mass', 'temperature', 'convert'],
  numbersystems: ['binary', 'hex', 'octal', 'base', 'bitwise'],
  programmer: ['bits', 'integer', 'register', 'shift', 'bin', 'hex'],
  engineering: ['ohm', 'resistor', 'physics', 'geometry'],
  physics: ['formula', 'suvat', 'projectile', 'gravity', 'force', 'energy', 'momentum', 'optics', 'thermodynamics'],
  chemistry: ['molar mass', 'atom', 'element', 'periodic table', 'mole', 'ph', 'solution', 'molarity', 'stoichiometry'],
  finance: ['loan', 'interest', 'emi', 'tip', 'date', 'currency'],
  history: ['memory', 'past', 'favourites'],
  settings: ['theme', 'precision', 'angle', 'storage', 'appearance', 'accessibility', 'keyboard', 'performance'],
  about: ['roadmap', 'version', 'licence', 'privacy'],
};

const SETTINGS_COMMANDS: { id: string; label: string; keywords: string[] }[] = [
  { id: 'appearance', label: 'Settings: Appearance', keywords: ['theme', 'dark', 'light', 'palette', 'accent'] },
  { id: 'calculator', label: 'Settings: Calculator', keywords: ['angle', 'precision', 'degrees', 'radians'] },
  { id: 'graphing', label: 'Settings: Graphing', keywords: ['graph', 'grid', 'axes', 'quality'] },
  { id: 'threeD', label: 'Settings: 3D & Fields', keywords: ['3d', 'fps', 'quality'] },
  { id: 'programmer', label: 'Settings: Programmer', keywords: ['binary', 'hex', 'bit width'] },
  { id: 'finance', label: 'Settings: Finance', keywords: ['currency', 'interest'] },
  { id: 'accessibility', label: 'Settings: Accessibility', keywords: ['contrast', 'motion', 'screen reader'] },
  { id: 'keyboard', label: 'Settings: Keyboard', keywords: ['shortcuts', 'keys'] },
  { id: 'performance', label: 'Settings: Performance', keywords: ['performance', 'fps', 'balanced'] },
  { id: 'data', label: 'Settings: Data / Backup', keywords: ['backup', 'export', 'import'] },
];

/** Builds the full command list from the tool registry plus app actions. */
export function createCommands(handlers: CommandHandlers): Command[] {
  const tools: Command[] = READY_TOOLS.map((tool) => ({
    id: `tool.${tool.id}`,
    label: tool.label,
    group: 'Tools' as const,
    hint: tool.summary,
    keywords: [tool.id, tool.group, ...(TOOL_KEYWORDS[tool.id] ?? [])],
    kind: 'navigate' as const,
    run: () => handlers.navigate(tool.id),
  }));

  const settingsCmds: Command[] = SETTINGS_COMMANDS.map(s => ({
    id: `settings.${s.id}`,
    label: s.label,
    group: 'Settings' as const,
    keywords: s.keywords,
    kind: 'action' as const,
    run: () => handlers.navigate('settings'),
    hint: 'Open Settings',
  }));

  // Constants — top 30 most used to avoid flooding
  const constants: Command[] = constantRecords(9).slice(0, 80).map(rec => ({
    id: `const.${rec.name}`,
    label: `${rec.symbol} ${rec.name}`,
    group: 'Constants' as const,
    hint: `${rec.display} ${rec.unit} — ${rec.description}`,
    keywords: [rec.name, rec.symbol, ...(rec.aliases ?? []), rec.description, rec.category],
    kind: 'action' as const,
    run: () => {
      const name = rec.name.toLowerCase();
      handlers.setDraft?.(name);
      handlers.navigate('calculator');
    },
  }));

  // Units
  const units: Command[] = UNIT_CATEGORIES.flatMap(cat =>
    cat.units.slice(0, 12).map(u => ({
      id: `unit.${cat.id}.${u.id}`,
      label: `${u.label} (${u.symbol}) — ${cat.label}`,
      group: 'Units' as const,
      keywords: [u.id, u.label, u.symbol, cat.label, cat.id, ...(u.aliases ?? [])],
      kind: 'action' as const,
      run: () => handlers.navigate('conversions'),
      hint: `Convert ${cat.label}`,
    }))
  );

  // Knowledge / formulas
  const knowledge: Command[] = allEntries().slice(0, 60).map(entry => ({
    id: `knowledge.${entry.id}`,
    label: entry.term,
    group: 'Knowledge' as const,
    keywords: [entry.term, entry.area, ...(entry.aliases ?? []), entry.summary ?? ''],
    kind: 'action' as const,
    run: () => handlers.navigate('constants'),
    hint: entry.summary?.slice(0, 80),
  }));

  const actions: Command[] = [
    {
      id: 'theme.toggle',
      label: 'Toggle light / dark theme',
      group: 'Appearance',
      keywords: ['dark', 'light', 'theme', 'appearance', 'mode'],
      kind: 'action',
      run: handlers.toggleTheme,
    },
    ...(['DEG', 'RAD', 'GRAD'] as const).map((mode) => ({
      id: `angle.${mode}`,
      label: `Use ${mode} angle mode`,
      group: 'Angle mode' as const,
      keywords: ['angle', 'degrees', 'radians', 'gradians', mode.toLowerCase()],
      kind: 'action' as const,
      run: () => handlers.setAngleMode(mode),
    })),
    {
      id: 'calc.clear',
      label: 'Clear the calculator input',
      group: 'Calculator',
      keywords: ['clear', 'reset', 'empty', 'draft'],
      kind: 'action',
      run: handlers.clearDraft,
    },
    {
      id: 'calc.copy',
      label: 'Copy the current result',
      group: 'Calculator',
      keywords: ['copy', 'clipboard', 'answer', 'result'],
      kind: 'action',
      run: handlers.copyResult,
    },
    {
      id: 'help.shortcuts',
      label: 'Keyboard shortcuts',
      group: 'Help',
      keywords: ['shortcuts', 'keys', 'help', 'cheat sheet'],
      kind: 'action',
      run: handlers.openShortcuts,
    },
    ...(handlers.exportData
      ? [{
          id: 'data.export',
          label: 'Export data as JSON',
          group: 'Data' as const,
          keywords: ['backup', 'export', 'download', 'json'],
          kind: 'action' as const,
          run: handlers.exportData,
        }]
      : []),
    ...(handlers.importData
      ? [{
          id: 'data.import',
          label: 'Import data from JSON',
          group: 'Data' as const,
          keywords: ['restore', 'import', 'json', 'backup'],
          kind: 'action' as const,
          run: handlers.importData,
        }]
      : []),
  ];

  return [...tools, ...actions, ...settingsCmds, ...constants, ...units, ...knowledge];
}

export function createHistoryCommands(entries: { expression: string; display: string }[], handlers: CommandHandlers): Command[] {
  return entries.slice(0, 20).map((e, i) => ({
    id: `history.${i}`,
    label: `${e.expression} = ${e.display}`,
    group: 'History' as const,
    keywords: [e.expression, e.display],
    kind: 'action' as const,
    run: () => {
      handlers.setDraft?.(e.expression);
      handlers.navigate('calculator');
    },
    hint: 'Reuse from history',
  }));
}

/** Case-insensitive subsequence score; higher is better, 0 means no match. */
export function scoreMatch(text: string, query: string): number {
  if (!query) return 1;
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();

  const direct = haystack.indexOf(needle);
  if (direct === 0) return 1000;
  if (direct > 0) return 500 - direct;

  // For very short queries (<=2 chars) require direct substring to avoid false positives like "zz" matching "Hertz (Hz)"
  if (needle.length <= 2) return 0;

  // Subsequence match, rewarding runs and early first characters.
  let position = -1;
  let score = 0;
  let streak = 0;
  for (const character of needle) {
    const found = haystack.indexOf(character, position + 1);
    if (found === -1) return 0;
    streak = found === position + 1 ? streak + 1 : 0;
    score += 10 + streak - Math.min(found, 9);
    position = found;
  }
  return Math.max(1, score);
}

export function filterCommands(commands: readonly Command[], query: string, limit = 40): Command[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [...commands].slice(0, limit);
  }
  return commands
    .map((command) => {
      const labelScore = scoreMatch(command.label, trimmed) * 2;
      const keywordScore = Math.max(0, ...command.keywords.map((keyword) => scoreMatch(keyword, trimmed)));
      const groupScore = Math.floor(scoreMatch(command.group, trimmed) / 2);
      return { command, score: labelScore + keywordScore + groupScore };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.command);
}

/** Moves a selection index, wrapping around the list. */
export function moveSelection(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return ((current + delta) % length + length) % length;
}
