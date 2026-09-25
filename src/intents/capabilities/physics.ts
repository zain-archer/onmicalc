import { formatNumber } from '@/core/precision/format';
import {
  acceleration,
  capacitorEnergy,
  circle,
  cone,
  cylinder,
  density,
  force,
  kineticEnergy,
  momentum,
  ohmsLaw,
  potentialEnergy,
  pressure,
  rcTimeConstant,
  rectangle,
  sphere,
  triangle,
  velocity,
  weight,
  work,
  type GeometryResult,
} from '@/engineering';
import type { Capability, SolveOutcome, ResultBlock, SolveContext } from '../types';

const nf = (value: number, precision = 8) => formatNumber(value, { precision });

interface Variable {
  id: string;
  label: string;
  symbol: string;
  unit: string;
  aliases: string[];
}

interface Quantity {
  id: string;
  title: string;
  /** Words that mean "find this". */
  asks: string[];
  keyword: string;
  unit: string;
  variables: Variable[];
  solve: (values: Record<string, number>) => number;
  note?: string;
}

/** Pulls "mass 2.5 kg" or "mass = 2.5" out of a sentence, unit-agnostic (SI assumed). */
function readVariable(context: SolveContext, variable: Variable): number | undefined {
  const direct = context.get(variable.id);
  if (direct !== undefined) return direct;
  for (const alias of variable.aliases) {
    const match = new RegExp(
      `${alias}\\s*(?:=|:|of|is)?\\s*(-?\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)`,
      'i',
    ).exec(context.raw);
    if (match) return Number(match[1]);
  }
  return undefined;
}

const QUANTITIES: Quantity[] = [
  {
    id: 'force',
    title: 'Force',
    asks: ['force'],
    keyword: 'force',
    unit: 'N',
    variables: [
      { id: 'mass', label: 'Mass', symbol: 'm', unit: 'kg', aliases: ['mass'] },
      { id: 'accel', label: 'Acceleration', symbol: 'a', unit: 'm/s²', aliases: ['acceleration', 'accelerating'] },
    ],
    solve: (v) => force(v.mass!, v.accel!),
  },
  {
    id: 'weight',
    title: 'Weight',
    asks: ['weight', 'how heavy'],
    keyword: 'weight',
    unit: 'N',
    variables: [{ id: 'mass', label: 'Mass', symbol: 'm', unit: 'kg', aliases: ['mass', 'weighing'] }],
    solve: (v) => weight(v.mass!),
    note: 'Uses standard gravity g = 9.80665 m/s².',
  },
  {
    id: 'kineticEnergy',
    title: 'Kinetic energy',
    asks: ['kinetic energy', 'energy of motion'],
    keyword: 'kinetic energy',
    unit: 'J',
    variables: [
      { id: 'mass', label: 'Mass', symbol: 'm', unit: 'kg', aliases: ['mass'] },
      { id: 'speed', label: 'Speed', symbol: 'v', unit: 'm/s', aliases: ['speed', 'velocity of'] },
    ],
    solve: (v) => kineticEnergy(v.mass!, v.speed!),
  },
  {
    id: 'potentialEnergy',
    title: 'Potential energy',
    asks: ['potential energy', 'energy gained', 'energy stored'],
    keyword: 'potential energy',
    unit: 'J',
    variables: [
      { id: 'mass', label: 'Mass', symbol: 'm', unit: 'kg', aliases: ['mass'] },
      { id: 'height', label: 'Height', symbol: 'h', unit: 'm', aliases: ['height', 'high'] },
    ],
    solve: (v) => potentialEnergy(v.mass!, v.height!),
    note: 'Uses standard gravity g = 9.80665 m/s².',
  },
  {
    id: 'momentum',
    title: 'Momentum',
    asks: ['momentum'],
    keyword: 'momentum',
    unit: 'kg·m/s',
    variables: [
      { id: 'mass', label: 'Mass', symbol: 'm', unit: 'kg', aliases: ['mass'] },
      { id: 'speed', label: 'Speed', symbol: 'v', unit: 'm/s', aliases: ['speed', 'velocity of'] },
    ],
    solve: (v) => momentum(v.mass!, v.speed!),
  },
  {
    id: 'density',
    title: 'Density',
    asks: ['density'],
    keyword: 'density',
    unit: 'kg/m³',
    variables: [
      { id: 'mass', label: 'Mass', symbol: 'm', unit: 'kg', aliases: ['mass'] },
      { id: 'volume', label: 'Volume', symbol: 'V', unit: 'm³', aliases: ['volume'] },
    ],
    solve: (v) => density(v.mass!, v.volume!),
  },
  {
    id: 'pressure',
    title: 'Pressure',
    asks: ['pressure'],
    keyword: 'pressure',
    unit: 'Pa',
    variables: [
      { id: 'force', label: 'Force', symbol: 'F', unit: 'N', aliases: ['force'] },
      { id: 'area', label: 'Area', symbol: 'A', unit: 'm²', aliases: ['area', 'over'] },
    ],
    solve: (v) => pressure(v.force!, v.area!),
  },
  {
    id: 'speed',
    title: 'Speed',
    asks: ['speed', 'velocity'],
    keyword: 'speed',
    unit: 'm/s',
    variables: [
      { id: 'distance', label: 'Distance', symbol: 'd', unit: 'm', aliases: ['distance', 'travelled', 'traveled'] },
      { id: 'time', label: 'Time', symbol: 't', unit: 's', aliases: ['time', 'in time'] },
    ],
    solve: (v) => velocity(v.distance!, v.time!),
  },
  {
    id: 'acceleration',
    title: 'Acceleration',
    asks: ['acceleration'],
    keyword: 'acceleration',
    unit: 'm/s²',
    variables: [
      { id: 'change', label: 'Change in speed', symbol: 'Δv', unit: 'm/s', aliases: ['from', 'change in velocity', 'change in speed'] },
      { id: 'time', label: 'Time', symbol: 't', unit: 's', aliases: ['over', 'time'] },
    ],
    solve: (v) => acceleration(v.change!, v.time!),
  },
  {
    id: 'work',
    title: 'Work done',
    asks: ['work done', 'work'],
    keyword: 'work',
    unit: 'J',
    variables: [
      { id: 'force', label: 'Force', symbol: 'F', unit: 'N', aliases: ['force'] },
      { id: 'distance', label: 'Distance', symbol: 'd', unit: 'm', aliases: ['distance', 'over'] },
    ],
    solve: (v) => work(v.force!, v.distance!),
  },
];

export const physicsQuantityCapability: Capability = {
  id: 'physicsQuantity',
  title: 'Physics quantities',
  promise: '“Force from mass 1200 kg and acceleration 2 m/s2”, “kinetic energy of mass 0.5 kg at speed 12 m/s”.',
  group: 'Physics & engineering',
  keywords: [
    ...QUANTITIES.map((quantity) => quantity.keyword),
    'mass', 'acceleration', 'newton', 'joule', 'physics', 'si units',
  ],
  examples: [
    { text: 'force from mass 1200 and acceleration 2', capabilityId: 'physicsQuantity', captures: [] },
    { text: 'kinetic energy of mass 0.5 at speed 12', capabilityId: 'physicsQuantity', captures: [] },
    { text: 'density with mass 2.5 and volume 0.001', capabilityId: 'physicsQuantity', captures: [] },
  ],
  inputs: [
    { name: 'quantity', label: 'Quantity', hint: 'force, weight, kinetic energy, momentum, density, pressure, speed, work …', example: 'force', optional: true },
    { name: 'mass', label: 'Mass (kg)', example: '1200', optional: true },
    { name: 'accel', label: 'Acceleration (m/s²)', example: '2', optional: true },
    { name: 'speed', label: 'Speed (m/s)', example: '12', optional: true },
    { name: 'volume', label: 'Volume (m³)', example: '0.001', optional: true },
    { name: 'area', label: 'Area (m²)', example: '0.5', optional: true },
  ],
  run(context): SolveOutcome {
    const asked = (context.getText('quantity') ?? '').toLowerCase();
    const said = context.raw.toLowerCase();
    const positionOf = (quantity: Quantity): number => {
      const positions = quantity.asks
        .map((word) => said.indexOf(word))
        .filter((index) => index >= 0);
      return positions.length > 0 ? Math.min(...positions) : Number.POSITIVE_INFINITY;
    };
    const candidates = QUANTITIES.filter((quantity) =>
      asked
        ? quantity.asks.some((word) => word.includes(asked) || asked.includes(word)) || quantity.title.toLowerCase() === asked
        : Number.isFinite(positionOf(quantity)),
    ).sort((a, b) => {
      // "force from mass 1200 and acceleration 2" asks for force: the quantity
      // named first is the answer, the rest are its inputs.
      const byPosition = positionOf(a) - positionOf(b);
      return byPosition !== 0 ? byPosition : b.keyword.length - a.keyword.length;
    });

    const chosen = candidates[0];
    if (!chosen) {
      return {
        ok: false,
        message: `Which quantity? Try one of: ${QUANTITIES.map((quantity) => quantity.keyword).join(', ')}.`,
      };
    }

    const values: Record<string, number> = {};
    const missing: Variable[] = [];
    for (const variable of chosen.variables) {
      const value = readVariable(context, variable);
      if (value === undefined || Number.isNaN(value)) missing.push(variable);
      else values[variable.id] = value;
    }

    if (missing.length > 0) {
      return {
        ok: false,
        message: `I need ${missing.map((variable) => `${variable.label.toLowerCase()} (${variable.symbol}, ${variable.unit})`).join(' and ')} to find the ${chosen.title.toLowerCase()}.`,
      };
    }

    try {
      const result = chosen.solve(values);
      return {
        ok: true,
        headline: `${nf(result)} ${chosen.unit}`,
        understood: `${chosen.title} from ${Object.entries(values)
          .map(([id, value]) => `${chosen.variables.find((variable) => variable.id === id)?.symbol} = ${nf(value)}`)
          .join(', ')}`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              ...chosen.variables.map((variable) => ({
                label: `${variable.label} (${variable.symbol})`,
                value: `${nf(values[variable.id]!)} ${variable.unit}`,
              })),
              { label: chosen.title, value: `${nf(result)} ${chosen.unit}`, emphasize: true },
            ],
          },
          {
            kind: 'note',
            text: chosen.note ?? 'Assumes SI units throughout (metres, kilograms, seconds).',
          },
        ],
        copyText: `${chosen.title} = ${result} ${chosen.unit}`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That calculation failed.' };
    }
  },
};

export const ohmsLawCapability: Capability = {
  id: 'ohmsLaw',
  title: "Ohm's law and power",
  promise: '“Voltage with current 2 A and resistance 50 ohm”, “power from 12 V and 0.5 A”.',
  group: 'Physics & engineering',
  keywords: [
    'ohm', "ohm's law", 'voltage', 'volt', 'current', 'ampere', 'amp', 'resistance', 'resistor',
    'power', 'watts', 'circuit', 'capacitor', 'rc time constant', 'time constant',
  ],
  examples: [
    { text: 'voltage with current 2 and resistance 50', capabilityId: 'ohmsLaw', captures: [] },
    { text: 'power from 12 volts and 0.5 amps', capabilityId: 'ohmsLaw', captures: [] },
    { text: 'resistance with voltage 12 and current 4', capabilityId: 'ohmsLaw', captures: [] },
  ],
  inputs: [
    { name: 'voltage', label: 'Voltage (V)', example: '12', optional: true },
    { name: 'current', label: 'Current (A)', example: '0.5', optional: true },
    { name: 'resistance', label: 'Resistance (Ω)', example: '50', optional: true },
    { name: 'power', label: 'Power (W)', example: '6', optional: true },
  ],
  run(context): SolveOutcome {
    const pick = (name: string, pattern: RegExp): number | undefined => {
      const captured = context.get(name);
      if (captured !== undefined) return captured;
      const match = pattern.exec(context.raw);
      if (!match) return undefined;
      const value = Number(match[1] ?? match[2]);
      return Number.isFinite(value) ? value : undefined;
    };

    const voltage = pick('voltage', /(?:voltage|volts?)\s*(?:=|is|of|:)?\s*(-?[\d.]+)|(-?[\d.]+)\s*(?:v\b|volts?)/i);
    const current = pick('current', /(?:current|amps?|amperes?)\s*(?:=|is|of|:)?\s*(-?[\d.]+)|(-?[\d.]+)\s*(?:a\b|amps?|amperes?)/i);
    const resistance = pick('resistance', /(?:resistance|ohms?)\s*(?:=|is|of|:)?\s*(-?[\d.]+)|(-?[\d.]+)\s*(?:ohms?|Ω)/i);
    const power = pick('power', /(?:power|watts?)\s*(?:=|is|of|:)?\s*(-?[\d.]+)|(-?[\d.]+)\s*(?:w\b|watts?)/i);

    const raw = context.raw.toLowerCase();
    const wantsPower = /power|watts?|\bw\b/.test(raw) && !/resistance/.test(raw);
    const known = { voltage, current, resistance, power };
    const knownCount = Object.values(known).filter((value) => value !== undefined).length;

    if (knownCount < 2) {
      return {
        ok: false,
        message: 'Give me any two of voltage, current, resistance or power, for example “voltage with current 2 and resistance 50”.',
      };
    }

    try {
      const result = ohmsLaw(known as Partial<Record<'voltage' | 'current' | 'resistance' | 'power', number>>);
      const rows = [
        { label: 'Voltage (V)', value: `${nf(result.voltage)} V`, emphasize: wantsPower ? false : true },
        { label: 'Current (A)', value: `${nf(result.current)} A` },
        { label: 'Resistance (Ω)', value: `${nf(result.resistance)} Ω` },
        { label: 'Power (W)', value: `${nf(result.power)} W`, emphasize: wantsPower },
      ];
      const answer = wantsPower ? `${nf(result.power)} W` : `${nf(result.voltage)} V`;
      return {
        ok: true,
        headline: answer,
        understood: `Ohm's law and power from ${knownCount} known values`,
        blocks: [
          { kind: 'stats', rows },
          {
            kind: 'note',
            text: 'Relations used: V = IR, P = VI. Values assume an ideal resistive load.',
          },
        ],
        copyText: `V = ${result.voltage} V, I = ${result.current} A, R = ${result.resistance} Ω, P = ${result.power} W`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "That Ohm's-law calculation failed." };
    }
  },
};

export const capacitorCapability: Capability = {
  id: 'capacitor',
  title: 'Capacitors and RC circuits',
  promise: '“Energy stored in a 100 microfarad capacitor at 12 V”, “RC time constant for 10 kohm and 100 uF”.',
  group: 'Physics & engineering',
  keywords: ['capacitor', 'capacitance', 'farad', 'rc time constant', 'time constant', 'stored energy', 'charge stored'],
  examples: [
    { text: 'energy stored in a capacitor of 100 uF at 12 V', capabilityId: 'capacitor', captures: [] },
    { text: 'rc time constant for 10000 ohm and 100 uF', capabilityId: 'capacitor', captures: [] },
  ],
  inputs: [
    { name: 'capacitance', label: 'Capacitance (F)', hint: 'Enter farads: 100 µF = 0.0001', example: '0.0001', optional: true },
    { name: 'voltage', label: 'Voltage (V)', example: '12', optional: true },
    { name: 'resistance', label: 'Resistance (Ω)', example: '10000', optional: true },
  ],
  run(context): SolveOutcome {
    const raw = context.raw;
    const scaler = (text: string): number => {
      if (/µf|uf|microfarad/i.test(text)) return 1e-6;
      if (/\bnf\b|nanofarad/i.test(text)) return 1e-9;
      if (/\bpf\b|picofarad/i.test(text)) return 1e-12;
      return 1;
    };
    const resistanceScaler = (text: string): number => (/k\s*ohms?|kilo-?ohms?|kΩ/i.test(text) ? 1000 : /\bm\s*ohms?|mega-?ohms?|MΩ/i.test(text) ? 1e6 : 1);

    const capMatch = /(-?[\d.]+)\s*(µf|uf|nf|pf|microfarads?|nanofarads?|picofarads?|farads?|f\b)/i.exec(raw);
    const capacitance = context.get('capacitance') ?? (capMatch ? Number(capMatch[1]) * scaler(capMatch[2] ?? '') : undefined);
    const voltage = context.get('voltage') ?? (/(-?[\d.]+)\s*(?:v\b|volts?)/i.exec(raw) ? Number(/(-?[\d.]+)\s*(?:v\b|volts?)/i.exec(raw)![1]) : undefined);
    const resMatch = /(-?[\d.]+)\s*(k?\s?ohms?|kΩ|mΩ|Ω|resistance)/i.exec(raw);
    const resistance = context.get('resistance') ?? (resMatch ? Number(resMatch[1]) * resistanceScaler(resMatch[2] ?? '') : undefined);

    const wantsTimeConstant = /time constant|\brc\b|\btau\b/i.test(raw);

    try {
      if (wantsTimeConstant) {
        if (capacitance === undefined || resistance === undefined) {
          return { ok: false, message: 'The RC time constant needs both capacitance in farads and resistance in ohms.' };
        }
        const result = rcTimeConstant(resistance, capacitance);
        return {
          ok: true,
          headline: `${nf(result.tau)} s`,
          understood: `RC time constant for R = ${nf(resistance)} Ω, C = ${nf(capacitance)} F`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                { label: 'τ = RC', value: `${nf(result.tau)} s`, emphasize: true },
                { label: 'Half-life (τ ln 2)', value: `${nf(result.halfLife)} s` },
                { label: 'Charged to 99% after', value: `${nf(5 * result.tau)} s` },
              ],
            },
          ],
          copyText: `τ = ${result.tau} s, half-life = ${result.halfLife} s`,
        };
      }

      if (capacitance === undefined || voltage === undefined) {
        return { ok: false, message: 'I need the capacitance (in farads) and the voltage, for example “energy stored in 0.0001 F at 12 V”.' };
      }
      const result = capacitorEnergy(capacitance, voltage);
      return {
        ok: true,
        headline: `${nf(result.energy)} J`,
        understood: `energy in C = ${nf(capacitance)} F at ${nf(voltage)} V`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              { label: 'Energy (½CV²)', value: `${nf(result.energy)} J`, emphasize: true },
              { label: 'Charge (CV)', value: `${nf(capacitance * voltage)} C` },
            ],
          },
          { kind: 'note', text: 'Enter capacitance in farads: 100 µF = 0.0001 F.' },
        ],
        copyText: `E = ${result.energy} J`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That capacitor calculation failed.' };
    }
  },
};

/* ----------------------------- Geometry ----------------------------- */

const SHAPES = [
  {
    id: 'circle',
    keywords: ['circle', 'disc', 'disk'],
    variables: ['radius'],
    compute: (v: Record<string, number>) => circle(v.radius!),
    question: (v: Record<string, number>) => `radius ${v.radius}`,
  },
  {
    id: 'sphere',
    keywords: ['sphere', 'ball'],
    variables: ['radius'],
    compute: (v: Record<string, number>) => sphere(v.radius!),
    question: (v: Record<string, number>) => `radius ${v.radius}`,
  },
  {
    id: 'square',
    keywords: ['square'],
    variables: ['side'],
    compute: (v: Record<string, number>) => rectangle(v.side!, v.side!),
    question: (v: Record<string, number>) => `side ${v.side}`,
  },
  {
    id: 'rectangle',
    keywords: ['rectangle', 'rectangular', 'area of a rect'],
    variables: ['width', 'height'],
    compute: (v: Record<string, number>) => rectangle(v.width!, v.height!),
    question: (v: Record<string, number>) => `${v.width} × ${v.height}`,
  },
  {
    id: 'triangle',
    keywords: ['triangle'],
    variables: ['a', 'b', 'c'],
    compute: (v: Record<string, number>) => triangle(v.a!, v.b!, v.c!),
    question: (v: Record<string, number>) => `sides ${v.a}, ${v.b}, ${v.c}`,
  },
  {
    id: 'cylinder',
    keywords: ['cylinder', 'tube'],
    variables: ['radius', 'height'],
    compute: (v: Record<string, number>) => cylinder(v.radius!, v.height!),
    question: (v: Record<string, number>) => `radius ${v.radius}, height ${v.height}`,
  },
  {
    id: 'cone',
    keywords: ['cone'],
    variables: ['radius', 'height'],
    compute: (v: Record<string, number>) => cone(v.radius!, v.height!),
    question: (v: Record<string, number>) => `radius ${v.radius}, height ${v.height}`,
  },
] as const;

const VARIABLE_PATTERNS: Record<string, RegExp> = {
  radius: /radius\s*(?:=|:)?\s*(-?[\d.]+)|(-?[\d.]+)\s*(?:cm|mm|km|m|in|ft)\s*(?:radius)/i,
  side: /side\s*(?:=|:)?\s*(-?[\d.]+)|(-?[\d.]+)\s*(?:cm|mm|km|m|in|ft)\s*(?:side)/i,
  width: /(?:width|wide)\s*(?:=|:)?\s*(-?[\d.]+)|(-?[\d.]+)\s*(?:cm|mm|km|m|in|ft)?\s*(?:wide)/i,
  height: /(?:height|tall)\s*(?:=|:)?\s*(-?[\d.]+)|(-?[\d.]+)\s*(?:cm|mm|km|m|in|ft)?\s*(?:tall)/i,
  a: /(?:side a|a)\s*(?:=|:)?\s*(-?[\d.]+)/i,
  b: /(?:side b|b)\s*(?:=|:)?\s*(-?[\d.]+)/i,
  c: /(?:side c|c)\s*(?:=|:)?\s*(-?[\d.]+)/i,
};

export const geometryCapability: Capability = {
  id: 'geometry',
  title: 'Areas, volumes and perimeters',
  promise: '“Area of a circle with radius 4”, “volume of a cylinder radius 2 height 5”.',
  group: 'Physics & engineering',
  keywords: [
    'area of', 'volume of', 'perimeter', 'circumference', 'surface area', 'circle', 'sphere',
    'cylinder', 'cone', 'triangle', 'rectangle', 'square',
  ],
  examples: [
    { text: 'area of a circle with radius 4', capabilityId: 'geometry', captures: [] },
    { text: 'volume of a cylinder radius 2 height 5', capabilityId: 'geometry', captures: [] },
    { text: 'sphere volume with radius 3', capabilityId: 'geometry', captures: [] },
  ],
  inputs: [
    { name: 'shape', label: 'Shape', hint: 'circle, sphere, cylinder, cone, triangle, rectangle', kind: 'text', example: 'circle', optional: true },
    { name: 'radius', label: 'Radius', example: '4', optional: true },
    { name: 'height', label: 'Height', example: '5', optional: true },
    { name: 'width', label: 'Width', example: '3', optional: true },
  ],
  run(context): SolveOutcome {
    const raw = context.raw.toLowerCase();
    const requested = (context.getText('shape') ?? '').toLowerCase();
    const shape =
      SHAPES.find((candidate) => requested && candidate.keywords.some((word) => word.includes(requested) || requested.includes(word)))
      ?? SHAPES.find((candidate) => candidate.keywords.some((word) => raw.includes(word)));
    if (!shape) {
      return { ok: false, message: 'Which shape? Try a circle, sphere, cylinder, cone, triangle or rectangle.' };
    }

    const values: Record<string, number> = {};
    const missing: string[] = [];
    for (const name of shape.variables) {
      const direct = context.get(name);
      if (direct !== undefined) {
        values[name] = direct;
        continue;
      }
      const pattern = VARIABLE_PATTERNS[name]!;
      const match = pattern.exec(context.raw);
      const parsed = match ? Number(match[1] ?? match[2]) : Number.NaN;
      if (Number.isFinite(parsed)) values[name] = parsed;
      else missing.push(name);
    }

    if (missing.length > 0) {
      // A single bare number is a good default for radius/side.
      const single = /(-?[\d.]+)/.exec(context.raw);
      if (missing.length === 1 && single) {
        values[missing[0]!] = Number(single[1]);
        missing.length = 0;
      }
    }

    if (missing.length > 0) {
      return { ok: false, message: `I need the ${missing.join(' and ')} of the ${shape.id}, for example “area of a circle with radius 4”.` };
    }

    try {
      const result: GeometryResult = shape.compute(values);
      const rows = [
        ...(result.area !== undefined ? [{ label: 'Area', value: nf(result.area) }] : []),
        ...(result.perimeter !== undefined ? [{ label: 'Perimeter', value: nf(result.perimeter) }] : []),
        ...(result.volume !== undefined ? [{ label: 'Volume', value: nf(result.volume) }] : []),
        ...(result.surfaceArea !== undefined ? [{ label: 'Surface area', value: nf(result.surfaceArea) }] : []),
        ...(result.extra ?? []).map((entry) => ({ label: entry.label, value: nf(entry.value) })),
      ];
      const headline = rows[0] ? `${rows[0].label}: ${rows[0].value}` : 'Calculated';
      const blocks: ResultBlock[] = [{ kind: 'stats', rows }];
      return {
        ok: true,
        headline,
        understood: `${shape.id} with ${shape.question(values)}`,
        blocks,
        copyText: `${shape.id} (${shape.question(values)}): ${rows.map((row) => `${row.label} ${row.value}`).join(', ')}`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That geometry calculation failed.' };
    }
  },
};
