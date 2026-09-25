import { describe, expect, it, vi } from 'vitest';
import { createCommands, filterCommands, moveSelection, scoreMatch, type CommandHandlers } from './commands';

function handlers(overrides: Partial<CommandHandlers> = {}): CommandHandlers {
  return {
    navigate: vi.fn(),
    toggleTheme: vi.fn(),
    setAngleMode: vi.fn(),
    clearDraft: vi.fn(),
    copyResult: vi.fn(),
    openShortcuts: vi.fn(),
    ...overrides,
  };
}

describe('command palette model', () => {
  it('exposes every ready tool as a navigation command', () => {
    const commands = createCommands(handlers());
    expect(commands.find((command) => command.id === 'tool.calculator')?.kind).toBe('navigate');
    expect(commands.find((command) => command.id === 'tool.graph')?.keywords).toContain('plot');
  });

  it('runs the matching handler', () => {
    const spies = handlers();
    const commands = createCommands(spies);
    commands.find((command) => command.id === 'tool.finance')!.run();
    expect(spies.navigate).toHaveBeenCalledWith('finance');
    commands.find((command) => command.id === 'theme.toggle')!.run();
    expect(spies.toggleTheme).toHaveBeenCalled();
    commands.find((command) => command.id === 'angle.RAD')!.run();
    expect(spies.setAngleMode).toHaveBeenCalledWith('RAD');
  });

  it('includes data commands only when the handlers exist', () => {
    expect(createCommands(handlers()).some((command) => command.id === 'data.export')).toBe(false);
    const withData = createCommands(handlers({ exportData: vi.fn(), importData: vi.fn() }));
    expect(withData.some((command) => command.id === 'data.export')).toBe(true);
    expect(withData.some((command) => command.id === 'data.import')).toBe(true);
  });

  it('ranks prefix matches above weaker matches and finds keywords', () => {
    const commands = createCommands(handlers());
    expect(scoreMatch('Calculator', 'calc')).toBeGreaterThan(scoreMatch('Calculator', 'lator'));
    expect(scoreMatch('Calculator', 'zzz')).toBe(0);
    const byKeyword = filterCommands(commands, 'eigenvalue');
    expect(byKeyword[0]?.id).toBe('tool.matrix');
    const byPrefix = filterCommands(commands, 'graph');
    expect(byPrefix[0]?.id).toBe('tool.graph');
  });

  it('returns everything for an empty query and nothing for gibberish', () => {
    const commands = createCommands(handlers());
    expect(filterCommands(commands, '  ').length).toBe(commands.length);
    expect(filterCommands(commands, 'qqqqzzz')).toHaveLength(0);
  });

  it('wraps the selection index', () => {
    expect(moveSelection(0, -1, 5)).toBe(4);
    expect(moveSelection(4, 1, 5)).toBe(0);
    expect(moveSelection(0, 1, 0)).toBe(0);
  });
});
