import { useMemo, useState } from 'react';
import * as eng from '@/engineering';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { appendToDraft } from '@/ui/bus';
import { CopyButton, Notice, NumberField, OutputList, Tabs, TextField } from '@/ui/components/primitives';

const TABS = [
  { id: 'electrical', label: 'Electrical' },
  { id: 'physics', label: 'Physics' },
  { id: 'geometry', label: 'Geometry' },
] as const;

export function EngineeringPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('electrical');
  return (
    <div className="stack">
      <Tabs tabs={TABS} value={tab} onChange={(id) => setTab(id as typeof tab)} label="Engineering area" />
      {tab === 'electrical' ? <ElectricalTool /> : null}
      {tab === 'physics' ? <PhysicsTool /> : null}
      {tab === 'geometry' ? <GeometryTool /> : null}
    </div>
  );
}

function ElectricalTool() {
  const settings = useSettings();
  const [voltage, setVoltage] = useState<number | ''>(12);
  const [current, setCurrent] = useState<number | ''>(2);
  const [resistance, setResistance] = useState<number | ''>('');
  const [power, setPower] = useState<number | ''>('');
  const [series, setSeries] = useState('100, 220, 470');
  const [parallel, setParallel] = useState('100, 100');
  const [capacitance, setCapacitance] = useState<number | ''>(0.001);
  const [capVoltage, setCapVoltage] = useState<number | ''>(100);
  const [rcResistance, setRcResistance] = useState<number | ''>(1000);
  const [rcCapacitance, setRcCapacitance] = useState<number | ''>(1e-6);

  const precision = settings.precision;
  const nf = (value: number) => formatNumber(value, { precision });

  const ohm = useMemo(() => {
    const known: Record<string, number> = {};
    if (voltage !== '') known.voltage = voltage;
    if (current !== '') known.current = current;
    if (resistance !== '') known.resistance = resistance;
    if (power !== '') known.power = power;
    try {
      return { ok: true as const, result: eng.ohmsLaw(known) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [voltage, current, resistance, power]);

  const parseList = (text: string) => text.split(/[\s,;]+/).filter(Boolean).map(Number);

  const network = useMemo(() => {
    try {
      const seriesValues = parseList(series);
      const parallelValues = parseList(parallel);
      return {
        ok: true as const,
        series: seriesValues.length ? eng.seriesResistance(seriesValues) : null,
        parallel: parallelValues.length ? eng.parallelResistance(parallelValues) : null,
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [series, parallel]);

  const capacitor = useMemo(() => {
    if (capacitance === '' || capVoltage === '') return null;
    try {
      return {
        ok: true as const,
        energy: eng.capacitorEnergy(capacitance, capVoltage).energy,
        charge: eng.capacitorCharge(capacitance, capVoltage),
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [capacitance, capVoltage]);

  const rc = useMemo(() => {
    if (rcResistance === '' || rcCapacitance === '') return null;
    try {
      return { ok: true as const, ...eng.rcTimeConstant(rcResistance, rcCapacitance) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [rcResistance, rcCapacitance]);

  return (
    <>
      <section className="card">
        <h2>Ohm’s law and power</h2>
        <p>Enter exactly two values; the other two are calculated.</p>
        <div className="grid grid--form">
          <NumberField label="Voltage" unit="V" value={voltage} onChange={setVoltage} step={0.1} />
          <NumberField label="Current" unit="A" value={current} onChange={setCurrent} step={0.1} />
          <NumberField label="Resistance" unit="Ω" value={resistance} onChange={setResistance} step={1} />
          <NumberField label="Power" unit="W" value={power} onChange={setPower} step={1} />
        </div>
        {ohm.ok ? (
          <OutputList
            rows={[
              { label: 'Voltage', value: nf(ohm.result.voltage), unit: 'V' },
              { label: 'Current', value: nf(ohm.result.current), unit: 'A' },
              { label: 'Resistance', value: nf(ohm.result.resistance), unit: 'Ω' },
              { label: 'Power', value: nf(ohm.result.power), unit: 'W', emphasize: true },
            ]}
          />
        ) : (
          <Notice kind="error">{ohm.message}</Notice>
        )}
      </section>

      <section className="card">
        <h2>Resistor networks</h2>
        <div className="grid grid--form">
          <TextField label="Series resistors" unit="Ω" value={series} onChange={setSeries} hint="Comma separated." />
          <TextField label="Parallel resistors" unit="Ω" value={parallel} onChange={setParallel} hint="Comma separated." />
        </div>
        {network.ok ? (
          <OutputList
            rows={[
              ...(network.series !== null ? [{ label: 'Series total', value: nf(network.series), unit: 'Ω', emphasize: true }] : []),
              ...(network.parallel !== null ? [{ label: 'Parallel total', value: nf(network.parallel), unit: 'Ω' }] : []),
            ]}
          />
        ) : (
          <Notice kind="error">{network.message}</Notice>
        )}
      </section>

      <section className="card">
        <h2>Capacitors</h2>
        <div className="grid grid--form">
          <NumberField label="Capacitance" unit="F" value={capacitance} onChange={setCapacitance} step={0.0001} />
          <NumberField label="Voltage" unit="V" value={capVoltage} onChange={setCapVoltage} step={1} />
          <NumberField label="RC resistance" unit="Ω" value={rcResistance} onChange={setRcResistance} step={10} />
          <NumberField label="RC capacitance" unit="F" value={rcCapacitance} onChange={setRcCapacitance} step={1e-6} />
        </div>
        {capacitor?.ok ? (
          <OutputList
            rows={[
              { label: 'Stored energy', value: nf(capacitor.energy), unit: 'J', emphasize: true },
              { label: 'Charge', value: nf(capacitor.charge), unit: 'C' },
            ]}
          />
        ) : (
          <Notice kind="error">{capacitor && 'message' in capacitor ? capacitor.message : 'Enter capacitance and voltage.'}</Notice>
        )}
        {rc?.ok ? (
          <OutputList
            rows={[
              { label: 'Time constant τ', value: nf(rc.tau), unit: 's' },
              { label: 'Half-life (τ·ln2)', value: nf(rc.halfLife), unit: 's' },
            ]}
          />
        ) : null}
      </section>
    </>
  );
}

function PhysicsTool() {
  const settings = useSettings();
  const [mass, setMass] = useState<number | ''>(10);
  const [acceleration, setAcceleration] = useState<number | ''>(2);
  const [velocity, setVelocity] = useState<number | ''>(3);
  const [height, setHeight] = useState<number | ''>(10);
  const [distance, setDistance] = useState<number | ''>(5);
  const [time, setTime] = useState<number | ''>(2);
  const [force, setForce] = useState<number | ''>(100);
  const [area, setArea] = useState<number | ''>(4);
  const [volume, setVolume] = useState<number | ''>(2);

  const precision = settings.precision;
  const nf = (value: number) => formatNumber(value, { precision });

  const rows: { label: string; value: string; unit?: string; emphasize?: boolean }[] = [];
  try {
    if (mass !== '' && acceleration !== '') rows.push({ label: 'Force (F = ma)', value: nf(eng.force(mass, acceleration)), unit: 'N', emphasize: true });
    if (mass !== '') rows.push({ label: 'Weight on Earth', value: nf(eng.weight(mass)), unit: 'N' });
    if (force !== '' && distance !== '') rows.push({ label: 'Work (F·d)', value: nf(eng.work(force, distance)), unit: 'J' });
    if (mass !== '' && velocity !== '') {
      rows.push({ label: 'Kinetic energy', value: nf(eng.kineticEnergy(mass, velocity)), unit: 'J' });
      rows.push({ label: 'Momentum', value: nf(eng.momentum(mass, velocity)), unit: 'kg·m/s' });
    }
    if (mass !== '' && height !== '') rows.push({ label: 'Potential energy', value: nf(eng.potentialEnergy(mass, height)), unit: 'J' });
    if (force !== '' && area !== '') rows.push({ label: 'Pressure (F/A)', value: nf(eng.pressure(force, area)), unit: 'Pa' });
    if (mass !== '' && volume !== '') rows.push({ label: 'Density (m/V)', value: nf(eng.density(mass, volume)), unit: 'kg/m³' });
    if (distance !== '' && time !== '') rows.push({ label: 'Velocity (d/t)', value: nf(eng.velocity(distance, time)), unit: 'm/s' });
    if (velocity !== '' && time !== '') rows.push({ label: 'Acceleration (Δv/t)', value: nf(eng.acceleration(velocity, time)), unit: 'm/s²' });
  } catch (err) {
    return (
      <section className="card">
        <Notice kind="error">{errorMessage(err)}</Notice>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Physics calculators</h2>
      <div className="grid grid--form">
        <NumberField label="Mass" unit="kg" value={mass} onChange={setMass} step={0.1} />
        <NumberField label="Acceleration" unit="m/s²" value={acceleration} onChange={setAcceleration} step={0.1} />
        <NumberField label="Velocity / Δv" unit="m/s" value={velocity} onChange={setVelocity} step={0.1} />
        <NumberField label="Height" unit="m" value={height} onChange={setHeight} step={0.1} />
        <NumberField label="Distance" unit="m" value={distance} onChange={setDistance} step={0.1} />
        <NumberField label="Time" unit="s" value={time} onChange={setTime} step={0.1} />
        <NumberField label="Force" unit="N" value={force} onChange={setForce} step={1} />
        <NumberField label="Area" unit="m²" value={area} onChange={setArea} step={0.1} />
        <NumberField label="Volume" unit="m³" value={volume} onChange={setVolume} step={0.1} />
      </div>
      {rows.length === 0 ? (
        <Notice>Fill in the quantities you have; OmniCalc computes everything it can.</Notice>
      ) : (
        <OutputList rows={rows} />
      )}
    </section>
  );
}

function GeometryTool() {
  const settings = useSettings();
  const [shape, setShape] = useState('circle');
  const [a, setA] = useState<number | ''>(3);
  const [b, setB] = useState<number | ''>(4);
  const [c, setC] = useState<number | ''>(5);

  const precision = settings.precision;
  const nf = (value: number) => formatNumber(value, { precision });

  const outcome = useMemo(() => {
    if (a === '') return { ok: false as const, message: 'Enter the first dimension.' };
    try {
      switch (shape) {
        case 'circle':
          return { ok: true as const, result: eng.circle(a) };
        case 'rectangle':
          return { ok: true as const, result: eng.rectangle(a, b === '' ? a : b) };
        case 'square':
          return { ok: true as const, result: eng.square(a) };
        case 'triangle':
          return { ok: true as const, result: eng.triangle(a, b === '' ? a : b, c === '' ? a : c) };
        case 'cube':
          return { ok: true as const, result: eng.cube(a) };
        case 'box':
          return { ok: true as const, result: eng.rectangularPrism(a, b === '' ? a : b, c === '' ? a : c) };
        case 'cylinder':
          return { ok: true as const, result: eng.cylinder(a, b === '' ? a : b) };
        case 'sphere':
          return { ok: true as const, result: eng.sphere(a) };
        default:
          return { ok: true as const, result: eng.cone(a, b === '' ? a : b) };
      }
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [shape, a, b, c]);

  const labels = shapeLabels(shape);

  return (
    <section className="card">
      <h2>Geometry</h2>
      <div className="grid grid--form">
        <label className="field">
          <span className="field__label">Shape</span>
          <select className="field__input" value={shape} onChange={(event) => setShape(event.target.value)}>
            {['circle', 'rectangle', 'square', 'triangle', 'cube', 'box', 'cylinder', 'sphere', 'cone'].map((value) => (
              <option key={value} value={value}>
                {value[0]!.toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <NumberField label={labels.a} value={a} onChange={setA} step={0.1} />
        <NumberField label={labels.b ?? 'Second dimension'} value={b} onChange={setB} step={0.1} />
        {labels.c ? <NumberField label={labels.c} value={c} onChange={setC} step={0.1} /> : null}
      </div>
      {!outcome.ok ? (
        <Notice kind="error">{outcome.message}</Notice>
      ) : (
        <>
          <OutputList
            rows={[
              ...(outcome.result.area !== undefined ? [{ label: 'Area', value: nf(outcome.result.area), emphasize: true }] : []),
              ...(outcome.result.perimeter !== undefined ? [{ label: 'Perimeter', value: nf(outcome.result.perimeter) }] : []),
              ...(outcome.result.volume !== undefined ? [{ label: 'Volume', value: nf(outcome.result.volume), emphasize: true }] : []),
              ...(outcome.result.surfaceArea !== undefined ? [{ label: 'Surface area', value: nf(outcome.result.surfaceArea) }] : []),
              ...(outcome.result.extra ?? []).map((item) => ({ label: item.label, value: nf(item.value) })),
            ]}
          />
          <div className="row">
            <CopyButton
              text={[
                outcome.result.area !== undefined ? `Area: ${nf(outcome.result.area)}` : null,
                outcome.result.volume !== undefined ? `Volume: ${nf(outcome.result.volume)}` : null,
                outcome.result.surfaceArea !== undefined ? `Surface area: ${nf(outcome.result.surfaceArea)}` : null,
              ]
                .filter(Boolean)
                .join('\n')}
              label="Copy results"
            />
            {outcome.result.volume !== undefined ? (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => appendToDraft(nf(outcome.result.volume!).replace(/,/g, ''))}
              >
                Use volume in calculator
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function shapeLabels(shape: string): { a: string; b?: string; c?: string } {
  switch (shape) {
    case 'circle':
      return { a: 'Radius' };
    case 'rectangle':
      return { a: 'Width', b: 'Height' };
    case 'square':
      return { a: 'Side' };
    case 'triangle':
      return { a: 'Side a', b: 'Side b', c: 'Side c' };
    case 'cube':
      return { a: 'Side' };
    case 'box':
      return { a: 'Width', b: 'Height', c: 'Depth' };
    case 'cylinder':
      return { a: 'Radius', b: 'Height' };
    case 'sphere':
      return { a: 'Radius' };
    default:
      return { a: 'Radius', b: 'Height' };
  }
}
