/**
 * Thin adapters between the knowledge base and the unit converter, so knowledge
 * lookups do not need to know how conversions are implemented.
 */

import { CATEGORIES, categoryById } from '@/conversions/definitions';
import type { UnitCategory, UnitDef } from '@/conversions/engine';

export type { UnitCategory, UnitDef };

export const UNIT_CATEGORIES_FOR_LOOKUP = CATEGORIES;

function matches(unit: UnitDef, needle: string): boolean {
  const lower = needle.trim().toLowerCase();
  return (
    unit.id.toLowerCase() === lower ||
    unit.symbol.toLowerCase() === lower ||
    unit.label.toLowerCase() === lower ||
    (unit.aliases ?? []).some((alias) => alias.toLowerCase() === lower)
  );
}

/** Find a unit anywhere in the converter, e.g. "nm", "joule", "knots". */
export function findAnyUnit(word: string): UnitDef | undefined {
  const needle = word.replace(/^(the|a|an)\s+/i, '').trim();
  if (!needle) return undefined;
  for (const category of CATEGORIES) {
    const found = category.units.find((unit) => matches(unit, needle));
    if (found) return found;
  }
  return undefined;
}

export function categoryOfUnit(unit: UnitDef): string | undefined {
  for (const category of CATEGORIES) {
    if (category.units.some((candidate) => candidate.id === unit.id)) return category.label;
  }
  return undefined;
}

/** Every unit name/symbol/alias with its category, for "what does 'N' mean". */
export function unitWordsWithCategories(): { word: string; category: string; label: string; symbol: string }[] {
  const words: { word: string; category: string; label: string; symbol: string }[] = [];
  for (const category of CATEGORIES) {
    for (const unit of category.units) {
      for (const word of [unit.label, unit.symbol, ...(unit.aliases ?? [])]) {
        if (word) words.push({ word: word.toLowerCase(), category: category.label, label: unit.label, symbol: unit.symbol });
      }
    }
  }
  return words;
}

export function categoryLabel(id: string): string {
  return categoryById(id)?.label ?? id;
}
