import { useMemo, useState } from 'react';
import * as fin from '@/finance';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { appendToDraft } from '@/ui/bus';
import { Notice, NumberField, OutputList, Tabs, TextField } from '@/ui/components/primitives';

const TABS = [
  { id: 'loans', label: 'Interest & loans' },
  { id: 'invest', label: 'Investment' },
  { id: 'percent', label: 'Percentages' },
  { id: 'dates', label: 'Dates & time' },
] as const;

export function FinancePanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('loans');
  return (
    <div className="stack">
      <Tabs tabs={TABS} value={tab} onChange={(id) => setTab(id as typeof tab)} label="Finance area" />
      {tab === 'loans' ? <LoanTool /> : null}
      {tab === 'invest' ? <InvestTool /> : null}
      {tab === 'percent' ? <PercentTool /> : null}
      {tab === 'dates' ? <DateTool /> : null}
    </div>
  );
}

function useMoney() {
  const settings = useSettings();
  return (value: number) =>
    formatNumber(value, { precision: Math.min(settings.precision, 6), thousandsSeparator: settings.thousandsSeparator });
}

function LoanTool() {
  const money = useMoney();
  const [principal, setPrincipal] = useState<number | ''>(200000);
  const [rate, setRate] = useState<number | ''>(6);
  const [years, setYears] = useState<number | ''>(30);
  const [perYear, setPerYear] = useState<number | ''>(12);
  const [simplePrincipal, setSimplePrincipal] = useState<number | ''>(1000);
  const [simpleRate, setSimpleRate] = useState<number | ''>(5);
  const [simpleYears, setSimpleYears] = useState<number | ''>(3);
  const [compoundPerYear, setCompoundPerYear] = useState<number | ''>(12);

  const simple = useMemo(() => {
    if (simplePrincipal === '' || simpleRate === '' || simpleYears === '') return null;
    try {
      return { ok: true as const, ...fin.simpleInterest(simplePrincipal, simpleRate, simpleYears) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [simplePrincipal, simpleRate, simpleYears]);

  const compound = useMemo(() => {
    if (simplePrincipal === '' || simpleRate === '' || simpleYears === '' || compoundPerYear === '') return null;
    try {
      return {
        ok: true as const,
        ...fin.compoundInterest({
          principal: simplePrincipal,
          annualRatePercent: simpleRate,
          years: simpleYears,
          compoundsPerYear: compoundPerYear,
        }),
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [simplePrincipal, simpleRate, simpleYears, compoundPerYear]);

  const loan = useMemo(() => {
    if (principal === '' || rate === '' || years === '') return null;
    try {
      return {
        ok: true as const,
        ...fin.loanPayment({
          principal,
          annualRatePercent: rate,
          years,
          paymentsPerYear: perYear === '' ? 12 : perYear,
        }),
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [principal, rate, years, perYear]);

  return (
    <>
      <section className="card">
        <h2>Loan / mortgage payment</h2>
        <div className="grid grid--form">
          <NumberField label="Loan amount" value={principal} onChange={setPrincipal} step={1000} min={0} />
          <NumberField label="Annual interest rate" unit="%" value={rate} onChange={setRate} step={0.05} />
          <NumberField label="Term" unit="years" value={years} onChange={setYears} step={1} min={0} />
          <NumberField label="Payments per year" value={perYear} onChange={setPerYear} step={1} min={1} max={52} />
        </div>
        {loan === null ? (
          <Notice>Enter the loan details to see the payment.</Notice>
        ) : !loan.ok ? (
          <Notice kind="error">{loan.message}</Notice>
        ) : (
          <>
            <OutputList
              rows={[
                { label: 'Payment', value: money(loan.payment), emphasize: true },
                { label: 'Number of payments', value: String(loan.numberOfPayments) },
                { label: 'Total paid', value: money(loan.totalPaid) },
                { label: 'Total interest', value: money(loan.totalInterest) },
              ]}
            />
            <details className="details">
              <summary>Amortisation schedule (first 24 rows)</summary>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Payment</th>
                      <th>Interest</th>
                      <th>Principal</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.schedule.slice(0, 24).map((row) => (
                      <tr key={row.period}>
                        <td>{row.period}</td>
                        <td>{money(row.payment)}</td>
                        <td>{money(row.interest)}</td>
                        <td>{money(row.principal)}</td>
                        <td>{money(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => appendToDraft(String(loan.payment))}
            >
              Use payment in calculator
            </button>
          </>
        )}
      </section>

      <section className="card">
        <h2>Simple and compound interest</h2>
        <div className="grid grid--form">
          <NumberField label="Principal" value={simplePrincipal} onChange={setSimplePrincipal} step={100} />
          <NumberField label="Annual rate" unit="%" value={simpleRate} onChange={setSimpleRate} step={0.1} />
          <NumberField label="Years" value={simpleYears} onChange={setSimpleYears} step={1} />
          <NumberField label="Compounds per year (0 = continuous)" value={compoundPerYear} onChange={setCompoundPerYear} step={1} min={0} />
        </div>
        {simple?.ok ? (
          <OutputList
            title="Simple interest"
            rows={[
              { label: 'Interest', value: money(simple.interest) },
              { label: 'Total', value: money(simple.total), emphasize: true },
            ]}
          />
        ) : simple && 'message' in simple ? (
          <Notice kind="error">{simple.message}</Notice>
        ) : null}
        {compound?.ok ? (
          <OutputList
            title="Compound interest"
            rows={[
              { label: 'Final amount', value: money(compound.amount), emphasize: true },
              { label: 'Interest earned', value: money(compound.interest) },
              { label: 'Effective annual rate', value: `${formatNumber(compound.effectiveAnnualRate * 100, { precision: 4 })}%` },
            ]}
          />
        ) : compound && 'message' in compound ? (
          <Notice kind="error">{compound.message}</Notice>
        ) : null}
      </section>
    </>
  );
}

function InvestTool() {
  const money = useMoney();
  const [present, setPresent] = useState<number | ''>(1000);
  const [rate, setRate] = useState<number | ''>(5);
  const [years, setYears] = useState<number | ''>(10);
  const [deposit, setDeposit] = useState<number | ''>(100);
  const [initial, setInitial] = useState<number | ''>(1000);
  const [final, setFinal] = useState<number | ''>(1500);
  const [roiYears, setRoiYears] = useState<number | ''>(2);

  const fv = useMemo(() => {
    if (present === '' || rate === '' || years === '') return null;
    return {
      future: fin.futureValue(present, rate, years),
      present: fin.presentValueAmount(present, rate, years),
      annuity: fin.annuityFutureValue(deposit === '' ? 0 : deposit, rate, years),
    };
  }, [present, rate, years, deposit]);

  const roi = useMemo(() => {
    if (initial === '' || final === '') return null;
    try {
      return { ok: true as const, ...fin.roi(initial, final, roiYears === '' ? undefined : roiYears) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [initial, final, roiYears]);

  return (
    <>
      <section className="card">
        <h2>Time value of money</h2>
        <div className="grid grid--form">
          <NumberField label="Amount" value={present} onChange={setPresent} step={100} />
          <NumberField label="Annual rate" unit="%" value={rate} onChange={setRate} step={0.1} />
          <NumberField label="Years" value={years} onChange={setYears} step={1} />
          <NumberField label="Monthly deposit" value={deposit} onChange={setDeposit} step={10} />
        </div>
        {fv ? (
          <OutputList
            rows={[
              { label: `Future value of ${money(present || 0)}`, value: money(fv.future), emphasize: true },
              { label: 'Present value of the same amount', value: money(fv.present) },
              { label: 'Future value with monthly deposits', value: money(fv.annuity) },
            ]}
          />
        ) : (
          <Notice>Enter an amount, rate and number of years.</Notice>
        )}
      </section>

      <section className="card">
        <h2>Return on investment</h2>
        <div className="grid grid--form">
          <NumberField label="Initial value" value={initial} onChange={setInitial} step={100} />
          <NumberField label="Final value" value={final} onChange={setFinal} step={100} />
          <NumberField label="Holding period" unit="years" value={roiYears} onChange={setRoiYears} step={1} />
        </div>
        {roi?.ok ? (
          <OutputList
            rows={[
              { label: 'Gain', value: money(roi.gain) },
              { label: 'ROI', value: `${formatNumber(roi.roiPercent, { precision: 4 })}%`, emphasize: true },
              {
                label: 'Annualised return',
                value: roi.annualisedPercent === null ? '—' : `${formatNumber(roi.annualisedPercent, { precision: 4 })}%`,
              },
            ]}
          />
        ) : roi && 'message' in roi ? (
          <Notice kind="error">{roi.message}</Notice>
        ) : null}
      </section>
    </>
  );
}

function PercentTool() {
  const [percent, setPercent] = useState<number | ''>(15);
  const [value, setValue] = useState<number | ''>(200);
  const [part, setPart] = useState<number | ''>(25);
  const [whole, setWhole] = useState<number | ''>(200);
  const [price, setPrice] = useState<number | ''>(100);
  const [discountPercent, setDiscountPercent] = useState<number | ''>(20);
  const [tax, setTax] = useState<number | ''>(10);
  const [bill, setBill] = useState<number | ''>(80);
  const [tipPercent, setTipPercent] = useState<number | ''>(15);
  const [people, setPeople] = useState<number | ''>(4);

  const pct = useMemo(() => {
    try {
      return {
        ok: true as const,
        of: percent === '' ? null : fin.percentageOf(percent, value === '' ? 0 : value),
        ratio: part === '' || whole === '' ? null : fin.percentageRatio(part, whole),
        change: value === '' ? null : fin.percentageChange(value, value * (1 + (percent === '' ? 0 : percent) / 100)),
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [percent, value, part, whole]);

  const money = useMoney();
  const deal = useMemo(() => {
    try {
      return {
        ok: true as const,
        discount: discount(price, discountPercent, tax),
        tip: tip(bill, tipPercent, people === '' ? 1 : people),
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }

    function discount(p: number | '', d: number | '', t: number | '') {
      if (p === '' || d === '') throw new Error('Enter a price and a discount');
      return fin.discount(p, d, t === '' ? 0 : t);
    }

    function tip(b: number | '', t: number | '', n: number) {
      if (b === '' || t === '') throw new Error('Enter a bill and a tip');
      return fin.tip(b, t, n);
    }
  }, [price, discountPercent, tax, bill, tipPercent, people]);

  return (
    <>
      <section className="card">
        <h2>Percentages</h2>
        <div className="grid grid--form">
          <NumberField label="Percent" unit="%" value={percent} onChange={setPercent} step={1} />
          <NumberField label="Of value" value={value} onChange={setValue} step={1} />
          <NumberField label="Part" value={part} onChange={setPart} step={1} />
          <NumberField label="Whole" value={whole} onChange={setWhole} step={1} />
        </div>
        {pct.ok ? (
          <OutputList
            rows={[
              ...(pct.of !== null ? [{ label: `${percent}% of ${value}`, value: money(pct.of), emphasize: true }] : []),
              ...(pct.ratio !== null ? [{ label: `${part} as a percent of ${whole}`, value: `${formatNumber(pct.ratio, { precision: 4 })}%` }] : []),
              ...(pct.change !== null ? [{ label: `Change from ${value} to ${value} + ${percent}%`, value: `${formatNumber(pct.change, { precision: 4 })}%` }] : []),
            ]}
          />
        ) : (
          <Notice kind="error">{pct.message}</Notice>
        )}
      </section>

      <section className="card">
        <h2>Discounts, tips and bill splitting</h2>
        <div className="grid grid--form">
          <NumberField label="Price" value={price} onChange={setPrice} step={1} />
          <NumberField label="Discount" unit="%" value={discountPercent} onChange={setDiscountPercent} step={1} />
          <NumberField label="Tax" unit="%" value={tax} onChange={setTax} step={1} />
          <NumberField label="Bill" value={bill} onChange={setBill} step={1} />
          <NumberField label="Tip" unit="%" value={tipPercent} onChange={setTipPercent} step={1} />
          <NumberField label="People" value={people} onChange={setPeople} step={1} min={1} />
        </div>
        {deal.ok ? (
          <>
            <OutputList
              title="Discount"
              rows={[
                { label: 'You save', value: money(deal.discount.discountAmount) },
                { label: 'Price after discount', value: money(deal.discount.priceAfterDiscount) },
                { label: 'Tax added', value: money(deal.discount.tax) },
                { label: 'Final price', value: money(deal.discount.finalPrice), emphasize: true },
              ]}
            />
            <OutputList
              title="Tip"
              rows={[
                { label: 'Tip amount', value: money(deal.tip.tipAmount) },
                { label: 'Total', value: money(deal.tip.total) },
                { label: 'Each person pays', value: money(deal.tip.perPerson), emphasize: true },
              ]}
            />
          </>
        ) : (
          <Notice kind="error">{deal.message}</Notice>
        )}
      </section>
    </>
  );
}

function DateTool() {
  const [start, setStart] = useState('2024-01-01');
  const [end, setEnd] = useState('2024-03-01');
  const [birth, setBirth] = useState('1990-06-15');
  const [reference, setReference] = useState('2024-06-20');
  const [timeStart, setTimeStart] = useState('09:30');
  const [timeEnd, setTimeEnd] = useState('17:45');

  const days = useMemo(() => {
    try {
      return { ok: true as const, ...fin.daysBetween(start, end) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [start, end]);

  const ageResult = useMemo(() => {
    try {
      return { ok: true as const, ...fin.age(birth, reference) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [birth, reference]);

  const time = useMemo(() => {
    try {
      return { ok: true as const, ...fin.timeDifference(timeStart, timeEnd) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [timeStart, timeEnd]);

  const decimals = { precision: 3 };

  return (
    <>
      <section className="card">
        <h2>Date difference</h2>
        <div className="grid grid--form">
          <TextField label="Start date" value={start} onChange={setStart} hint="YYYY-MM-DD" type="date" />
          <TextField label="End date" value={end} onChange={setEnd} hint="YYYY-MM-DD" type="date" />
        </div>
        {days.ok ? (
          <OutputList
            rows={[
              { label: 'Days', value: String(days.days), emphasize: true },
              { label: 'Business days (Mon–Fri)', value: String(days.businessDays) },
              { label: 'Weeks', value: formatNumber(days.weeks, decimals) },
              { label: 'Calendar', value: `${days.breakdown.years} y ${days.breakdown.months} m ${days.breakdown.days} d` },
              { label: 'Approx. months', value: formatNumber(days.months, decimals) },
            ]}
          />
        ) : (
          <Notice kind="error">{days.message}</Notice>
        )}
      </section>

      <section className="card">
        <h2>Age</h2>
        <div className="grid grid--form">
          <TextField label="Birth date" value={birth} onChange={setBirth} hint="YYYY-MM-DD" type="date" />
          <TextField label="As of" value={reference} onChange={setReference} hint="YYYY-MM-DD" type="date" />
        </div>
        {ageResult.ok ? (
          <OutputList
            rows={[
              { label: 'Age', value: `${ageResult.breakdown.years} y ${ageResult.breakdown.months} m ${ageResult.breakdown.days} d`, emphasize: true },
              { label: 'Total days', value: String(ageResult.days) },
              { label: 'Next birthday in', value: `${formatNumber(ageResult.nextBirthdayInDays, { precision: 0 })} days` },
            ]}
          />
        ) : (
          <Notice kind="error">{ageResult.message}</Notice>
        )}
      </section>

      <section className="card">
        <h2>Time difference</h2>
        <div className="grid grid--form">
          <TextField label="Start time" value={timeStart} onChange={setTimeStart} hint="HH:MM or HH:MM:SS" />
          <TextField label="End time" value={timeEnd} onChange={setTimeEnd} hint="Handles crossing midnight" />
        </div>
        {time.ok ? (
          <OutputList
            rows={[
              { label: 'Duration', value: `${time.hours} h ${time.minutes} min ${time.seconds} s`, emphasize: true },
              { label: 'Total minutes', value: formatNumber(time.totalMinutes, decimals) },
              { label: 'Total seconds', value: String(time.totalSeconds) },
            ]}
          />
        ) : (
          <Notice kind="error">{time.message}</Notice>
        )}
      </section>
    </>
  );
}
