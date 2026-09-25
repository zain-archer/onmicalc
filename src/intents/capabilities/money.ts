import { formatNumber } from '@/core/precision/format';
import { age, daysBetween, loanPayment, roi, simpleInterest, splitBill, timeDifference } from '@/finance';
import { compoundInterest } from '@/finance';
import type { Capability, SolveOutcome, ResultBlock } from '../types';

const nf = (value: number, precision = 8) => formatNumber(value, { precision });
const money = (value: number) => formatNumber(value, { precision: 2, thousandsSeparator: true });

const DATE_PATTERN = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g;

function datesIn(raw: string): string[] {
  return [...raw.matchAll(DATE_PATTERN)].map((match) => match[1]!).slice(0, 2);
}

export const interestCapability: Capability = {
  id: 'interest',
  title: 'Savings, interest and loans',
  promise: '“1000 at 5 percent for 10 years”, “loan of 200000 at 6 percent for 30 years”.',
  group: 'Money',
  keywords: [
    'interest', 'compound', 'savings', 'invest', 'investment', 'future value', 'present value',
    'loan', 'mortgage', 'repayment', 'monthly payment', 'instalment', 'installment', 'borrow',
    'roi', 'return on investment', 'profit',
  ],
  examples: [
    { text: 'compound interest on 1000 at 5 percent for 10 years', capabilityId: 'interest', captures: [{ name: 'principal', value: 1000 }, { name: 'rate', value: 5 }, { name: 'years', value: 10 }] },
    { text: 'loan of 200000 at 6 percent for 30 years', capabilityId: 'interest', captures: [{ name: 'principal', value: 200000 }, { name: 'rate', value: 6 }, { name: 'years', value: 30 }] },
    { text: 'interest on 5000 at 7 percent for 3 years', capabilityId: 'interest', captures: [{ name: 'principal', value: 5000 }, { name: 'rate', value: 7 }, { name: 'years', value: 3 }] },
  ],
  inputs: [
    { name: 'principal', label: 'Amount', example: '1000' },
    { name: 'rate', label: 'Annual rate (%)', example: '5' },
    { name: 'years', label: 'Years', example: '10' },
    { name: 'compounds', label: 'Compounds per year', hint: '12 = monthly, 1 = yearly, 365 = daily', example: '12', optional: true },
  ],
  run(context): SolveOutcome {
    const raw = context.raw;
    const principal = context.get('principal')
      ?? (/(-?[\d,]+(?:\.\d+)?)\s*(?:at|with|earn(?:ing)?|invest(?:ed)?|deposit(?:ed)?|of|for|loan\b|borrow)/i.exec(raw) ? Number(/(-?[\d,]+(?:\.\d+)?)\s*(?:at|with|earn(?:ing)?|invest(?:ed)?|deposit(?:ed)?|of|for|loan\b|borrow)/i.exec(raw)![1].replace(/,/g, '')) : undefined)
      ?? (/(-?[\d,]+(?:\.\d+)?)/.exec(raw) ? Number(/(-?[\d,]+(?:\.\d+)?)/.exec(raw)![1].replace(/,/g, '')) : undefined);
    const rate = context.get('rate')
      ?? (/(?:at|rate of|interest of|)\s*(-?[\d.]+)\s*(?:%|percent|per cent)/i.exec(raw) ? Number(/(?:at|rate of|interest of|)\s*(-?[\d.]+)\s*(?:%|percent|per cent)/i.exec(raw)![1]) : undefined);
    const years = context.get('years')
      ?? (/\b(?:for|over)\s*(-?[\d.]+)\s*(?:years?|yrs?|y\b)/i.exec(raw) ? Number(/\b(?:for|over)\s*(-?[\d.]+)\s*(?:years?|yrs?|y\b)/i.exec(raw)![1]) : undefined);
    const compounds = context.get('compounds')
      ?? (/\b(monthly|quarterly|weekly|daily|yearly|annually)\b/i.test(raw)
        ? { monthly: 12, quarterly: 4, weekly: 52, daily: 365, yearly: 1, annually: 1 }[
            (/\b(monthly|quarterly|weekly|daily|yearly|annually)\b/i.exec(raw)![1].toLowerCase())
          ]!
        : undefined);

    const isLoan = /loan|mortgage|repay|borrow|instal?ment/i.test(raw);
    const isSimple = /simple interest/i.test(raw);
    const isRoi = /\broi\b|return on investment|profit/i.test(raw);

    if (principal === undefined || rate === undefined) {
      return {
        ok: false,
        message: 'I need the amount and the annual rate, for example “compound interest on 1000 at 5 percent for 10 years”.',
      };
    }

    try {
      if (isRoi) {
        const final = years !== undefined ? principal * (1 + rate / 100) ** years : principal * (1 + rate / 100);
        const result = roi(principal, final, years);
        return {
          ok: true,
          headline: `${nf(result.roiPercent, 6)}%`,
          understood: `${money(principal)} growing at ${nf(rate)}% a year${years !== undefined ? ` for ${nf(years)} years` : ''}`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                { label: 'Return', value: `${nf(result.roiPercent, 6)} %`, emphasize: true },
                { label: 'Profit', value: money(result.gain) },
                { label: 'Final value', value: money(final) },
                ...(result.annualisedPercent !== null
                  ? [{ label: 'Annualised return', value: `${nf(result.annualisedPercent, 6)} %` }]
                  : []),
              ],
            },
          ],
          copyText: `ROI = ${result.roiPercent}% (profit ${result.gain})`,
        };
      }

      if (isLoan) {
        const perYearOf = (value: number | undefined) => value ?? 12;
        if (years === undefined) {
          return { ok: false, message: 'How long is the loan? For example “loan of 200000 at 6 percent for 30 years”.' };
        }
        const result = loanPayment({
          principal,
          annualRatePercent: rate,
          years,
          paymentsPerYear: compounds ?? 12,
        });
        const blocks: ResultBlock[] = [
          {
            kind: 'stats',
            rows: [
              { label: 'Payment', value: money(result.payment), emphasize: true },
              { label: 'Payments', value: `${result.numberOfPayments} in total` },
              { label: 'Total paid', value: money(result.totalPaid) },
              { label: 'Total interest', value: money(result.totalInterest) },
              { label: 'Effective annual rate', value: `${nf(((1 + rate / 100 / perYearOf(compounds)) ** perYearOf(compounds) - 1) * 100, 4)} %` },
            ],
          },
          { kind: 'note', text: 'Figures assume equal payments and interest applied each period.' },
        ];
        return {
          ok: true,
          headline: `${money(result.payment)} per payment`,
          understood: `loan of ${money(principal)} at ${nf(rate)}% over ${nf(years)} years`,
          blocks,
          copyText: `payment = ${result.payment}, total interest = ${result.totalInterest}`,
          money: true,
        };
      }

      if (isSimple) {
        if (years === undefined) {
          return { ok: false, message: 'How many years? For example “simple interest on 1000 at 5 percent for 3 years”.' };
        }
        const result = simpleInterest(principal, rate, years);
        return {
          ok: true,
          headline: money(result.total),
          understood: `simple interest on ${money(principal)} at ${nf(rate)}% for ${nf(years)} years`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                { label: 'Interest earned', value: money(result.interest), emphasize: true },
                { label: 'Total', value: money(result.total) },
              ],
            },
          ],
          copyText: `interest = ${result.interest}, total = ${result.total}`,
          money: true,
        };
      }

      const yearsValue = years ?? 1;
      const perYear = compounds ?? 12;
      const result = compoundInterest({
        principal,
        annualRatePercent: rate,
        years: yearsValue,
        compoundsPerYear: perYear,
      });
      const schedule: string[][] = [];
      for (let year = 1; year <= Math.min(Math.floor(yearsValue), 25); year += 1) {
        const balance = principal * (1 + rate / 100 / perYear) ** (perYear * year);
        schedule.push([String(year), money(balance), money(balance - principal)]);
      }
      return {
        ok: true,
        headline: money(result.amount),
        understood: `compound interest on ${money(principal)} at ${nf(rate)}% for ${nf(yearsValue)} year(s), compounded ${perYear}× a year`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              { label: 'Final amount', value: money(result.amount), emphasize: true },
              { label: 'Interest earned', value: money(result.interest) },
              { label: 'Effective annual rate', value: `${nf(result.effectiveAnnualRate * 100, 4)} %` },
            ],
          },
          ...(schedule.length > 1
            ? [
                {
                  kind: 'table' as const,
                  title: 'Growth year by year',
                  table: { columns: ['Year', 'Balance', 'Interest so far'], rows: schedule },
                },
              ]
            : []),
        ],
        copyText: `final = ${result.amount}, interest = ${result.interest}`,
        money: true,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That money calculation failed.' };
    }
  },
};

export const dateTimeCapability: Capability = {
  id: 'dateTime',
  title: 'Dates, ages and times',
  promise: '“Days between 2024-01-01 and 2026-09-25”, “how old am I if born 1995-04-12”.',
  group: 'Dates & time',
  keywords: [
    'days between', 'days until', 'how many days', 'age', 'how old', 'birthday', 'date difference',
    'weeks between', 'months between', 'time between', 'workdays', 'business days', 'today',
  ],
  examples: [
    { text: 'days between 2024-01-01 and 2026-09-25', capabilityId: 'dateTime', captures: [] },
    { text: 'how old am I if born 1995-04-12', capabilityId: 'dateTime', captures: [] },
    { text: 'time between 09:00 and 17:30', capabilityId: 'dateTime', captures: [] },
  ],
  inputs: [
    { name: 'start', label: 'Start date', hint: 'YYYY-MM-DD', example: '2024-01-01', optional: true },
    { name: 'end', label: 'End date', hint: 'Empty = today', example: '2026-09-25', optional: true },
  ],
  run(context): SolveOutcome {
    const raw = context.raw;

    // Clock times: "time between 09:00 and 17:30"
    const clocks = [...raw.matchAll(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g)].map((match) => match[1]!);
    if (/time\s+(?:between|from|difference)/i.test(raw) && clocks.length >= 2) {
      try {
        const result = timeDifference(clocks[0]!, clocks[1]!);
        return {
          ok: true,
          headline: `${result.hours} h ${result.minutes} min`.trim(),
          understood: `time from ${clocks[0]} to ${clocks[1]}`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                { label: 'Hours', value: nf(result.hours), emphasize: true },
                { label: 'Minutes', value: `${result.hours * 60 + result.minutes}` },
                { label: 'Total minutes', value: nf(result.totalMinutes) },
                { label: 'Total seconds', value: nf(result.totalSeconds) },
              ],
            },
          ],
          copyText: `${clocks[0]} → ${clocks[1]} = ${result.hours}h ${result.minutes}m`,
        };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'Those times could not be compared.' };
      }
    }

    // People often type "born 1995-04-12" or a bare date.
    const isAge = /\bage\b|how old|born|birthday/i.test(raw);
    if (isAge) {
      const birth = context.getText('start') ?? datesIn(raw)[0];
      if (!birth) {
        return { ok: false, message: 'When were they born? Use YYYY-MM-DD, for example “born 1995-04-12”.' };
      }
      try {
        const result = age(birth);
        return {
          ok: true,
          headline: `${result.breakdown.years} years, ${result.breakdown.months} months, ${result.breakdown.days} days`,
          understood: `age for a birth date of ${birth}`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                {
                  label: 'Age',
                  value: `${result.breakdown.years} years, ${result.breakdown.months} months, ${result.breakdown.days} days`,
                  emphasize: true,
                },
                { label: 'Total days', value: nf(result.days) },
                { label: 'Total weeks', value: nf(result.weeks, 4) },
                { label: 'Total months', value: nf(result.months, 6) },
                { label: 'Next birthday in', value: `${nf(result.nextBirthdayInDays)} days` },
              ],
            },
          ],
          copyText: `age = ${result.breakdown.years}y ${result.breakdown.months}m ${result.breakdown.days}d (${result.days} days)`,
        };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'That date could not be read.' };
      }
    }

    const dates = datesIn(raw);
    const start = context.getText('start') ?? dates[0] ?? (/\btoday\b/i.test(raw) ? undefined : undefined);
    const end = context.getText('end') ?? dates[1];
    if (!start) {
      return {
        ok: false,
        message: 'Which dates? Use YYYY-MM-DD, for example “days between 2024-01-01 and 2026-09-25”.',
      };
    }

    try {
      const result = daysBetween(start, end);
      const business = /work|business/i.test(raw) ? result.businessDays : undefined;
      return {
        ok: true,
        headline: `${nf(result.days)} days`,
        understood: `days from ${start} to ${end}`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              { label: 'Total days', value: nf(result.days), emphasize: true },
              { label: 'Weeks', value: nf(result.weeks, 4) },
              { label: 'Months (average)', value: nf(result.months, 4) },
              { label: 'Years', value: nf(result.years, 6) },
              { label: 'Business days', value: nf(business ?? result.businessDays) },
              {
                label: 'Also',
                value: `${result.breakdown.years}y ${result.breakdown.months}m ${result.breakdown.days}d`,
              },
            ],
          },
        ],
        copyText: `${start} → ${end} = ${result.days} days (${result.businessDays} business days)`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Those dates could not be compared.' };
    }
  },
};

export const splitBillCapability: Capability = {
  id: 'splitBill',
  title: 'Split a bill',
  promise: '“Split 120 between 4 people”, “split 250 among 5 with 10 percent tip”.',
  group: 'Money',
  keywords: ['split', 'split evenly', 'split the bill', 'share the bill', 'between', 'among', 'per person', 'each pay', 'share'],
  examples: [
    { text: 'split 120 between 4 people', capabilityId: 'splitBill', captures: [{ name: 'amount', value: 120 }, { name: 'people', value: 4 }] },
    { text: 'split 250 among 5 with 10 percent tip', capabilityId: 'splitBill', captures: [{ name: 'amount', value: 250 }, { name: 'people', value: 5 }, { name: 'tip', value: 10 }] },
  ],
  patterns: [
    {
      template: 'split {amount} between {people} people',
      slots: [
        { name: 'amount', introducers: [''], type: 'number' as const },
        { name: 'people', introducers: ['between'], type: 'number' as const },
      ],
    },
    {
      template: 'split {amount} among {people} with {tip} percent tip',
      slots: [
        { name: 'amount', introducers: [''], type: 'number' as const },
        { name: 'people', introducers: ['among'], type: 'number' as const },
        { name: 'tip', introducers: ['with'], type: 'number' as const },
      ],
    },
    {
      template: 'split {amount} {people} ways',
      slots: [
        { name: 'amount', introducers: [''], type: 'number' as const },
        { name: 'people', introducers: ['between', 'among'], type: 'number' as const },
      ],
    },
  ],
  inputs: [
    { name: 'amount', label: 'Total amount', example: '120' },
    { name: 'people', label: 'People', example: '4' },
    { name: 'tip', label: 'Tip (%)', example: '10', optional: true },
  ],
  run(context): SolveOutcome {
    const raw = context.raw;
    const amount = context.get('amount') ?? (/(-?[\d,]+(?:\.\d+)?)\s*(?:between|among|split|shared)/i.exec(raw) ? Number(/(-?[\d,]+(?:\.\d+)?)\s*(?:between|among|split|shared)/i.exec(raw)![1].replace(/,/g, '')) : undefined)
      ?? (/(?:split|share)\D{0,12}(-?[\d,]+(?:\.\d+)?)/i.exec(raw) ? Number(/(?:split|share)\D{0,12}(-?[\d,]+(?:\.\d+)?)/i.exec(raw)![1].replace(/,/g, '')) : undefined);
    const people = context.get('people') ?? (/(?:between|among|for)\s*(\d+)|(\d+)\s*(?:people|persons?|friends?|ways)/i.exec(raw) ? Number(/(?:between|among|for)\s*(\d+)|(\d+)\s*(?:people|persons?|friends?|ways)/i.exec(raw)![1] ?? /(?:between|among|for)\s*(\d+)|(\d+)\s*(?:people|persons?|friends?|ways)/i.exec(raw)![2]) : undefined);
    const tipPercent = context.get('tip') ?? (/(-?[\d.]+)\s*(?:%|percent)\s*(?:tip)?/i.exec(raw) ? Number(/(-?[\d.]+)\s*(?:%|percent)\s*(?:tip)?/i.exec(raw)![1]) : undefined);

    if (amount === undefined || people === undefined) {
      return { ok: false, message: 'Tell me the total and the number of people, for example “split 120 between 4 people”.' };
    }

    try {
      const result = splitBill(amount, people, tipPercent ?? 0);
      return {
        ok: true,
        headline: `${money(result.perPerson)} each`,
        understood: `${money(amount)} between ${people}${tipPercent ? ` with a ${tipPercent}% tip` : ''}`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              { label: 'Each person pays', value: money(result.perPerson), emphasize: true },
              { label: 'Tip', value: money(result.tipAmount) },
              { label: 'Total with tip', value: money(result.total) },
            ],
          },
        ],
        copyText: `${result.perPerson} each (${people} people, total ${result.total})`,
        money: true,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That split failed.' };
    }
  },
};
