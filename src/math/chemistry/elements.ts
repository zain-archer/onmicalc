/**
 * Periodic table data.
 *
 * One tuple per element: atomic number, symbol, name, relative atomic mass,
 * category, group, period. Masses are the standard atomic weights (IUPAC);
 * elements with no stable isotope carry the mass number of their most stable
 * isotope, which is why they appear as whole numbers — the `synthetic` flag
 * says so, so nothing pretends to more precision than exists.
 */

export type ElementCategory =
  | 'Alkali metal'
  | 'Alkaline earth metal'
  | 'Transition metal'
  | 'Post-transition metal'
  | 'Metalloid'
  | 'Nonmetal'
  | 'Halogen'
  | 'Noble gas'
  | 'Lanthanide'
  | 'Actinide'
  | 'Unknown';

export interface Element {
  atomicNumber: number;
  symbol: string;
  name: string;
  /** Relative atomic mass (standard atomic weight, or mass number if unstable). */
  mass: number;
  category: ElementCategory;
  group: number;
  period: number;
  block: 's' | 'p' | 'd' | 'f';
  /** True when the mass is the mass number of the most stable known isotope. */
  synthetic?: boolean;
}

type Row = [number, string, string, number, ElementCategory, number, number];

const ROWS: readonly Row[] = [
  [1, 'H', 'Hydrogen', 1.008, 'Nonmetal', 1, 1],
  [2, 'He', 'Helium', 4.002602, 'Noble gas', 18, 1],
  [3, 'Li', 'Lithium', 6.94, 'Alkali metal', 1, 2],
  [4, 'Be', 'Beryllium', 9.0121831, 'Alkaline earth metal', 2, 2],
  [5, 'B', 'Boron', 10.81, 'Metalloid', 13, 2],
  [6, 'C', 'Carbon', 12.011, 'Nonmetal', 14, 2],
  [7, 'N', 'Nitrogen', 14.007, 'Nonmetal', 15, 2],
  [8, 'O', 'Oxygen', 15.999, 'Nonmetal', 16, 2],
  [9, 'F', 'Fluorine', 18.998403163, 'Halogen', 17, 2],
  [10, 'Ne', 'Neon', 20.1797, 'Noble gas', 18, 2],
  [11, 'Na', 'Sodium', 22.98976928, 'Alkali metal', 1, 3],
  [12, 'Mg', 'Magnesium', 24.305, 'Alkaline earth metal', 2, 3],
  [13, 'Al', 'Aluminium', 26.9815385, 'Post-transition metal', 13, 3],
  [14, 'Si', 'Silicon', 28.085, 'Metalloid', 14, 3],
  [15, 'P', 'Phosphorus', 30.973761998, 'Nonmetal', 15, 3],
  [16, 'S', 'Sulfur', 32.06, 'Nonmetal', 16, 3],
  [17, 'Cl', 'Chlorine', 35.45, 'Halogen', 17, 3],
  [18, 'Ar', 'Argon', 39.948, 'Noble gas', 18, 3],
  [19, 'K', 'Potassium', 39.0983, 'Alkali metal', 1, 4],
  [20, 'Ca', 'Calcium', 40.078, 'Alkaline earth metal', 2, 4],
  [21, 'Sc', 'Scandium', 44.955908, 'Transition metal', 3, 4],
  [22, 'Ti', 'Titanium', 47.867, 'Transition metal', 4, 4],
  [23, 'V', 'Vanadium', 50.9415, 'Transition metal', 5, 4],
  [24, 'Cr', 'Chromium', 51.9961, 'Transition metal', 6, 4],
  [25, 'Mn', 'Manganese', 54.938044, 'Transition metal', 7, 4],
  [26, 'Fe', 'Iron', 55.845, 'Transition metal', 8, 4],
  [27, 'Co', 'Cobalt', 58.933194, 'Transition metal', 9, 4],
  [28, 'Ni', 'Nickel', 58.6934, 'Transition metal', 10, 4],
  [29, 'Cu', 'Copper', 63.546, 'Transition metal', 11, 4],
  [30, 'Zn', 'Zinc', 65.38, 'Transition metal', 12, 4],
  [31, 'Ga', 'Gallium', 69.723, 'Post-transition metal', 13, 4],
  [32, 'Ge', 'Germanium', 72.63, 'Metalloid', 14, 4],
  [33, 'As', 'Arsenic', 74.921595, 'Metalloid', 15, 4],
  [34, 'Se', 'Selenium', 78.971, 'Nonmetal', 16, 4],
  [35, 'Br', 'Bromine', 79.904, 'Halogen', 17, 4],
  [36, 'Kr', 'Krypton', 83.798, 'Noble gas', 18, 4],
  [37, 'Rb', 'Rubidium', 85.4678, 'Alkali metal', 1, 5],
  [38, 'Sr', 'Strontium', 87.62, 'Alkaline earth metal', 2, 5],
  [39, 'Y', 'Yttrium', 88.90584, 'Transition metal', 3, 5],
  [40, 'Zr', 'Zirconium', 91.224, 'Transition metal', 4, 5],
  [41, 'Nb', 'Niobium', 92.90637, 'Transition metal', 5, 5],
  [42, 'Mo', 'Molybdenum', 95.95, 'Transition metal', 6, 5],
  [43, 'Tc', 'Technetium', 98, 'Transition metal', 7, 5, ],
  [44, 'Ru', 'Ruthenium', 101.07, 'Transition metal', 8, 5],
  [45, 'Rh', 'Rhodium', 102.9055, 'Transition metal', 9, 5],
  [46, 'Pd', 'Palladium', 106.42, 'Transition metal', 10, 5],
  [47, 'Ag', 'Silver', 107.8682, 'Transition metal', 11, 5],
  [48, 'Cd', 'Cadmium', 112.414, 'Transition metal', 12, 5],
  [49, 'In', 'Indium', 114.818, 'Post-transition metal', 13, 5],
  [50, 'Sn', 'Tin', 118.71, 'Post-transition metal', 14, 5],
  [51, 'Sb', 'Antimony', 121.76, 'Metalloid', 15, 5],
  [52, 'Te', 'Tellurium', 127.6, 'Metalloid', 16, 5],
  [53, 'I', 'Iodine', 126.90447, 'Halogen', 17, 5],
  [54, 'Xe', 'Xenon', 131.293, 'Noble gas', 18, 5],
  [55, 'Cs', 'Caesium', 132.90545196, 'Alkali metal', 1, 6],
  [56, 'Ba', 'Barium', 137.327, 'Alkaline earth metal', 2, 6],
  [57, 'La', 'Lanthanum', 138.90547, 'Lanthanide', 3, 6],
  [58, 'Ce', 'Cerium', 140.116, 'Lanthanide', 3, 6],
  [59, 'Pr', 'Praseodymium', 140.90766, 'Lanthanide', 3, 6],
  [60, 'Nd', 'Neodymium', 144.242, 'Lanthanide', 3, 6],
  [61, 'Pm', 'Promethium', 145, 'Lanthanide', 3, 6],
  [62, 'Sm', 'Samarium', 150.36, 'Lanthanide', 3, 6],
  [63, 'Eu', 'Europium', 151.964, 'Lanthanide', 3, 6],
  [64, 'Gd', 'Gadolinium', 157.25, 'Lanthanide', 3, 6],
  [65, 'Tb', 'Terbium', 158.92535, 'Lanthanide', 3, 6],
  [66, 'Dy', 'Dysprosium', 162.5, 'Lanthanide', 3, 6],
  [67, 'Ho', 'Holmium', 164.93033, 'Lanthanide', 3, 6],
  [68, 'Er', 'Erbium', 167.259, 'Lanthanide', 3, 6],
  [69, 'Tm', 'Thulium', 168.93422, 'Lanthanide', 3, 6],
  [70, 'Yb', 'Ytterbium', 173.045, 'Lanthanide', 3, 6],
  [71, 'Lu', 'Lutetium', 174.9668, 'Lanthanide', 3, 6],
  [72, 'Hf', 'Hafnium', 178.49, 'Transition metal', 4, 6],
  [73, 'Ta', 'Tantalum', 180.94788, 'Transition metal', 5, 6],
  [74, 'W', 'Tungsten', 183.84, 'Transition metal', 6, 6],
  [75, 'Re', 'Rhenium', 186.207, 'Transition metal', 7, 6],
  [76, 'Os', 'Osmium', 190.23, 'Transition metal', 8, 6],
  [77, 'Ir', 'Iridium', 192.217, 'Transition metal', 9, 6],
  [78, 'Pt', 'Platinum', 195.084, 'Transition metal', 10, 6],
  [79, 'Au', 'Gold', 196.966569, 'Transition metal', 11, 6],
  [80, 'Hg', 'Mercury', 200.592, 'Transition metal', 12, 6],
  [81, 'Tl', 'Thallium', 204.38, 'Post-transition metal', 13, 6],
  [82, 'Pb', 'Lead', 207.2, 'Post-transition metal', 14, 6],
  [83, 'Bi', 'Bismuth', 208.9804, 'Post-transition metal', 15, 6],
  [84, 'Po', 'Polonium', 209, 'Post-transition metal', 16, 6],
  [85, 'At', 'Astatine', 210, 'Halogen', 17, 6],
  [86, 'Rn', 'Radon', 222, 'Noble gas', 18, 6],
  [87, 'Fr', 'Francium', 223, 'Alkali metal', 1, 7],
  [88, 'Ra', 'Radium', 226, 'Alkaline earth metal', 2, 7],
  [89, 'Ac', 'Actinium', 227, 'Actinide', 3, 7],
  [90, 'Th', 'Thorium', 232.0377, 'Actinide', 3, 7],
  [91, 'Pa', 'Protactinium', 231.03588, 'Actinide', 3, 7],
  [92, 'U', 'Uranium', 238.02891, 'Actinide', 3, 7],
  [93, 'Np', 'Neptunium', 237, 'Actinide', 3, 7],
  [94, 'Pu', 'Plutonium', 244, 'Actinide', 3, 7],
  [95, 'Am', 'Americium', 243, 'Actinide', 3, 7],
  [96, 'Cm', 'Curium', 247, 'Actinide', 3, 7],
  [97, 'Bk', 'Berkelium', 247, 'Actinide', 3, 7],
  [98, 'Cf', 'Californium', 251, 'Actinide', 3, 7],
  [99, 'Es', 'Einsteinium', 252, 'Actinide', 3, 7],
  [100, 'Fm', 'Fermium', 257, 'Actinide', 3, 7],
  [101, 'Md', 'Mendelevium', 258, 'Actinide', 3, 7],
  [102, 'No', 'Nobelium', 259, 'Actinide', 3, 7],
  [103, 'Lr', 'Lawrencium', 266, 'Actinide', 3, 7],
  [104, 'Rf', 'Rutherfordium', 267, 'Transition metal', 4, 7],
  [105, 'Db', 'Dubnium', 268, 'Transition metal', 5, 7],
  [106, 'Sg', 'Seaborgium', 269, 'Transition metal', 6, 7],
  [107, 'Bh', 'Bohrium', 270, 'Transition metal', 7, 7],
  [108, 'Hs', 'Hassium', 269, 'Transition metal', 8, 7],
  [109, 'Mt', 'Meitnerium', 278, 'Unknown', 9, 7],
  [110, 'Ds', 'Darmstadtium', 281, 'Unknown', 10, 7],
  [111, 'Rg', 'Roentgenium', 282, 'Unknown', 11, 7],
  [112, 'Cn', 'Copernicium', 285, 'Transition metal', 12, 7],
  [113, 'Nh', 'Nihonium', 286, 'Post-transition metal', 13, 7],
  [114, 'Fl', 'Flerovium', 289, 'Post-transition metal', 14, 7],
  [115, 'Mc', 'Moscovium', 290, 'Post-transition metal', 15, 7],
  [116, 'Lv', 'Livermorium', 293, 'Post-transition metal', 16, 7],
  [117, 'Ts', 'Tennessine', 294, 'Halogen', 17, 7],
  [118, 'Og', 'Oganesson', 294, 'Noble gas', 18, 7],
];

/** Atomic numbers whose mass is a mass number rather than a standard weight. */
const SYNTHETIC = new Set([
  43, 61, 84, 85, 86, 87, 88, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
  110, 111, 112, 113, 114, 115, 116, 117, 118,
]);

function blockOf(group: number, period: number, atomicNumber: number): 's' | 'p' | 'd' | 'f' {
  const lanthanides = atomicNumber >= 57 && atomicNumber <= 71;
  const actinides = atomicNumber >= 89 && atomicNumber <= 103;
  if (lanthanides || actinides) return 'f';
  if (group <= 2) return 's';
  if (group >= 13) return 'p';
  void period;
  return 'd';
}

export const ELEMENTS: readonly Element[] = ROWS.map(([atomicNumber, symbol, name, mass, category, group, period]) => ({
  atomicNumber,
  symbol,
  name,
  mass,
  category,
  group,
  period,
  block: blockOf(group, period, atomicNumber),
  ...(SYNTHETIC.has(atomicNumber) ? { synthetic: true } : {}),
}));

const BY_SYMBOL = new Map(ELEMENTS.map((element) => [element.symbol.toLowerCase(), element]));

export function getElement(identifier: string | number): Element | undefined {
  if (typeof identifier === 'number') return ELEMENTS.find((element) => element.atomicNumber === identifier);
  const needle = identifier.trim().toLowerCase();
  if (!needle) return undefined;
  const bySymbol = BY_SYMBOL.get(needle);
  if (bySymbol) return bySymbol;
  if (/^\d+$/.test(needle)) return ELEMENTS.find((element) => element.atomicNumber === Number(needle));
  return ELEMENTS.find((element) => element.name.toLowerCase() === needle);
}

/** Free-text search over symbols, names, categories, group and period. */
export function searchElements(query: string): Element[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...ELEMENTS];
  return ELEMENTS.filter((element) =>
    [element.symbol, element.name, element.category, `group ${element.group}`, `period ${element.period}`, String(element.atomicNumber)]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}

/** Molar mass of one atom in g/mol. */
export function atomicMass(symbol: string): number {
  const element = getElement(symbol);
  if (!element) throw new Error(`Unknown element symbol “${symbol}”`);
  return element.mass;
}

export const ELEMENT_CATEGORIES: readonly ElementCategory[] = [
  'Alkali metal',
  'Alkaline earth metal',
  'Transition metal',
  'Post-transition metal',
  'Metalloid',
  'Nonmetal',
  'Halogen',
  'Noble gas',
  'Lanthanide',
  'Actinide',
  'Unknown',
];
