import { useMemo, useState } from 'react';
import { CATEGORIES, categoryById } from '@/conversions/definitions';
import { convert, convertAll, type UnitDef } from '@/conversions/engine';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { appendToDraft } from '@/ui/bus';
import { CopyButton, Notice, NumberField, OutputList, SelectField, Tabs } from '@/ui/components/primitives';

const TABS = CATEGORIES.map((category) => ({ id: category.id, label: category.label }));

export function ConversionsPanel() {
  const settings = useSettings();
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]!.id);
  const category = categoryById(categoryId) ?? CATEGORIES[0]!;

  const [fromId, setFromId] = useState(category.baseUnit);
  const [toId, setToId] = useState(category.units[category.units.length - 1]!.id);
  const [amount, setAmount] = useState<number | ''>(1);

  // Keep the chosen units valid when the category changes.
  const activeCategory = category;
  const validFrom = activeCategory.units.some((unit) => unit.id === fromId) ? fromId : activeCategory.baseUnit;
  const validTo = activeCategory.units.some((unit) => unit.id === toId)
    ? toId
    : activeCategory.units[activeCategory.units.length - 1]!.id;

  const formatOptions = useMemo(
    () => ({
      precision: settings.precision,
      numberFormat: settings.numberFormat,
      thousandsSeparator: settings.thousandsSeparator,
    }),
    [settings],
  );

  const result = useMemo(() => {
    if (amount === '') return { ok: false as const, message: 'Enter a value to convert.' };
    try {
      return { ok: true as const, value: convert(activeCategory, amount, validFrom, validTo) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [activeCategory, amount, validFrom, validTo]);

  const allUnits = useMemo(() => {
    if (amount === '') return [];
    try {
      return convertAll(activeCategory, amount, validFrom);
    } catch {
      return [];
    }
  }, [activeCategory, amount, validFrom]);

  const fromUnit = activeCategory.units.find((unit) => unit.id === validFrom)!;
  const toUnit = activeCategory.units.find((unit) => unit.id === validTo)!;

  const swap = () => {
    setFromId(validTo);
    setToId(validFrom);
  };

  return (
    <div className="stack">
      <section className="card">
        <Tabs tabs={TABS} value={activeCategory.id} onChange={(id) => setCategoryId(id)} label="Conversion category" />
        <div className="converter">
          <NumberField
            label="Value"
            value={amount}
            onChange={setAmount}
            step={1}
            hint={`in ${fromUnit.label} (${fromUnit.symbol})`}
          />
          <SelectField
            label="From"
            value={validFrom}
            onChange={setFromId}
            options={unitOptions(activeCategory.units)}
          />
          <button type="button" className="btn btn--small converter__swap" onClick={swap} title="Swap units">
            ⇄ Swap
          </button>
          <SelectField label="To" value={validTo} onChange={setToId} options={unitOptions(activeCategory.units)} />
        </div>

        <div className="converter__result" aria-live="polite">
          {result.ok ? (
            <>
              <strong className="converter__value">{formatNumber(result.value, formatOptions)}</strong>
              <span className="converter__unit">{toUnit.symbol}</span>
              <CopyButton text={`${formatNumber(result.value, formatOptions)} ${toUnit.symbol}`} label="Copy" />
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => appendToDraft(String(result.value))}
                title="Send the converted value to the calculator"
              >
                Use in calculator
              </button>
            </>
          ) : (
            <span className="notice notice--error" role="alert">
              {result.message}
            </span>
          )}
        </div>
      </section>

      {allUnits.length > 0 ? (
        <section className="card">
          <h2>All {activeCategory.label.toLowerCase()} units</h2>
          <OutputList
            rows={allUnits.map(({ unit, value }) => ({
              label: `${unit.label} (${unit.symbol})`,
              value: formatNumber(value, formatOptions),
              emphasize: unit.id === validTo,
            }))}
          />
          <Notice>Factors follow NIST SP 811 / SI definitions; temperature uses affine (not ratio) scales.</Notice>
        </section>
      ) : null}
    </div>
  );
}

function unitOptions(units: readonly UnitDef[]) {
  return units.map((unit) => ({ value: unit.id, label: `${unit.label} (${unit.symbol})` }));
}
