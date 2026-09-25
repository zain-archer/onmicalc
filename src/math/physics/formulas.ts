/**
 * Physics formula library.
 *
 * Every relation is stored as data: the symbols with their names and units, the
 * relation as it is written by hand, and a residual expression that is zero
 * exactly when the relation holds (F = m·a is stored as `f - m*a`). The residual
 * is compiled by the app's own safe parser, so nothing is ever evaluated as
 * code, and every formula is checked by the same rules as any other input.
 *
 * Symbols are lower-case because the expression language treats names case
 * insensitively; `display` holds the symbol physicists write (F, Eₖ, Δv…), and
 * the solver accepts either form. Each formula's symbols are unique among its
 * own quantities — a repeated letter would silently mix two different things.
 *
 * Default values are the CODATA values from `src/constants/physical.ts`, so the
 * physics tools and the constants panel can never disagree.
 */

export type PhysicsCategory =
  | 'Mechanics'
  | 'Gravitation'
  | 'Waves & sound'
  | 'Thermal'
  | 'Electricity'
  | 'Magnetism'
  | 'Optics'
  | 'Fluids'
  | 'Modern physics';

export const PHYSICS_CATEGORIES: readonly PhysicsCategory[] = [
  'Mechanics',
  'Gravitation',
  'Waves & sound',
  'Thermal',
  'Electricity',
  'Magnetism',
  'Optics',
  'Fluids',
  'Modern physics',
];

export interface PhysicsQuantity {
  /** Lower-case name used inside the residual expression. */
  symbol: string;
  /** How the symbol is written by hand, e.g. "Eₖ" — accepted by the solver too. */
  display?: string;
  name: string;
  unit: string;
  /** Fill-in value shown in the interface (physical constants especially). */
  defaultValue?: number;
  /** True when the symbol is a physical constant rather than a measurement. */
  constant?: boolean;
}

export interface PhysicsFormula {
  id: string;
  name: string;
  category: PhysicsCategory;
  /** The relation as it is written by hand, e.g. "F = m·a". */
  relation: string;
  /** Zero exactly when the relation holds; parsed by the app's expression parser. */
  residual: string;
  quantities: PhysicsQuantity[];
  /** Symbols that must stay positive (masses, distances, absolute temperatures…). */
  positive?: string[];
  /** Symbols that may not be negative (times, kinetic energies…). */
  nonNegative?: string[];
  note?: string;
}

function define(
  id: string,
  name: string,
  category: PhysicsCategory,
  relation: string,
  residual: string,
  quantities: PhysicsQuantity[],
  options: Omit<PhysicsFormula, 'id' | 'name' | 'category' | 'relation' | 'residual' | 'quantities'> = {},
): PhysicsFormula {
  return { id, name, category, relation, residual, quantities, ...options };
}

const q = (
  symbol: string,
  name: string,
  unit: string,
  extra: Partial<PhysicsQuantity> = {},
): PhysicsQuantity => ({ symbol, name, unit, ...extra });

const GRAV = { defaultValue: 6.6743e-11, constant: true };
const GFIELD = { defaultValue: 9.80665, constant: true };
const LIGHT = { defaultValue: 299792458, constant: true };
const PLANCK = { defaultValue: 6.62607015e-34, constant: true };
const GAS = { defaultValue: 8.314462618, constant: true };
const STEFAN = { defaultValue: 5.670374419e-8, constant: true };
const COULOMB = { defaultValue: 8.9875517923e9, constant: true };
const ATM = { defaultValue: 101325, constant: true };
const SOUND = { defaultValue: 343 };
const WATER = { defaultValue: 1000 };
const REFERENCE_INTENSITY = { defaultValue: 1e-12, constant: true };

export const PHYSICS_FORMULAS: readonly PhysicsFormula[] = [
  /* -------------------------------- Mechanics ------------------------------ */
  define('newton-second', "Newton's second law", 'Mechanics', 'F = m·a', 'f - m*a', [
    q('f', 'force', 'N', { display: 'F' }),
    q('m', 'mass', 'kg'),
    q('a', 'acceleration', 'm/s²'),
  ], { positive: ['m'] }),

  define('weight', 'Weight', 'Mechanics', 'W = m·g', 'w - m*g', [
    q('w', 'weight', 'N', { display: 'W' }),
    q('m', 'mass', 'kg'),
    q('g', 'gravitational field strength', 'm/s²', { display: 'g', ...GFIELD }),
  ], { positive: ['m'] }),

  define('velocity-definition', 'Velocity from distance and time', 'Mechanics', 'v = s / t', 'v - s/t', [
    q('v', 'velocity', 'm/s'),
    q('s', 'distance', 'm'),
    q('t', 'time', 's'),
  ], { positive: ['t'] }),

  define('acceleration-definition', 'Acceleration from a velocity change', 'Mechanics', 'a = Δv / t', 'a - dv/t', [
    q('a', 'acceleration', 'm/s²'),
    q('dv', 'change in velocity', 'm/s', { display: 'Δv' }),
    q('t', 'time', 's'),
  ], { positive: ['t'] }),

  define('kinematics-velocity', 'SUVAT: v = u + a·t', 'Mechanics', 'v = u + a·t', 'v - u - a*t', [
    q('v', 'final velocity', 'm/s'),
    q('u', 'initial velocity', 'm/s'),
    q('a', 'acceleration', 'm/s²'),
    q('t', 'time', 's'),
  ], { nonNegative: ['t'] }),

  define('kinematics-displacement', 'SUVAT: s = u·t + ½a·t²', 'Mechanics', 's = u·t + ½·a·t²', 's - u*t - 0.5*a*t^2', [
    q('s', 'displacement', 'm'),
    q('u', 'initial velocity', 'm/s'),
    q('a', 'acceleration', 'm/s²'),
    q('t', 'time', 's'),
  ], { note: 'The squared time gives two algebraic solutions for t; the non-negative one is reported.' }),

  define('kinematics-vsq', 'SUVAT: v² = u² + 2a·s', 'Mechanics', 'v² = u² + 2·a·s', 'v^2 - u^2 - 2*a*s', [
    q('v', 'final velocity', 'm/s'),
    q('u', 'initial velocity', 'm/s'),
    q('a', 'acceleration', 'm/s²'),
    q('s', 'displacement', 'm'),
  ], { note: 'A negative right-hand side means the car never reaches that displacement, so there is no real speed.' }),

  define('kinematics-average', 'SUVAT: s = ½(u + v)·t', 'Mechanics', 's = ½(u + v)·t', 's - 0.5*(u + v)*t', [
    q('s', 'displacement', 'm'),
    q('u', 'initial velocity', 'm/s'),
    q('v', 'final velocity', 'm/s'),
    q('t', 'time', 's'),
  ], { nonNegative: ['t'] }),

  define('work', 'Work done by a force', 'Mechanics', 'W = F·d·cos θ', 'w - f*d*cos(theta*pi/180)', [
    q('w', 'work', 'J', { display: 'W' }),
    q('f', 'force', 'N', { display: 'F' }),
    q('d', 'distance moved', 'm'),
    q('theta', 'angle between force and motion', '°', { display: 'θ', defaultValue: 0 }),
  ]),

  define('kinetic-energy', 'Kinetic energy', 'Mechanics', 'Eₖ = ½m·v²', 'ek - 0.5*m*v^2', [
    q('ek', 'kinetic energy', 'J', { display: 'Ek' }),
    q('m', 'mass', 'kg'),
    q('v', 'speed', 'm/s'),
  ], { positive: ['m'], nonNegative: ['ek'] }),

  define('potential-energy', 'Gravitational potential energy', 'Mechanics', 'Eₚ = m·g·h', 'ep - m*g*h', [
    q('ep', 'potential energy', 'J', { display: 'Ep' }),
    q('m', 'mass', 'kg'),
    q('g', 'gravitational field strength', 'm/s²', { display: 'g', ...GFIELD }),
    q('h', 'height', 'm'),
  ], { positive: ['m'] }),

  define('power-work', 'Power from work and time', 'Mechanics', 'P = W / t', 'p - w/t', [
    q('p', 'power', 'W', { display: 'P' }),
    q('w', 'work done', 'J', { display: 'W' }),
    q('t', 'time', 's'),
  ], { positive: ['t'] }),

  define('power-force-velocity', 'Power from force and velocity', 'Mechanics', 'P = F·v', 'p - f*v', [
    q('p', 'power', 'W', { display: 'P' }),
    q('f', 'force', 'N', { display: 'F' }),
    q('v', 'velocity', 'm/s'),
  ]),

  define('momentum', 'Linear momentum', 'Mechanics', 'p = m·v', 'mom - m*v', [
    q('mom', 'momentum', 'kg·m/s', { display: 'p' }),
    q('m', 'mass', 'kg'),
    q('v', 'velocity', 'm/s'),
  ], { positive: ['m'] }),

  define('impulse', 'Impulse', 'Mechanics', 'J = F·Δt', 'j - f*dt', [
    q('j', 'impulse', 'N·s', { display: 'J' }),
    q('f', 'force', 'N', { display: 'F' }),
    q('dt', 'time interval', 's', { display: 'Δt' }),
  ], { nonNegative: ['dt'] }),

  define('hooke', 'Hooke’s law', 'Mechanics', 'F = k·x', 'f - k*x', [
    q('f', 'force', 'N', { display: 'F' }),
    q('k', 'spring constant', 'N/m'),
    q('x', 'extension', 'm'),
  ], { positive: ['k'] }),

  define('elastic-pe', 'Elastic potential energy', 'Mechanics', 'E = ½k·x²', 'epe - 0.5*k*x^2', [
    q('epe', 'elastic potential energy', 'J', { display: 'E' }),
    q('k', 'spring constant', 'N/m'),
    q('x', 'extension', 'm'),
  ], { positive: ['k'], nonNegative: ['epe'] }),

  define('friction', 'Friction force', 'Mechanics', 'f = μ·N', 'f - mu*nf', [
    q('f', 'friction force', 'N', { display: 'f' }),
    q('mu', 'coefficient of friction', '—', { display: 'μ', defaultValue: 0.3 }),
    q('nf', 'normal force', 'N', { display: 'N' }),
  ]),

  define('centripetal-acceleration', 'Centripetal acceleration', 'Mechanics', 'a = v² / r', 'a - v^2/r', [
    q('a', 'centripetal acceleration', 'm/s²'),
    q('v', 'speed', 'm/s'),
    q('r', 'radius', 'm'),
  ], { positive: ['r'] }),

  define('centripetal-force', 'Centripetal force', 'Mechanics', 'F = m·v² / r', 'f - m*v^2/r', [
    q('f', 'force', 'N', { display: 'F' }),
    q('m', 'mass', 'kg'),
    q('v', 'speed', 'm/s'),
    q('r', 'radius', 'm'),
  ], { positive: ['m', 'r'] }),

  define('circular-period', 'Period of circular motion', 'Mechanics', 'T = 2πr / v', 'tp - 2*pi*r/v', [
    q('tp', 'period', 's', { display: 'T' }),
    q('r', 'radius', 'm'),
    q('v', 'speed', 'm/s'),
  ], { positive: ['r', 'v'], nonNegative: ['tp'] }),

  define('spring-period', 'Period of a mass on a spring', 'Mechanics', 'T = 2π·√(m/k)', 'tp - 2*pi*sqrt(m/k)', [
    q('tp', 'period', 's', { display: 'T' }),
    q('m', 'mass', 'kg'),
    q('k', 'spring constant', 'N/m'),
  ], { positive: ['m', 'k'], nonNegative: ['tp'] }),

  define('pendulum-period', 'Period of a simple pendulum', 'Mechanics', 'T = 2π·√(L/g)', 'tp - 2*pi*sqrt(l/g)', [
    q('tp', 'period', 's', { display: 'T' }),
    q('l', 'length', 'm', { display: 'L' }),
    q('g', 'gravitational field strength', 'm/s²', { display: 'g', ...GFIELD }),
  ], {
    positive: ['l', 'g'],
    nonNegative: ['tp'],
    note: 'The small-angle period; a wide swing takes slightly longer.',
  }),

  define('torque', 'Torque', 'Mechanics', 'τ = F·r·sin θ', 'tau - f*r*sin(theta*pi/180)', [
    q('tau', 'torque', 'N·m', { display: 'τ' }),
    q('f', 'force', 'N', { display: 'F' }),
    q('r', 'lever arm', 'm'),
    q('theta', 'angle between force and lever arm', '°', { display: 'θ', defaultValue: 90 }),
  ]),

  /* ------------------------------- Gravitation ----------------------------- */
  define('gravitation', "Newton's law of gravitation", 'Gravitation', 'F = G·m₁·m₂ / r²', 'f - grav*m1*m2/r^2', [
    q('f', 'force', 'N', { display: 'F' }),
    q('grav', 'gravitational constant', 'm³/(kg·s²)', { display: 'G', ...GRAV }),
    q('m1', 'first mass', 'kg', { display: 'm₁' }),
    q('m2', 'second mass', 'kg', { display: 'm₂' }),
    q('r', 'separation', 'm'),
  ], { positive: ['m1', 'm2', 'r'] }),

  define('gravitational-field', 'Gravitational field strength', 'Gravitation', 'g = G·M / r²', 'gf - grav*mbody/r^2', [
    q('gf', 'field strength', 'm/s²', { display: 'g' }),
    q('grav', 'gravitational constant', 'm³/(kg·s²)', { display: 'G', ...GRAV }),
    q('mbody', 'mass of the body', 'kg', { display: 'M' }),
    q('r', 'distance from the centre', 'm'),
  ], { positive: ['mbody', 'r'] }),

  define('orbital-speed', 'Circular orbital speed', 'Gravitation', 'v = √(G·M / r)', 'v - sqrt(grav*mbody/r)', [
    q('v', 'orbital speed', 'm/s'),
    q('grav', 'gravitational constant', 'm³/(kg·s²)', { display: 'G', ...GRAV }),
    q('mbody', 'mass of the central body', 'kg', { display: 'M' }),
    q('r', 'orbit radius', 'm'),
  ], { positive: ['mbody', 'r'] }),

  define('kepler-third', "Kepler's third law", 'Gravitation', 'T² = 4π²r³ / (G·M)', 'tp^2 - 4*pi^2*r^3/(grav*mbody)', [
    q('tp', 'orbital period', 's', { display: 'T' }),
    q('r', 'orbit radius', 'm'),
    q('grav', 'gravitational constant', 'm³/(kg·s²)', { display: 'G', ...GRAV }),
    q('mbody', 'mass of the central body', 'kg', { display: 'M' }),
  ], { positive: ['r', 'mbody'], nonNegative: ['tp'] }),

  define('escape-velocity', 'Escape velocity', 'Gravitation', 'v = √(2G·M / r)', 'v - sqrt(2*grav*mbody/r)', [
    q('v', 'escape velocity', 'm/s'),
    q('grav', 'gravitational constant', 'm³/(kg·s²)', { display: 'G', ...GRAV }),
    q('mbody', 'mass of the body', 'kg', { display: 'M' }),
    q('r', 'distance from the centre', 'm'),
  ], { positive: ['mbody', 'r'] }),

  /* ----------------------------- Waves & sound ----------------------------- */
  define('wave-speed', 'Wave speed', 'Waves & sound', 'v = f·λ', 'v - freq*lambda', [
    q('v', 'wave speed', 'm/s'),
    q('freq', 'frequency', 'Hz', { display: 'f' }),
    q('lambda', 'wavelength', 'm', { display: 'λ' }),
  ]),

  define('period-frequency', 'Period and frequency', 'Waves & sound', 'T = 1 / f', 'tp - 1/freq', [
    q('tp', 'period', 's', { display: 'T' }),
    q('freq', 'frequency', 'Hz', { display: 'f' }),
  ], { positive: ['freq'], nonNegative: ['tp'] }),

  define('sound-level', 'Sound level in decibels', 'Waves & sound', 'L = 10·log(I / I₀)', 'level - 10*log(intensity/i0)', [
    q('level', 'sound level', 'dB', { display: 'L' }),
    q('intensity', 'intensity', 'W/m²', { display: 'I' }),
    q('i0', 'reference intensity', 'W/m²', { display: 'I₀', ...REFERENCE_INTENSITY }),
  ], { positive: ['intensity', 'i0'], note: 'log here is base 10, so the ratio is in bels times ten.' }),

  define('doppler-approaching', 'Doppler shift (approaching)', 'Waves & sound', "f' = f·(v + vₒ) / (v − vₛ)", "fp - freq*(v + vo)/(v - vs)", [
    q('fp', 'observed frequency', 'Hz', { display: "f'" }),
    q('freq', 'source frequency', 'Hz', { display: 'f' }),
    q('v', 'speed of sound', 'm/s', { display: 'v', ...SOUND }),
    q('vo', 'observer speed towards the source', 'm/s', { display: 'v₀', defaultValue: 0 }),
    q('vs', 'source speed towards the observer', 'm/s', { display: 'vs', defaultValue: 0 }),
  ], { note: 'Both speeds are measured towards the source/observer; the observed frequency rises when they approach.' }),

  /* --------------------------------- Thermal ------------------------------- */
  define('ideal-gas', 'Ideal gas law', 'Thermal', 'p·V = n·R·T', 'p*vol - n*rg*temp', [
    q('p', 'pressure', 'Pa'),
    q('vol', 'volume', 'm³', { display: 'V' }),
    q('n', 'amount of substance', 'mol'),
    q('rg', 'gas constant', 'J/(mol·K)', { display: 'R', ...GAS }),
    q('temp', 'absolute temperature', 'K', { display: 'T' }),
  ], { positive: ['vol', 'n', 'temp'] }),

  define('heat-capacity', 'Heat to change temperature', 'Thermal', 'Q = m·c·ΔT', 'q - m*c*dt', [
    q('q', 'heat added', 'J', { display: 'Q' }),
    q('m', 'mass', 'kg'),
    q('c', 'specific heat capacity', 'J/(kg·K)'),
    q('dt', 'temperature change', 'K', { display: 'ΔT' }),
  ], { positive: ['m'] }),

  define('latent-heat', 'Latent heat', 'Thermal', 'Q = m·L', 'q - m*lat', [
    q('q', 'heat added', 'J', { display: 'Q' }),
    q('m', 'mass', 'kg'),
    q('lat', 'specific latent heat', 'J/kg', { display: 'L' }),
  ], { positive: ['m'] }),

  define('first-law', 'First law of thermodynamics', 'Thermal', 'ΔU = Q − W', 'du - (q - w)', [
    q('du', 'change in internal energy', 'J', { display: 'ΔU' }),
    q('q', 'heat added to the system', 'J', { display: 'Q' }),
    q('w', 'work done by the system', 'J', { display: 'W' }),
  ]),

  define('thermal-expansion', 'Linear thermal expansion', 'Thermal', 'ΔL = α·L₀·ΔT', 'dl - alpha*l0*dt', [
    q('dl', 'change in length', 'm', { display: 'ΔL' }),
    q('alpha', 'linear expansion coefficient', '1/K', { display: 'α' }),
    q('l0', 'original length', 'm', { display: 'L₀' }),
    q('dt', 'temperature change', 'K', { display: 'ΔT' }),
  ]),

  define('heat-engine', 'Heat engine efficiency', 'Thermal', 'η = 1 − T_c / T_h', 'eta - (1 - tc/th)', [
    q('eta', 'efficiency', '—', { display: 'η' }),
    q('tc', 'cold reservoir temperature', 'K', { display: 'T_c' }),
    q('th', 'hot reservoir temperature', 'K', { display: 'T_h' }),
  ], { positive: ['tc', 'th'], note: 'Both temperatures must be absolute (kelvin).' }),

  define('stefan-boltzmann', 'Stefan–Boltzmann radiated power', 'Thermal', 'P = ε·σ·A·T⁴', 'rank - epsilon*sigma*area*temp^4', [
    q('rank', 'radiated power', 'W', { display: 'P' }),
    q('epsilon', 'emissivity', '—', { display: 'ε', defaultValue: 1 }),
    q('sigma', 'Stefan–Boltzmann constant', 'W/(m²·K⁴)', { display: 'σ', ...STEFAN }),
    q('area', 'surface area', 'm²', { display: 'A' }),
    q('temp', 'absolute temperature', 'K', { display: 'T' }),
  ], { positive: ['area', 'temp'], nonNegative: ['epsilon'] }),

  /* ------------------------------- Electricity ----------------------------- */
  define('ohm', "Ohm's law", 'Electricity', 'V = I·R', 'v - curr*r', [
    q('v', 'voltage', 'V', { display: 'V' }),
    q('curr', 'current', 'A', { display: 'I' }),
    q('r', 'resistance', 'Ω', { display: 'R' }),
  ]),

  define('electric-power', 'Electrical power', 'Electricity', 'P = V·I', 'p - v*curr', [
    q('p', 'power', 'W', { display: 'P' }),
    q('v', 'voltage', 'V', { display: 'V' }),
    q('curr', 'current', 'A', { display: 'I' }),
  ]),

  define('electric-power-r', 'Power in a resistor', 'Electricity', 'P = I²·R', 'p - curr^2*r', [
    q('p', 'power', 'W', { display: 'P' }),
    q('curr', 'current', 'A', { display: 'I' }),
    q('r', 'resistance', 'Ω', { display: 'R' }),
  ]),

  define('coulomb', "Coulomb's law", 'Electricity', 'F = k·q₁·q₂ / r²', 'f - kc*q1*q2/r^2', [
    q('f', 'force', 'N', { display: 'F' }),
    q('kc', 'Coulomb constant', 'N·m²/C²', { display: 'k', ...COULOMB }),
    q('q1', 'first charge', 'C', { display: 'q₁' }),
    q('q2', 'second charge', 'C', { display: 'q₂' }),
    q('r', 'separation', 'm'),
  ], { positive: ['r'] }),

  define('electric-field', 'Electric field strength', 'Electricity', 'E = F / q', 'ef - f/q', [
    q('ef', 'field strength', 'N/C', { display: 'E' }),
    q('f', 'force', 'N', { display: 'F' }),
    q('q', 'charge', 'C'),
  ]),

  define('electric-potential', 'Potential near a point charge', 'Electricity', 'V = k·Q / r', 'v - kc*q/r', [
    q('v', 'potential', 'V', { display: 'V' }),
    q('kc', 'Coulomb constant', 'N·m²/C²', { display: 'k', ...COULOMB }),
    q('q', 'charge', 'C', { display: 'Q' }),
    q('r', 'distance', 'm'),
  ], { positive: ['r'] }),

  define('capacitance', 'Charge on a capacitor', 'Electricity', 'Q = C·V', 'q - c*v', [
    q('q', 'charge', 'C', { display: 'Q' }),
    q('c', 'capacitance', 'F', { display: 'C' }),
    q('v', 'voltage', 'V', { display: 'V' }),
  ]),

  define('capacitor-energy', 'Energy stored in a capacitor', 'Electricity', 'E = ½C·V²', 'ecap - 0.5*c*v^2', [
    q('ecap', 'energy', 'J', { display: 'E' }),
    q('c', 'capacitance', 'F', { display: 'C' }),
    q('v', 'voltage', 'V', { display: 'V' }),
  ], { nonNegative: ['ecap'] }),

  define('resistors-series', 'Two resistors in series', 'Electricity', 'R = R₁ + R₂', 'r - (r1 + r2)', [
    q('r', 'total resistance', 'Ω', { display: 'R' }),
    q('r1', 'first resistance', 'Ω', { display: 'R₁' }),
    q('r2', 'second resistance', 'Ω', { display: 'R₂' }),
  ]),

  define('resistors-parallel', 'Two resistors in parallel', 'Electricity', '1/R = 1/R₁ + 1/R₂', '1/r - (1/r1 + 1/r2)', [
    q('r', 'total resistance', 'Ω', { display: 'R' }),
    q('r1', 'first resistance', 'Ω', { display: 'R₁' }),
    q('r2', 'second resistance', 'Ω', { display: 'R₂' }),
  ], { positive: ['r1', 'r2'] }),

  define('capacitors-parallel', 'Two capacitors in parallel', 'Electricity', 'C = C₁ + C₂', 'c - (c1 + c2)', [
    q('c', 'total capacitance', 'F', { display: 'C' }),
    q('c1', 'first capacitance', 'F', { display: 'C₁' }),
    q('c2', 'second capacitance', 'F', { display: 'C₂' }),
  ]),

  define('rc-time-constant', 'RC time constant', 'Electricity', 'τ = R·C', 'tau - r*c', [
    q('tau', 'time constant', 's', { display: 'τ' }),
    q('r', 'resistance', 'Ω', { display: 'R' }),
    q('c', 'capacitance', 'F', { display: 'C' }),
  ], { positive: ['r', 'c'] }),

  define('rc-discharge', 'Capacitor discharge', 'Electricity', 'V = V₀·e^(−t/RC)', 'v - v0*exp(-t/(r*c))', [
    q('v', 'voltage after time t', 'V', { display: 'V' }),
    q('v0', 'initial voltage', 'V', { display: 'V₀' }),
    q('t', 'time', 's'),
    q('r', 'resistance', 'Ω', { display: 'R' }),
    q('c', 'capacitance', 'F', { display: 'C' }),
  ], { positive: ['r', 'c'], nonNegative: ['t'] }),

  /* -------------------------------- Magnetism ------------------------------ */
  define('lorentz-force', 'Magnetic force on a moving charge', 'Magnetism', 'F = q·v·B·sin θ', 'f - q*v*b*sin(theta*pi/180)', [
    q('f', 'force', 'N', { display: 'F' }),
    q('q', 'charge', 'C'),
    q('v', 'speed', 'm/s'),
    q('b', 'magnetic flux density', 'T', { display: 'B' }),
    q('theta', 'angle between velocity and field', '°', { display: 'θ', defaultValue: 90 }),
  ]),

  define('wire-force', 'Force on a current-carrying wire', 'Magnetism', 'F = B·I·L·sin θ', 'f - b*curr*len*sin(theta*pi/180)', [
    q('f', 'force', 'N', { display: 'F' }),
    q('b', 'magnetic flux density', 'T', { display: 'B' }),
    q('curr', 'current', 'A', { display: 'I' }),
    q('len', 'length in the field', 'm', { display: 'L' }),
    q('theta', 'angle between wire and field', '°', { display: 'θ', defaultValue: 90 }),
  ]),

  define('magnetic-flux', 'Magnetic flux', 'Magnetism', 'Φ = B·A·cos θ', 'flux - b*area*cos(theta*pi/180)', [
    q('flux', 'magnetic flux', 'Wb', { display: 'Φ' }),
    q('b', 'magnetic flux density', 'T', { display: 'B' }),
    q('area', 'area', 'm²', { display: 'A' }),
    q('theta', 'angle to the normal', '°', { display: 'θ', defaultValue: 0 }),
  ]),

  define('faraday', "Faraday's law", 'Magnetism', 'EMF = −N·ΔΦ / Δt', 'emf - (-turns*dflux/dt)', [
    q('emf', 'induced electromotive force', 'V', { display: 'EMF' }),
    q('turns', 'number of turns', '—', { display: 'N' }),
    q('dflux', 'change in flux', 'Wb', { display: 'ΔΦ' }),
    q('dt', 'time taken', 's', { display: 'Δt' }),
  ], { positive: ['dt'], note: 'The minus sign is Lenz’s law: the induced EMF opposes the change in flux.' }),

  define('transformer', 'Ideal transformer', 'Magnetism', 'Vₛ / Vₚ = Nₛ / Nₚ', 'vs/vp - ns/np', [
    q('vs', 'secondary voltage', 'V', { display: 'Vs' }),
    q('vp', 'primary voltage', 'V', { display: 'Vp' }),
    q('ns', 'secondary turns', '—', { display: 'Ns' }),
    q('np', 'primary turns', '—', { display: 'Np' }),
  ], { positive: ['vp', 'ns', 'np'] }),

  /* --------------------------------- Optics -------------------------------- */
  define('snell', "Snell's law", 'Optics', 'n₁·sin θ₁ = n₂·sin θ₂', 'n1*sin(theta1*pi/180) - n2*sin(theta2*pi/180)', [
    q('n1', 'refractive index of the first medium', '—', { display: 'n₁', defaultValue: 1 }),
    q('theta1', 'angle of incidence', '°', { display: 'θ₁', defaultValue: 30 }),
    q('n2', 'refractive index of the second medium', '—', { display: 'n₂', defaultValue: 1.5 }),
    q('theta2', 'angle of refraction', '°', { display: 'θ₂' }),
  ], { positive: ['n1', 'n2'] }),

  define('critical-angle', 'Critical angle', 'Optics', 'sin θc = n₂ / n₁', 'sin(thetac*pi/180) - n2/n1', [
    q('thetac', 'critical angle', '°', { display: 'θc' }),
    q('n1', 'refractive index of the denser medium', '—', { display: 'n₁', defaultValue: 1.5 }),
    q('n2', 'refractive index of the lighter medium', '—', { display: 'n₂', defaultValue: 1 }),
  ], { positive: ['n1'], note: 'A critical angle exists only when the light starts in the denser medium (n₁ > n₂).' }),

  define('thin-lens', 'Thin lens equation', 'Optics', '1/f = 1/d₀ + 1/dᵢ', '1/f - (1/do + 1/di)', [
    q('f', 'focal length', 'm', { display: 'f' }),
    q('do', 'object distance', 'm', { display: 'd₀' }),
    q('di', 'image distance', 'm', { display: 'dᵢ' }),
  ], { note: 'A negative image distance means a virtual image on the same side as the object.' }),

  define('magnification', 'Linear magnification', 'Optics', 'm = −dᵢ / d₀', 'mag - (-di/do)', [
    q('mag', 'magnification', '—', { display: 'm' }),
    q('di', 'image distance', 'm', { display: 'dᵢ' }),
    q('do', 'object distance', 'm', { display: 'd₀' }),
  ], { positive: ['do'] }),

  /* --------------------------------- Fluids -------------------------------- */
  define('density', 'Density', 'Fluids', 'ρ = m / V', 'rho - m/vol', [
    q('rho', 'density', 'kg/m³', { display: 'ρ' }),
    q('m', 'mass', 'kg'),
    q('vol', 'volume', 'm³', { display: 'V' }),
  ], { positive: ['vol'] }),

  define('pressure', 'Pressure', 'Fluids', 'p = F / A', 'p - f/area', [
    q('p', 'pressure', 'Pa'),
    q('f', 'force', 'N', { display: 'F' }),
    q('area', 'area', 'm²', { display: 'A' }),
  ], { positive: ['area'] }),

  define('hydrostatic', 'Hydrostatic pressure', 'Fluids', 'p = p₀ + ρ·g·h', 'p - (p0 + rho*g*h)', [
    q('p', 'pressure at depth h', 'Pa'),
    q('p0', 'surface pressure', 'Pa', { display: 'p₀', ...ATM }),
    q('rho', 'density', 'kg/m³', { display: 'ρ', ...WATER }),
    q('g', 'gravitational field strength', 'm/s²', { display: 'g', ...GFIELD }),
    q('h', 'depth', 'm'),
  ], { positive: ['rho'] }),

  define('buoyancy', 'Buoyant force', 'Fluids', 'F = ρ·V·g', 'f - rho*vol*g', [
    q('f', 'buoyant force', 'N', { display: 'F' }),
    q('rho', 'fluid density', 'kg/m³', { display: 'ρ', ...WATER }),
    q('vol', 'displaced volume', 'm³', { display: 'V' }),
    q('g', 'gravitational field strength', 'm/s²', { display: 'g', ...GFIELD }),
  ], { positive: ['rho'] }),

  define('continuity', 'Equation of continuity', 'Fluids', 'A₁·v₁ = A₂·v₂', 'a1*v1 - a2*v2', [
    q('a1', 'first cross-sectional area', 'm²', { display: 'A₁' }),
    q('v1', 'first speed', 'm/s', { display: 'v₁' }),
    q('a2', 'second cross-sectional area', 'm²', { display: 'A₂' }),
    q('v2', 'second speed', 'm/s', { display: 'v₂' }),
  ], { positive: ['a1', 'a2'] }),

  define('flow-rate', 'Volume flow rate', 'Fluids', 'Q = A·v', 'flow - area*v', [
    q('flow', 'flow rate', 'm³/s', { display: 'Q' }),
    q('area', 'cross-sectional area', 'm²', { display: 'A' }),
    q('v', 'speed', 'm/s'),
  ]),

  /* ------------------------------ Modern physics --------------------------- */
  define('mass-energy', 'Mass–energy equivalence', 'Modern physics', 'E = m·c²', 'energy - m*light^2', [
    q('energy', 'energy', 'J', { display: 'E' }),
    q('m', 'mass', 'kg'),
    q('light', 'speed of light', 'm/s', { display: 'c', ...LIGHT }),
  ], { positive: ['m'] }),

  define('photon-energy', 'Photon energy', 'Modern physics', 'E = h·f', 'energy - h*freq', [
    q('energy', 'energy', 'J', { display: 'E' }),
    q('h', 'Planck constant', 'J·s', { ...PLANCK }),
    q('freq', 'frequency', 'Hz', { display: 'f' }),
  ]),

  define('photon-wavelength', 'Photon energy from wavelength', 'Modern physics', 'E = h·c / λ', 'energy - h*light/lambda', [
    q('energy', 'energy', 'J', { display: 'E' }),
    q('h', 'Planck constant', 'J·s', { ...PLANCK }),
    q('light', 'speed of light', 'm/s', { display: 'c', ...LIGHT }),
    q('lambda', 'wavelength', 'm', { display: 'λ' }),
  ], { positive: ['lambda'] }),

  define('photoelectric', 'Photoelectric effect', 'Modern physics', 'Eₖ = h·f − φ', 'ek - (h*freq - phi)', [
    q('ek', 'maximum kinetic energy', 'J', { display: 'Ek' }),
    q('h', 'Planck constant', 'J·s', { ...PLANCK }),
    q('freq', 'frequency', 'Hz', { display: 'f' }),
    q('phi', 'work function', 'J', { display: 'φ' }),
  ], {
    nonNegative: ['ek'],
    note: 'If the photon energy h·f is below the work function φ the metal emits no electrons at all.',
  }),

  define('de-broglie', 'de Broglie wavelength', 'Modern physics', 'λ = h / p', 'lambda - h/mom', [
    q('lambda', 'wavelength', 'm', { display: 'λ' }),
    q('h', 'Planck constant', 'J·s', { ...PLANCK }),
    q('mom', 'momentum', 'kg·m/s', { display: 'p' }),
  ], { positive: ['mom'] }),

  define('half-life', 'Half-life decay', 'Modern physics', 'N = N₀·(½)^(t/T½)', 'amount - n0*0.5^(t/thalf)', [
    q('amount', 'remaining amount', '—', { display: 'N' }),
    q('n0', 'initial amount', '—', { display: 'N₀' }),
    q('t', 'elapsed time', 's'),
    q('thalf', 'half-life', 's', { display: 'T½' }),
  ], { positive: ['thalf'], nonNegative: ['t', 'amount'] }),

  define('decay-constant', 'Activity and decay constant', 'Modern physics', 'A = λ·N', 'activity - lambda*amount', [
    q('activity', 'activity', 'Bq', { display: 'A' }),
    q('lambda', 'decay constant', '1/s', { display: 'λ' }),
    q('amount', 'number of nuclei', '—', { display: 'N' }),
  ], { positive: ['lambda'], nonNegative: ['activity'] }),
];

export function getPhysicsFormula(id: string): PhysicsFormula | undefined {
  return PHYSICS_FORMULAS.find((formula) => formula.id === id);
}

/** Free-text search across names, relations, symbols, units and categories. */
export function searchPhysicsFormulas(query: string): PhysicsFormula[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...PHYSICS_FORMULAS];
  const parts = needle.split(/\s+/);
  return PHYSICS_FORMULAS.filter((formula) => {
    const haystack = [
      formula.name,
      formula.relation,
      formula.category,
      formula.note ?? '',
      ...formula.quantities.flatMap((quantity) => [
        quantity.symbol,
        quantity.display ?? '',
        quantity.name,
        quantity.unit,
      ]),
    ]
      .join(' ')
      .toLowerCase();
    return parts.every((part) => haystack.includes(part));
  });
}
