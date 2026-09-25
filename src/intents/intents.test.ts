import { describe, expect, it } from 'vitest';
import { capabilityById, everyCapability } from './capabilities';
import { matchSentence } from './patterns';
import { groupedCapabilities, plan, runPlan, scoreCapabilities } from './solve';
import { CATEGORY_ORDER } from './types';
import { hasUnitWords, unitWords, convertByWords } from './units';

/** The contract: whatever a user types, this capability must answer. */
const ROUTING: [sentence: string, capability: string][] = [
  ['compound interest on 1000 at 5 percent for 10 years', 'interest'],
  ['loan of 200000 at 6 percent for 30 years', 'interest'],
  ['roi on 1000 growing to 1600 in 5 years', 'interest'],
  ['20 percent of 250', 'percentOf'],
  ['what is 15% of 80', 'percentOf'],
  ['what percent is 45 of 300', 'percentRatio'],
  ['increase 80 by 15 percent', 'percentChange'],
  ['decrease 500 by 12.5%', 'percentChange'],
  ['tip 15 percent on a bill of 60', 'tip'],
  ['tip 10% on 45 for 3 people', 'tip'],
  ['price 240 with 25 percent discount', 'discount'],
  ['30% off 89.99 plus 10% tax', 'discount'],
  ['split 120 between 4 people', 'splitBill'],
  ['convert 5 km to miles', 'convertUnits'],
  ['how many ounces is 250 g', 'convertUnits'],
  ['72 fahrenheit in celsius', 'convertUnits'],
  ['solve 3x + 5 = 20', 'solveEquation'],
  ['x^2 - 5x + 6 = 0', 'solveEquation'],
  ['solve 2x + y = 10, x - y = 2', 'solveSystem'],
  ['plot x^2 - 4', 'plotAnalysis'],
  ['where does x^3 - 3x cross zero', 'plotAnalysis'],
  ['graph sin(x) from 0 to 6.28', 'plotAnalysis'],
  ['differentiate x^3 + 2x', 'derivative'],
  ['second derivative of sin(x)', 'derivative'],
  ['slope of x^2 at 3', 'derivative'],
  ['integrate x^2 from 0 to 3', 'integral'],
  ['area under sin(x) between 0 and 3.14159', 'integral'],
  ['limit of sin(x)/x as x approaches 0', 'limit'],
  ['taylor series of sin(x) to order 5', 'series'],
  ['summarise 12, 15, 11, 19, 15', 'statistics'],
  ['average of 4, 8, 15, 16, 23, 42', 'statistics'],
  ['standard deviation of 2 4 4 4 5 5 7 9', 'statistics'],
  ['linear regression for x 1, 2, 3, 4 y 1.9, 4.1, 5.9, 8.2', 'regression'],
  ['probability z < 1.96', 'probability'],
  ['probability between -1 and 1', 'probability'],
  ['chance of at most 8 successes in 10 trials with p 0.3', 'probability'],
  ['determinant of 1 2; 3 4', 'matrix'],
  ['inverse of 4 7; 2 6', 'matrix'],
  ['eigenvalues of 2 0; 0 3', 'matrix'],
  ['rank of 1 2 3; 4 5 6', 'matrix'],
  ['transpose of 1 2; 3 4', 'matrix'],
  ['dot product of 1 2 3 and 4 5 6', 'vector'],
  ['cross product of 1 0 0 and 0 1 0', 'vector'],
  ['angle between 1 0 and 0 1', 'vector'],
  ['magnitude of 3 4', 'vector'],
  ['force from mass 1200 and acceleration 2', 'physicsQuantity'],
  ['kinetic energy of mass 0.5 at speed 12', 'physicsQuantity'],
  ['density with mass 2.5 and volume 0.001', 'physicsQuantity'],
  ['voltage with current 2 and resistance 50', 'ohmsLaw'],
  ['power from 12 volts and 0.5 amps', 'ohmsLaw'],
  ['rc time constant for 10000 ohm and 0.0001 F', 'capacitor'],
  ['energy stored in a capacitor of 0.0001 F at 12 V', 'capacitor'],
  ['area of a circle with radius 4', 'geometry'],
  ['volume of a cylinder radius 2 height 5', 'geometry'],
  ['sphere volume with radius 3', 'geometry'],
  ['days between 2024-01-01 and 2026-09-25', 'dateTime'],
  ['how old am I if born 1995-04-12', 'dateTime'],
  ['time between 09:00 and 17:30', 'dateTime'],
  ['what is 12 + 34 * 2', 'calculate'],
  ['2^10', 'calculate'],
];

/** End-to-end answers, checked against the engine's real output. */
const ANSWERS: [sentence: string, expected: string | RegExp][] = [
  ['20 percent of 250', '50'],
  ['what percent is 45 of 300', '15%'],
  ['increase 80 by 15 percent', '+15%'],
  ['tip 15 percent on a bill of 60', '69'],
  ['price 240 with 25 percent discount', '180'],
  ['split 120 between 4 people', /^30/],
  ['convert 5 km to miles', /3\.106855961/],
  ['72 fahrenheit in celsius', /22\.22222222/],
  ['solve 3x + 5 = 20', 'x = 5'],
  ['x^2 - 5x + 6 = 0', /x = 2,\s+x = 3/],
  ['solve 2x + y = 10, x - y = 2', /x = 4,\s+y = 2/],
  ['integrate x^2 from 0 to 3', '9'],
  ['limit of sin(x)/x as x approaches 0', '1'],
  ['area under sin(x) between 0 and 3.14159', '2'],
  ['slope of x^2 at 3', '2 * x'],
  ['second derivative of sin(x)', '-sin(x)'],
  ['differentiate x^3 + 2x', '3 * x ^ 2 + 2'],
  ['determinant of 1 2; 3 4', '-2'],
  ['rank of 1 2 3; 4 5 6', '2'],
  ['eigenvalues of 2 0; 0 3', '2, 3'],
  ['dot product of 1 2 3 and 4 5 6', '32'],
  ['cross product of 1 0 0 and 0 1 0', '(0, 0, 1)'],
  ['angle between 1 0 and 0 1', '90°'],
  ['magnitude of 3 4', '5'],
  ['force from mass 1200 and acceleration 2', '2,400 N'],
  ['kinetic energy of mass 0.5 at speed 12', '36 J'],
  ['density with mass 2.5 and volume 0.001', '2,500 kg/m³'],
  ['voltage with current 2 and resistance 50', '100 V'],
  ['power from 12 volts and 0.5 amps', '6 W'],
  ['rc time constant for 10000 ohm and 0.0001 F', '1 s'],
  ['energy stored in a capacitor of 0.0001 F at 12 V', '0.0072 J'],
  ['area of a circle with radius 4', /50\.265482/],
  ['volume of a cylinder radius 2 height 5', /62\.831853/],
  ['days between 2024-01-01 and 2026-09-25', '998 days'],
  ['time between 09:00 and 17:30', /8 h 30 min/],
  ['probability z < 1.96', /0\.9750021/],
  ['probability between -1 and 1', /0\.68268949/],
  ['chance of at most 8 successes in 10 trials with p 0.3', /0\.99985631/],
  ['summarise 12, 15, 11, 19, 15', 'Mean 14.4, median 15'],
  ['linear regression for x 1, 2, 3, 4 y 1.9, 4.1, 5.9, 8.2', /y = 2\.07x/],
  ['compound interest on 1000 at 5 percent for 10 years', '1,600'],
  ['what is 12 + 34 * 2', '80'],
];

describe('intent layer — structure', () => {
  it('exposes well-formed capabilities', () => {
    const capabilities = everyCapability();
    expect(capabilities.length).toBeGreaterThanOrEqual(25);
    const ids = capabilities.map((capability) => capability.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const capability of capabilities) {
      expect(capability.title.length).toBeGreaterThan(2);
      expect(capability.promise.length).toBeGreaterThan(2);
      expect(capability.keywords.length).toBeGreaterThan(0);
      expect(capability.examples.length).toBeGreaterThan(0);
      expect(CATEGORY_ORDER).toContain(capability.group);
      for (const example of capability.examples) {
        expect(example.capabilityId).toBe(capability.id);
      }
      for (const input of capability.inputs) {
        expect(input.name.length).toBeGreaterThan(0);
        expect(input.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('maps ids back to capabilities', () => {
    expect(capabilityById('percentOf')?.id).toBe('percentOf');
    expect(capabilityById('nope')).toBeUndefined();
  });

  it('groups every capability in the published order', () => {
    const groups = groupedCapabilities().map((entry) => entry.group);
    expect(groups).toEqual([...CATEGORY_ORDER].filter((group) => groups.includes(group)));
    const total = groupedCapabilities().reduce((count, entry) => count + entry.capabilities.length, 0);
    expect(total).toBe(everyCapability().length);
  });

  it('routes every capability from its own examples', () => {
    for (const capability of everyCapability()) {
      for (const example of capability.examples) {
        const planned = plan(example.text);
        expect([capability.id, planned.capability?.id]).toEqual([capability.id, capability.id]);
      }
    }
  });

  it('ranks a capability above its neighbours only when the words fit', () => {
    const ranked = scoreCapabilities('20 percent of 250');
    expect(ranked[0]?.capability.id).toBe('percentOf');
  });
});

describe('intent layer — routing', () => {
  it.each(ROUTING)('routes %s', (sentence, expected) => {
    const planned = plan(sentence);
    expect(planned.capability?.id).toBe(expected);
  });

  it('asks for more words when the request is empty', () => {
    const planned = plan('   ');
    expect(planned.capability).toBeNull();
    expect(planned.capability === null && planned.reason).toBe('empty');
  });

  it('offers suggestions instead of guessing', () => {
    const planned = plan('zzz qqq');
    expect(planned.capability).toBeNull();
    expect(planned.capability === null && planned.suggestions.length).toBeGreaterThan(0);
  });

  it('honours a forced capability', () => {
    const planned = plan('anything at all', { capabilityId: 'statistics' });
    expect(planned.capability?.id).toBe('statistics');
    if (planned.capability) expect(planned.confidence).toBe(1);
  });

  it('treats two equals signs as a system', () => {
    expect(plan('2x + y = 10; x - y = 2').capability?.id).toBe('solveSystem');
  });
});

describe('intent layer — answers', () => {
  it.each(ANSWERS)('answers %s', (sentence, expected) => {
    const planned = plan(sentence);
    expect(planned.capability).not.toBeNull();
    const outcome = runPlan(planned.capability ? planned : (plan(sentence, { capabilityId: 'calculate' }) as never));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      if (typeof expected === 'string') expect(outcome.headline).toBe(expected);
      else expect(outcome.headline).toMatch(expected);
      expect(outcome.copyText.length).toBeGreaterThan(0);
      expect(outcome.blocks.length).toBeGreaterThan(0);
    }
  });

  it('fills fields supplied by the form', () => {
    const planned = plan('percent of something', { capabilityId: 'percentOf' });
    const outcome = runPlan(planned as never, { percent: 15, whole: 200 });
    expect(outcome.ok && outcome.headline).toBe('30');
  });

  it('explains itself when values are missing', () => {
    const planned = plan('20 percent', { capabilityId: 'percentOf' });
    const outcome = runPlan(planned as never);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toMatch(/for example/i);
  });

  it('never throws, even on nonsense', () => {
    for (const sentence of ['###', 'integrate', 'solve', 'matrix of nothing']) {
      const planned = plan(sentence);
      const outcome = planned.capability ? runPlan(planned) : { ok: false as const, message: '' };
      expect(typeof outcome.ok).toBe('boolean');
    }
  });
});

describe('intent layer — patterns and units', () => {
  it('accepts the same request in different wording', () => {
    const patterns = capabilityById('percentOf')!.patterns!;
    for (const sentence of ['18% of 240', '18 percent of 240', 'what is 18 percent of 240']) {
      const match = patterns.map((pattern) => matchSentence(sentence, pattern)).find(Boolean);
      expect(match?.text).toMatchObject({ percent: '18', whole: '240' });
    }
  });

  it('knows unit words', () => {
    expect(hasUnitWords('convert 5 km to miles')).toBe(true);
    expect(hasUnitWords('72 fahrenheit in celsius')).toBe(true);
    expect(hasUnitWords('solve 3x + 5 = 20')).toBe(false);
    expect(unitWords()).toContain('km');
  });

  it('explains a cross-category conversion instead of guessing', () => {
    expect(() => convertByWords(5, 'km', 'kg')).toThrow(/length unit and .* mass unit/i);
    const outcome = runPlan(plan('convert 5 km to kg') as never);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.message).toMatch(/cannot be converted/i);
  });
});
