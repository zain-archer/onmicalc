import { describe, expect, it } from 'vitest';
import { evaluateExpression } from './engine';
import { formatNumber } from './precision/format';
import { TOOLS, READY_TOOLS, defaultRoute, getTool } from '@/ui/tools';

const value = (source: string, options = {}) => {
  const result = evaluateExpression(source, options);
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}: ${result.error.message}`);
  return result.value;
};

describe('engine robustness', () => {
  it('survives deeply nested parentheses', () => {
    const depth = 250;
    const source = `${'('.repeat(depth)}1${')'.repeat(depth)}`;
    expect(value(source)).toBe(1);
  });

  it('handles long expressions without losing accuracy', () => {
    const source = Array.from({ length: 500 }, () => '1').join('+');
    expect(value(source)).toBe(500);
  });

  it('rejects pathological input with an error instead of hanging', () => {
    const result = evaluateExpression(`${'('.repeat(4000)}1`);
    expect(result.ok).toBe(false);
  });

  it('reports the position of a syntax error', () => {
    const result = evaluateExpression('12 + * 3');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SYNTAX');
    expect(result.error.position).toBeGreaterThanOrEqual(0);
  });

  it('refuses overflow rather than printing Infinity', () => {
    const result = evaluateExpression('1e308 * 1e308');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(['OVERFLOW', 'DOMAIN', 'NOT_SUPPORTED']).toContain(result.error.code);
  });

  it('handles unicode operators and spacing', () => {
    expect(value('2 × 3')).toBe(6);
    expect(value('10 ÷ 4')).toBe(2.5);
    expect(value('7 − 2')).toBe(5);
    expect(value('  2   +   3  ')).toBe(5);
    expect(value('√9')).toBe(3);
  });

  it('treats empty input as no result, not as zero', () => {
    const result = evaluateExpression('   ');
    expect(result.ok).toBe(false);
  });

  it('keeps percent, modulo and factorial semantics stable', () => {
    expect(value('50%')).toBe(0.5);
    expect(value('-7 mod 3')).toBe(2);
    expect(value('0!')).toBe(1);
    expect(value('5!')).toBe(120);
    expect(() => value('171!')).toThrow();
  });

  it('resolves ans from provided variables only', () => {
    expect(value('ans * 2', { variables: { ans: 21 } })).toBe(42);
    expect(evaluateExpression('ans * 2').ok).toBe(false);
  });
});

describe('number formatting edge cases', () => {
  it('normalises negative zero and tiny noise', () => {
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  });

  it('keeps integers exact and groups thousands', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(1234567, { thousandsSeparator: false })).toBe('1234567');
    // 2^53 − 1 is the largest integer the formatter prints exactly.
    expect(formatNumber(2 ** 53 - 1)).toBe('9,007,199,254,740,991');
    expect(formatNumber(2 ** 53, { precision: 15 })).toMatch(/e\+15/);
  });

  it('switches to scientific notation when asked', () => {
    expect(formatNumber(12345, { numberFormat: 'scientific', precision: 4 })).toMatch(/1\.235e\+4|1\.234e\+4/);
    expect(formatNumber(0.000012345, { numberFormat: 'scientific', precision: 3 })).toMatch(/e-5/);
  });

  it('formats engineering notation with a power-of-three exponent', () => {
    const text = formatNumber(12345, { numberFormat: 'engineering', precision: 4 });
    expect(text).toMatch(/e\+3|e\+6/);
  });

  it('clamps precision into a sane range', () => {
    expect(formatNumber(Math.PI, { precision: 0 })).not.toBe('');
    expect(formatNumber(Math.PI, { precision: 99 }).length).toBeGreaterThan(3);
  });
});

describe('tool registry invariants', () => {
  it('has unique ids and labels', () => {
    expect(new Set(TOOLS.map((tool) => tool.id)).size).toBe(TOOLS.length);
    expect(new Set(TOOLS.map((tool) => tool.label)).size).toBe(TOOLS.length);
  });

  it('keeps every tool inside the 0–28 phase plan with a summary', () => {
    for (const tool of TOOLS) {
      expect(tool.phase).toBeGreaterThanOrEqual(0);
      expect(tool.phase).toBeLessThanOrEqual(28);
      expect(tool.summary.length).toBeGreaterThan(10);
      expect(tool.icon.length).toBeGreaterThan(5);
    }
  });

  it('resolves the default route to a ready tool', () => {
    const route = defaultRoute();
    expect(getTool(route)?.status).toBe('ready');
    expect(READY_TOOLS.length).toBeGreaterThan(0);
  });

  it('only marks a tool ready once its phase is implemented', () => {
    // Phase 28 is the release/docs phase, which can be ready at any time.
    for (const tool of TOOLS) {
      if (tool.phase >= 19 && tool.phase !== 28) {
        expect(tool.status, `${tool.id} should not claim to be ready yet`).toBe('planned');
      }
    }
  });
});
