import type { Capability } from '../types';
import { calculateCapability, discountCapability, percentChangeCapability, percentOfCapability, percentRatioCapability, tipCapability } from './everyday';
import { convertUnitsCapability, listUnitsCapability } from './units';
import { solveEquationCapability, solveSystemCapability } from './algebra';
import { derivativeCapability, integralCapability, limitCapability, plotAnalysisCapability, seriesCapability } from './calculus';
import { probabilityCapability, regressionCapability, statisticsCapability } from './stats';
import { matrixCapability, vectorCapability } from './matrices';
import { capacitorCapability, geometryCapability, ohmsLawCapability, physicsQuantityCapability } from './physics';
import { dateTimeCapability, interestCapability, splitBillCapability } from './money';

/** Every capability the Ask panel can use, in no particular order (the scorer ranks them). */
const CAPABILITIES: Capability[] = [
  calculateCapability,
  percentOfCapability,
  percentRatioCapability,
  percentChangeCapability,
  discountCapability,
  tipCapability,
  splitBillCapability,
  convertUnitsCapability,
  listUnitsCapability,
  solveEquationCapability,
  solveSystemCapability,
  plotAnalysisCapability,
  derivativeCapability,
  integralCapability,
  limitCapability,
  seriesCapability,
  statisticsCapability,
  regressionCapability,
  probabilityCapability,
  matrixCapability,
  vectorCapability,
  physicsQuantityCapability,
  ohmsLawCapability,
  capacitorCapability,
  geometryCapability,
  interestCapability,
  dateTimeCapability,
];

export function everyCapability(): Capability[] {
  return CAPABILITIES;
}

export function capabilityById(id: string): Capability | undefined {
  return CAPABILITIES.find((capability) => capability.id === id);
}
