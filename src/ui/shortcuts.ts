/** Keyboard shortcut definitions and matching helpers (framework-free). */

export interface KeyEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export interface ShortcutBinding {
  key: string;
  /** Accept either Ctrl or Cmd, so the same binding works on every platform. */
  primary?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
}

export interface ShortcutDef extends ShortcutBinding {
  id: string;
  label: string;
  /** Grouping for the help dialog. */
  group: 'Global' | 'Calculator' | 'Panels';
}

function normaliseKey(key: string): string {
  if (key === ' ') return 'space';
  if (key === 'Escape' || key === 'Esc') return 'escape';
  return key.toLowerCase();
}

export function matchesBinding(event: KeyEventLike, binding: ShortcutBinding): boolean {
  if (normaliseKey(event.key) !== normaliseKey(binding.key)) return false;

  const wantsPrimary = binding.primary === true;
  const hasPrimary = Boolean(event.ctrlKey || event.metaKey);
  if (wantsPrimary) {
    if (!hasPrimary) return false;
  } else {
    // Without `primary`, every modifier is compared exactly so a plain "d"
    // binding cannot be triggered by Ctrl+D.
    if (Boolean(event.ctrlKey) !== Boolean(binding.ctrl)) return false;
    if (Boolean(event.metaKey) !== Boolean(binding.meta)) return false;
  }

  if (Boolean(event.altKey) !== Boolean(binding.alt)) return false;

  const wantsShift = binding.shift === true;
  if (wantsShift !== Boolean(event.shiftKey)) {
    // Shifted symbol keys ("?" and "/") report shiftKey=true on most layouts
    // even though the binding does not ask for Shift.
    const key = normaliseKey(binding.key);
    const shiftedSymbol = key.length === 1 && !/[a-z0-9]/.test(key);
    if (!(shiftedSymbol && !wantsShift)) return false;
  }

  return true;
}

/** Human-readable key list, using ⌘ on Apple platforms. */
export function formatBinding(binding: ShortcutBinding, isApple = false): string {
  const parts: string[] = [];
  if (binding.primary) parts.push(isApple ? '⌘' : 'Ctrl');
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.meta) parts.push(isApple ? '⌘' : 'Meta');
  if (binding.alt) parts.push(isApple ? '⌥' : 'Alt');
  if (binding.shift && binding.key === '?') parts.push('Shift');
  else if (binding.shift) parts.push('Shift');
  const key = binding.key === ' ' ? 'Space' : binding.key.length === 1 ? binding.key.toUpperCase() : binding.key;
  parts.push(key === 'Escape' ? 'Esc' : key);
  return parts.join(isApple ? '' : '+');
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  { id: 'palette', key: 'k', primary: true, label: 'Open the command palette', group: 'Global' },
  { id: 'palette.slash', key: '/', label: 'Open the command palette', group: 'Global' },
  { id: 'shortcuts', key: '?', shift: true, label: 'Show this shortcut list', group: 'Global' },
  { id: 'escape', key: 'Escape', label: 'Close the palette or dialog', group: 'Global' },
  { id: 'tool.next', key: 'ArrowDown', alt: true, label: 'Next tool', group: 'Global' },
  { id: 'tool.previous', key: 'ArrowUp', alt: true, label: 'Previous tool', group: 'Global' },
  { id: 'theme.toggle', key: 'd', alt: true, label: 'Toggle light / dark theme', group: 'Global' },
  { id: 'calc.evaluate', key: 'Enter', label: 'Evaluate the expression', group: 'Calculator' },
  { id: 'calc.clear', key: 'Escape', label: 'Clear the expression field', group: 'Calculator' },
  { id: 'calc.history', key: 'ArrowUp', label: 'Previous expression (in an empty field)', group: 'Calculator' },
  { id: 'plot.zoomIn', key: '=', label: 'Zoom in on the plot', group: 'Panels' },
  { id: 'plot.zoomOut', key: '-', label: 'Zoom out on the plot', group: 'Panels' },
  { id: 'plot.pan', key: 'ArrowKeys', label: 'Pan the plot', group: 'Panels' },
];

export function findShortcut(event: KeyEventLike): ShortcutDef | undefined {
  return SHORTCUTS.find((shortcut) => matchesBinding(event, shortcut));
}

/** True when the event target is a typing surface, so shortcuts should not fire. */
export function isTypingTarget(target: unknown): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable === true;
}

export function nextToolIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return ((current + delta) % length + length) % length;
}
