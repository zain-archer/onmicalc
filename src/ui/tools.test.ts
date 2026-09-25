import { describe, expect, it } from 'vitest';
import { defaultRoute, getTool, READY_TOOLS, TOOLS } from './tools';

describe('tool registry', () => {
  it('has unique ids', () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only exposes implemented tools as ready', () => {
    expect(READY_TOOLS.length).toBeGreaterThan(0);
    for (const tool of READY_TOOLS) expect(tool.status).toBe('ready');
    for (const tool of TOOLS.filter((t) => t.status === 'planned')) {
      expect(READY_TOOLS).not.toContain(tool);
    }
  });

  it('resolves the default route to a ready tool', () => {
    expect(getTool(defaultRoute())?.status).toBe('ready');
  });
});
