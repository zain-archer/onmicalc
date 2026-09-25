import { FunctionRegistry } from '../registry';
import { BASIC_FUNCTIONS } from './basic';
import { SCIENTIFIC_FUNCTIONS } from './scientific';

/** Builds the default engine registry from every function module. */
export function createDefaultRegistry(): FunctionRegistry {
  return new FunctionRegistry([...BASIC_FUNCTIONS, ...SCIENTIFIC_FUNCTIONS]);
}

export { BASIC_FUNCTIONS, SCIENTIFIC_FUNCTIONS };
