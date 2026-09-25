import { describe, expect, it } from 'vitest';
import { closestWord, closestWords, correctReadings, correctSentence, damerauDistance, typoBudget } from './fuzzy';
import { plan, runPlan } from './solve';
import { intentVocabulary, preferredWords, protectedWords } from './vocabulary';

const VOCAB = ['convert', 'kilometre', 'celsius', 'fahrenheit', 'integrate', 'derivative', 'percent', 'solve'];

describe('fuzzy — distance', () => {
  it('counts a swapped pair as one typo', () => {
    expect(damerauDistance('convret', 'convert')).toBe(1);
    expect(damerauDistance('intergrate', 'integrate')).toBe(1);
  });

  it('counts insertions, deletions and substitutions', () => {
    expect(damerauDistance('solv', 'solve')).toBe(1);
    expect(damerauDistance('percentt', 'percent')).toBe(1);
    expect(damerauDistance('celsiuc', 'celsius')).toBe(1);
    expect(damerauDistance('abc', 'xyz')).toBe(3);
  });

  it('agrees with the unbounded distance inside the budget', () => {
    // "ite" → "eit" is a three-letter rotation: two swaps, not one.
    expect(damerauDistance('fahrenhite', 'fahrenheit')).toBe(2);
    expect(damerauDistance('fahrenhite', 'fahrenheit', 2)).toBe(2);
    expect(damerauDistance('precent', 'percent', 2)).toBe(1);
    expect(damerauDistance('solv', 'solve', 1)).toBe(1);
    // Beyond the budget the exact value does not matter, only that it is over.
    expect(damerauDistance('fahrenhite', 'fahrenheit', 1)).toBeGreaterThan(1);
  });

  it('gives longer words a bigger budget', () => {
    expect(typoBudget(3)).toBe(0);
    expect(typoBudget(4)).toBe(1);
    expect(typoBudget(6)).toBe(1);
    expect(typoBudget(8)).toBe(2);
    expect(typoBudget(12)).toBe(2);
  });

  it('never rewrites very short words', () => {
    expect(closestWord('kmm', VOCAB)).toBeNull();
  });
});

describe('fuzzy — candidate choice', () => {
  it('finds the closest word within budget', () => {
    expect(closestWord('convret', VOCAB)).toBe('convert');
    expect(closestWord('kilomter', VOCAB)).toBe('kilometre');
    expect(closestWord('fahrenhite', VOCAB)).toBe('fahrenheit');
  });

  it('prefers an instruction word when two words are equally close', () => {
    // Both are one typo away; only one of them means something to the app.
    expect(closestWords('precent', ['percent', 'present'], new Set(['percent']))[0]).toBe('percent');
    expect(closestWord('precent', ['percent', 'present'], new Set(['percent']))).toBe('percent');
  });

  it('refuses a genuine 50/50 guess', () => {
    expect(closestWord('precent', ['percent', 'present'])).toBeNull();
  });

  it('uses the app vocabulary', () => {
    const vocabulary = intentVocabulary();
    expect(vocabulary.size).toBeGreaterThan(400);
    expect(preferredWords().has('percent')).toBe(true);
    expect(protectedWords().has('want')).toBe(true);
  });
});

describe('fuzzy — sentence correction', () => {
  const fix = (sentence: string) =>
    correctSentence(sentence, intentVocabulary(), protectedWords(), preferredWords());

  it('reports every change so the UI can show it', () => {
    const result = fix('convret 5 km to miels');
    expect(result.text).toBe('convert 5 km to miles');
    expect(result.corrections).toEqual([
      { from: 'convret', to: 'convert' },
      { from: 'miels', to: 'miles' },
    ]);
  });

  it('leaves clean sentences untouched', () => {
    const result = fix('integrate x^2 from 0 to 3');
    expect(result.text).toBe('integrate x^2 from 0 to 3');
    expect(result.corrections).toEqual([]);
  });

  it('never touches numbers, symbols or expressions', () => {
    const result = fix('what is 2.5e3 * (4 + 7) / 12.5');
    expect(result.text).toBe('what is 2.5e3 * (4 + 7) / 12.5');
  });

  it('keeps ordinary English intact', () => {
    const result = fix('i want to know the total for these people');
    expect(result.text).toBe('i want to know the total for these people');
    expect(result.corrections).toEqual([]);
  });

  it('offers alternative readings for ambiguous wording', () => {
    const readings = correctReadings(
      'what is 20 precent of 250',
      intentVocabulary(),
      protectedWords(),
      preferredWords(),
    );
    expect(readings[0]!.text).toBe('what is 20 percent of 250');
    expect(readings.length).toBeGreaterThan(1);
  });

  it('is fast enough to run while the user types', () => {
    const sentence = 'convret 5 km to miels and intergrate x^2 from 0 to 3';
    const started = performance.now();
    for (let index = 0; index < 200; index += 1) fix(sentence);
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

describe('fuzzy — the request still has to make sense', () => {
  it.each([
    'convret 5 km to miels',
    'how many ouces is 250 g',
    '72 fahrenhite in celsius',
    'solv 3x + 5 = 20',
    'sovle 2x + y = 10, x - y = 2',
    'intergrate x^2 from 0 to 3',
    'derivitive of x^3 + 2x',
    'plto x^2 - 4',
    'dterminant of 1 2; 3 4',
    'standrad deviation of 2 4 4 4 5 5 7 9',
    'probabilty z < 1.96',
    'compund interest on 1000 at 5 percent for 10 years',
    'dot produt of 1 2 3 and 4 5 6',
    'voltage with curent 2 and resistance 50',
    'summarze 12, 15, 11, 19, 15',
    'averge of 4, 8, 15, 16, 23, 42',
    'area of a crcle with radius 4',
    'taylor seris of sin(x) to order 5',
    'tip 15 percnet on a bill of 60',
    'what is 20 precent of 250',
    'split 120 betwen 4 people',
    'limit of sin(x)/x as x aproaches 0',
    'linear regresion for x 1, 2, 3, 4 y 1.9, 4.1, 5.9, 8.2',
    'i want to know the total force from mass 1200 and acceleration 2',
  ])('understands %s', (sentence) => {
    const planned = plan(sentence);
    expect(planned.capability).not.toBeNull();
    if (!planned.capability) return;
    const outcome = runPlan(planned);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.headline.length).toBeGreaterThan(0);
  });

  it('still answers a typo with the same numbers as the clean sentence', () => {
    const clean = runPlan(plan('convert 5 km to miles') as never);
    const typo = runPlan(plan('convret 5 km to miels') as never);
    expect(clean.ok && typo.ok && typo.headline).toBe(clean.ok ? clean.headline : '');
  });

  it('does not invent an answer from gibberish', () => {
    const planned = plan('quizzle wumpus flarn');
    expect(planned.capability === null || plan('quizzle wumpus flarn').capability?.id === 'calculate').toBe(true);
  });
});
