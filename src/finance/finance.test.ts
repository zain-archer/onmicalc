import { describe, expect, it } from 'vitest';
import {
  age,
  annuityFutureValue,
  compoundInterest,
  daysBetween,
  discount,
  futureValue,
  loanPayment,
  percentageChange,
  percentageOf,
  percentageRatio,
  presentValueAmount,
  roi,
  simpleInterest,
  splitBill,
  timeDifference,
  tip,
} from './index';
import { CalcError } from '@/core/errors';

describe('interest', () => {
  it('computes simple interest', () => {
    const result = simpleInterest(1000, 5, 3);
    expect(result.interest).toBeCloseTo(150, 10);
    expect(result.total).toBeCloseTo(1150, 10);
  });

  it('computes compound interest for each compounding frequency', () => {
    const annual = compoundInterest({ principal: 1000, annualRatePercent: 5, years: 10, compoundsPerYear: 1 });
    expect(annual.amount).toBeCloseTo(1628.894626777442, 6);

    const monthly = compoundInterest({ principal: 1000, annualRatePercent: 5, years: 10, compoundsPerYear: 12 });
    expect(monthly.amount).toBeCloseTo(1647.0094976902801, 6);

    const daily = compoundInterest({ principal: 1000, annualRatePercent: 5, years: 10, compoundsPerYear: 365 });
    expect(daily.amount).toBeCloseTo(1648.6648137652346, 4);

    const continuous = compoundInterest({ principal: 1000, annualRatePercent: 5, years: 10, compoundsPerYear: 0 });
    expect(continuous.amount).toBeCloseTo(1000 * Math.exp(0.5), 8);
  });

  it('reports the effective annual rate', () => {
    const monthly = compoundInterest({ principal: 1000, annualRatePercent: 6, years: 1, compoundsPerYear: 12 });
    expect(monthly.effectiveAnnualRate).toBeCloseTo(0.06167781186449829, 8);
  });

  it('moves money forwards and backwards in time', () => {
    expect(futureValue(1000, 5, 10)).toBeCloseTo(1628.894626777442, 6);
    expect(presentValueAmount(1628.894626777442, 5, 10)).toBeCloseTo(1000, 6);
    const annuity = annuityFutureValue(100, 6, 5, 12);
    expect(annuity).toBeGreaterThan(6900);
    expect(annuityFutureValue(100, 0, 5, 12)).toBeCloseTo(6000, 8);
  });
});

describe('loans', () => {
  it('computes an EMI against the standard formula', () => {
    const result = loanPayment({ principal: 200000, annualRatePercent: 6, years: 30 });
    expect(result.numberOfPayments).toBe(360);
    // M = P·r / (1 − (1+r)^-n)
    const r = 0.06 / 12;
    const expected = (200000 * r) / (1 - (1 + r) ** -360);
    expect(result.payment).toBeCloseTo(expected, 6);
    expect(result.payment).toBeCloseTo(1199.1010451094, 4);
    expect(result.totalPaid).toBeCloseTo(result.payment * 360, 6);
    expect(result.schedule).toHaveLength(360);
    expect(result.schedule[0]!.interest).toBeCloseTo(1000, 6);
    expect(result.schedule[0]!.principal).toBeCloseTo(result.payment - 1000, 6);
    expect(result.schedule[359]!.balance).toBeCloseTo(0, 4);
  });

  it('handles zero-interest loans', () => {
    const result = loanPayment({ principal: 1200, annualRatePercent: 0, years: 1 });
    expect(result.payment).toBeCloseTo(100, 10);
    expect(result.totalInterest).toBeCloseTo(0, 10);
  });

  it('validates inputs', () => {
    expect(() => loanPayment({ principal: 0, annualRatePercent: 5, years: 1 })).toThrowError(/positive/);
    expect(() => loanPayment({ principal: 1000, annualRatePercent: 5, years: 0 })).toThrowError(/greater than zero/);
  });
});

describe('investment and percentages', () => {
  it('computes ROI and annualised returns', () => {
    const result = roi(1000, 1500, 2);
    expect(result.gain).toBeCloseTo(500, 10);
    expect(result.roiPercent).toBeCloseTo(50, 10);
    expect(result.annualisedPercent).toBeCloseTo((1.5 ** 0.5 - 1) * 100, 8);
    expect(roi(1000, 1500).annualisedPercent).toBeNull();
    expect(() => roi(0, 100)).toThrowError(/cannot be zero/);
  });

  it('computes percentage change and ratios', () => {
    expect(percentageChange(200, 250)).toBeCloseTo(25, 10);
    expect(percentageChange(250, 200)).toBeCloseTo(-20, 10);
    expect(percentageOf(15, 200)).toBeCloseTo(30, 10);
    expect(percentageRatio(25, 200)).toBeCloseTo(12.5, 10);
    expect(() => percentageChange(0, 5)).toThrowError(CalcError);
    expect(() => percentageRatio(5, 0)).toThrowError(CalcError);
  });

  it('computes discounts with tax', () => {
    const result = discount(100, 20, 10);
    expect(result.discountAmount).toBeCloseTo(20, 10);
    expect(result.priceAfterDiscount).toBeCloseTo(80, 10);
    expect(result.tax).toBeCloseTo(8, 10);
    expect(result.finalPrice).toBeCloseTo(88, 10);
  });

  it('computes tips and bill splits', () => {
    const result = tip(80, 15, 4);
    expect(result.tipAmount).toBeCloseTo(12, 10);
    expect(result.total).toBeCloseTo(92, 10);
    expect(result.perPerson).toBeCloseTo(23, 10);
    const split = splitBill(100, 3, 10);
    expect(split.perPerson).toBeCloseTo(110 / 3, 10);
    expect(() => splitBill(100, 0)).toThrowError(/people/);
  });
});

describe('dates and times', () => {
  it('computes day differences with calendar breakdown', () => {
    const result = daysBetween('2024-01-01', '2024-03-01');
    expect(result.days).toBe(60);
    expect(result.weeks).toBeCloseTo(60 / 7, 10);
    expect(result.breakdown).toEqual({ years: 0, months: 2, days: 0 });
    expect(result.businessDays).toBe(44);
  });

  it('handles leap years and reverse order', () => {
    expect(daysBetween('2024-02-28', '2024-03-01').days).toBe(2);
    expect(daysBetween('2023-02-28', '2023-03-01').days).toBe(1);
    expect(daysBetween('2024-03-01', '2024-01-01').days).toBe(-60);
  });

  it('computes age and the next birthday', () => {
    const result = age('1990-06-15', '2024-06-20');
    expect(result.breakdown).toEqual({ years: 34, months: 0, days: 5 });
    expect(result.nextBirthdayInDays).toBeCloseTo(360, 6);
    expect(() => age('2030-01-01', '2024-01-01')).toThrowError(/after the reference date/);
    expect(() => daysBetween('01-01-2024', '2024-01-02')).toThrowError(/YYYY-MM-DD/);
  });

  it('computes time differences including midnight wrap', () => {
    const day = timeDifference('09:30', '17:45');
    expect(day.hours).toBe(8);
    expect(day.minutes).toBe(15);
    expect(day.totalMinutes).toBeCloseTo(495, 10);

    const overnight = timeDifference('22:00', '01:30');
    expect(overnight.hours).toBe(3);
    expect(overnight.minutes).toBe(30);

    const withSeconds = timeDifference('10:00:30', '10:01:45');
    expect(withSeconds.totalSeconds).toBe(75);
    expect(() => timeDifference('25:00', '10:00')).toThrowError(/valid time/);
    expect(() => timeDifference('abc', '10:00')).toThrowError(CalcError);
  });
});
