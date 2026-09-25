import { CalcError } from '@/core/errors';

/** Everyday and financial calculators. All results are plain numbers unless noted. */

function requirePositive(value: number, label: string, allowZero = false): number {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new CalcError('DOMAIN', `${label} must be ${allowZero ? 'non-negative' : 'positive'}`, {
      details: `Received ${value}.`,
    });
  }
  return value;
}

export function simpleInterest(principal: number, annualRatePercent: number, years: number): {
  interest: number;
  total: number;
} {
  requirePositive(principal, 'Principal', true);
  const interest = principal * (annualRatePercent / 100) * years;
  return { interest, total: principal + interest };
}

export interface CompoundingInput {
  principal: number;
  annualRatePercent: number;
  years: number;
  /** Compounds per year; use 0 for continuous compounding. */
  compoundsPerYear: number;
}

export function compoundInterest(input: CompoundingInput): {
  amount: number;
  interest: number;
  effectiveAnnualRate: number;
} {
  const { principal, annualRatePercent, years, compoundsPerYear } = input;
  requirePositive(principal, 'Principal', true);
  const rate = annualRatePercent / 100;

  if (compoundsPerYear === 0) {
    const amount = principal * Math.exp(rate * years);
    return { amount, interest: amount - principal, effectiveAnnualRate: Math.exp(rate) - 1 };
  }
  const periods = requirePositive(compoundsPerYear, 'Compounds per year');
  const amount = principal * (1 + rate / periods) ** (periods * years);
  return {
    amount,
    interest: amount - principal,
    effectiveAnnualRate: (1 + rate / periods) ** periods - 1,
  };
}

export interface LoanInput {
  principal: number;
  annualRatePercent: number;
  years: number;
  paymentsPerYear?: number;
}

export interface LoanResult {
  payment: number;
  totalPaid: number;
  totalInterest: number;
  numberOfPayments: number;
  schedule: { period: number; payment: number; interest: number; principal: number; balance: number }[];
}

/** Equated monthly instalment with a full amortisation schedule. */
export function loanPayment(input: LoanInput): LoanResult {
  const paymentsPerYear = input.paymentsPerYear ?? 12;
  const { principal, annualRatePercent, years } = input;
  requirePositive(principal, 'Loan amount');
  requirePositive(paymentsPerYear, 'Payments per year');
  if (years <= 0) throw new CalcError('DOMAIN', 'The term must be greater than zero');

  const periods = Math.round(paymentsPerYear * years);
  const periodicRate = annualRatePercent / 100 / paymentsPerYear;

  const payment =
    periodicRate === 0
      ? principal / periods
      : (principal * periodicRate) / (1 - (1 + periodicRate) ** -periods);

  const schedule: LoanResult['schedule'] = [];
  let balance = principal;
  let totalInterest = 0;
  for (let period = 1; period <= periods && period <= 1200; period += 1) {
    const interest = balance * periodicRate;
    const principalPart = payment - interest;
    balance = Math.max(0, balance - principalPart);
    totalInterest += interest;
    schedule.push({
      period,
      payment,
      interest,
      principal: principalPart,
      balance,
    });
  }

  return {
    payment,
    totalPaid: payment * periods,
    totalInterest,
    numberOfPayments: periods,
    schedule,
  };
}

/** Future value of a present amount. */
export function futureValue(presentValue: number, annualRatePercent: number, years: number): number {
  return presentValue * (1 + annualRatePercent / 100) ** years;
}

/** Present value of a future amount (discounted). */
export function presentValueAmount(futureValueTarget: number, annualRatePercent: number, years: number): number {
  return futureValueTarget / (1 + annualRatePercent / 100) ** years;
}

/** Future value of a series of equal deposits. */
export function annuityFutureValue(deposit: number, annualRatePercent: number, years: number, depositsPerYear = 12): number {
  const rate = annualRatePercent / 100 / depositsPerYear;
  const periods = Math.round(depositsPerYear * years);
  if (Math.abs(rate) < 1e-12) return deposit * periods;
  return deposit * (((1 + rate) ** periods - 1) / rate);
}

export interface RoiResult {
  roi: number;
  /** Return on investment as a percentage. */
  roiPercent: number;
  gain: number;
  annualisedPercent: number | null;
}

export function roi(initial: number, final: number, years?: number): RoiResult {
  if (initial === 0) throw new CalcError('DIV_ZERO', 'The initial investment cannot be zero');
  const gain = final - initial;
  const ratio = final / initial;
  return {
    roi: gain / initial,
    roiPercent: (gain / initial) * 100,
    gain,
    annualisedPercent:
      years && years > 0 && ratio > 0 ? (ratio ** (1 / years) - 1) * 100 : null,
  };
}

export function percentageChange(from: number, to: number): number {
  if (from === 0) throw new CalcError('DIV_ZERO', 'The starting value cannot be zero');
  return ((to - from) / Math.abs(from)) * 100;
}

export function percentageOf(percent: number, value: number): number {
  return (percent / 100) * value;
}

/** What percentage `part` is of `whole`. */
export function percentageRatio(part: number, whole: number): number {
  if (whole === 0) throw new CalcError('DIV_ZERO', 'The whole cannot be zero');
  return (part / whole) * 100;
}

export function discount(price: number, discountPercent: number, taxPercent = 0): {
  discountAmount: number;
  priceAfterDiscount: number;
  tax: number;
  finalPrice: number;
} {
  requirePositive(price, 'Price', true);
  const discountAmount = price * (discountPercent / 100);
  const priceAfterDiscount = price - discountAmount;
  const tax = priceAfterDiscount * (taxPercent / 100);
  return { discountAmount, priceAfterDiscount, tax, finalPrice: priceAfterDiscount + tax };
}

export function tip(bill: number, tipPercent: number, people = 1): {
  tipAmount: number;
  total: number;
  perPerson: number;
} {
  requirePositive(bill, 'Bill', true);
  requirePositive(people, 'Number of people');
  const tipAmount = bill * (tipPercent / 100);
  const total = bill + tipAmount;
  return { tipAmount, total, perPerson: total / people };
}

export interface DateDifference {
  days: number;
  weeks: number;
  months: number;
  years: number;
  /** Breakdown for display. */
  breakdown: { years: number; months: number; days: number };
  businessDays: number;
}

function parseIsoDate(value: string, label: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new CalcError('INPUT', `${label} must use the YYYY-MM-DD format`, { details: `Received "${value}".` });
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) throw new CalcError('INPUT', `${label} is not a valid date`);
  return date;
}

export function daysBetween(startInput: string, endInput: string): DateDifference {
  const start = parseIsoDate(startInput, 'Start date');
  const end = parseIsoDate(endInput, 'End date');
  const milliseconds = end.getTime() - start.getTime();
  const days = milliseconds / 86_400_000;
  const sign = days < 0 ? -1 : 1;

  let businessDays = 0;
  const cursor = new Date(Math.min(start.getTime(), end.getTime()));
  const finish = new Date(Math.max(start.getTime(), end.getTime()));
  while (cursor < finish) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) businessDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Calendar breakdown (years/months/days) using the earlier date as the anchor.
  const [from, to] = sign > 0 ? [start, end] : [end, start];
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  let dayPart = to.getUTCDate() - from.getUTCDate();
  if (dayPart < 0) {
    months -= 1;
    const previousMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0));
    dayPart += previousMonth.getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return {
    days,
    weeks: days / 7,
    months: years * 12 + months + dayPart / 30,
    years: years + (months + dayPart / 30) / 12,
    businessDays: sign * businessDays,
    breakdown: { years, months, days: dayPart },
  };
}

/** Age in years/months/days from a birth date to a reference date (default today). */
export function age(birthDate: string, referenceDate?: string): DateDifference & { nextBirthdayInDays: number } {
  const today =
    referenceDate ??
    new Date().toISOString().slice(0, 10);
  const difference = daysBetween(birthDate, today);
  if (difference.days < 0) {
    throw new CalcError('INPUT', 'The birth date is after the reference date');
  }
  const birth = parseIsoDate(birthDate, 'Birth date');
  const reference = parseIsoDate(today, 'Reference date');
  const thisYear = new Date(Date.UTC(reference.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
  if (thisYear < reference) thisYear.setUTCFullYear(thisYear.getUTCFullYear() + 1);
  const nextBirthdayInDays = (thisYear.getTime() - reference.getTime()) / 86_400_000;
  return { ...difference, nextBirthdayInDays };
}

export interface TimeDifference {
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number;
  totalSeconds: number;
}

/** Difference between two HH:MM (optionally seconds) times, handling midnight wrap. */
export function timeDifference(start: string, end: string): TimeDifference {
  const toSeconds = (value: string, label: string): number => {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
    if (!match) throw new CalcError('INPUT', `${label} must look like HH:MM or HH:MM:SS`);
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] ? Number(match[3]) : 0;
    if (hours > 23 || minutes > 59 || seconds > 59) {
      throw new CalcError('INPUT', `${label} is not a valid time of day`);
    }
    return hours * 3600 + minutes * 60 + seconds;
  };

  let delta = toSeconds(end, 'End time') - toSeconds(start, 'Start time');
  if (delta < 0) delta += 86_400; // crossed midnight
  return {
    hours: Math.floor(delta / 3600),
    minutes: Math.floor((delta % 3600) / 60),
    seconds: delta % 60,
    totalMinutes: delta / 60,
    totalSeconds: delta,
  };
}

export function splitBill(amount: number, people: number, tipPercent = 0): {
  perPerson: number;
  total: number;
  tipAmount: number;
} {
  requirePositive(amount, 'Amount', true);
  requirePositive(people, 'Number of people');
  const tipAmount = amount * (tipPercent / 100);
  const total = amount + tipAmount;
  return { perPerson: total / people, total, tipAmount };
}
