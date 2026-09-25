import { useMemo, useState } from 'react';
import { constantRecords, searchConstants, type ConstantRecord } from '@/constants';
import { useSettings } from '@/settings/useSettings';
import { appendToDraft } from '@/ui/bus';
import { CopyButton, EmptyState, Notice, Tabs, TextField } from '@/ui/components/primitives';

const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'mathematical', label: 'Mathematical' },
  { id: 'physical', label: 'Physical' },
] as const;

export function ConstantsPanel() {
  const settings = useSettings();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<(typeof GROUPS)[number]['id']>('all');

  const results = useMemo(() => {
    const matched = searchConstants(query, Math.max(9, settings.precision));
    return group === 'all' ? matched : matched.filter((record) => record.category === group);
  }, [query, group, settings.precision]);

  const total = constantRecords().length;

  return (
    <div className="stack">
      <section className="card">
        <Tabs
          tabs={GROUPS.map((entry) => ({ id: entry.id, label: entry.label }))}
          value={group}
          onChange={(id) => setGroup(id as (typeof GROUPS)[number]['id'])}
          label="Constant category"
        />
        <TextField
          label="Search constants"
          value={query}
          onChange={setQuery}
          placeholder="planck, avogadro, m/s, gravitation…"
          hint={`${results.length} of ${total} constants`}
        />
        <Notice>
          Values are stored on your device and cite their source. Insert a constant into the
          calculator to use it in an expression; <code>π</code>, <code>e</code>, <code>τ</code>,{' '}
          <code>φ</code>, <code>√2</code> and <code>√3</code> are also available by symbol.
        </Notice>
      </section>

      {results.length === 0 ? (
        <section className="card">
          <EmptyState>No constant matches that search.</EmptyState>
        </section>
      ) : (
        <section className="card">
          <ul className="constants">
            {results.map((record) => (
              <ConstantRow key={`${record.category}-${record.name}`} record={record} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ConstantRow({ record }: { record: ConstantRecord }) {
  return (
    <li className="constants__item">
      <div className="constants__head">
        <span className="constants__symbol">{record.symbol}</span>
        <button
          type="button"
          className="constants__name"
          title={`Insert ${record.name} into the calculator`}
          onClick={() => appendToDraft(record.name)}
        >
          {record.name}
        </button>
        <span className="badge">{record.category === 'mathematical' ? 'Math' : 'Physics'}</span>
      </div>
      <p className="constants__value">
        <code>{record.display}</code>
        {record.unit ? <span className="constants__unit"> {record.unit}</span> : null}
      </p>
      <p className="constants__desc">{record.description}</p>
      <p className="constants__source">
        Source: {record.source}
        <CopyButton text={`${record.name} = ${record.display} ${record.unit}`} label="Copy" />
      </p>
    </li>
  );
}
