import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FinancePanel } from './FinancePanel';

const setField = (label: string | RegExp | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
const setAny = (label: string | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('finance panel', () => {
  it('computes a loan payment', () => {
    render(<FinancePanel />);
    setAny(/^Loan amount/, '200000');
    setAny(/^Annual interest rate/, '6');
    setAny(/^Term/, '30');
    expect(screen.getAllByText('1,199.1').length).toBeGreaterThan(0);
    expect(screen.getByText('360')).toBeTruthy();
  });

  it('shows an amortisation table', () => {
    render(<FinancePanel />);
    expect(screen.getByText(/Amortisation schedule/)).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('rejects an impossible loan', () => {
    render(<FinancePanel />);
    setField(/Loan amount/, '0');
    expect(screen.getByText(/Loan amount must be positive/i)).toBeTruthy();
  });

  it('computes simple and compound interest', () => {
    render(<FinancePanel />);
    setAny(/^Principal/, '1000');
    setAny(/^Annual rate/, '5');
    setAny(/^Years/, '3');
    expect(screen.getByText('150')).toBeTruthy();
    setAny(/^Compounds per year/, '12');
    setAny(/^Years/, '10');
    expect(screen.getAllByText(/1,647|1,628/).length).toBeGreaterThan(0);
  });

  it('computes ROI and percentages', () => {
    render(<FinancePanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Investment' }));
    setAny(/^Initial value/, '1000');
    setAny(/^Final value/, '1500');
    expect(screen.getByText('50%')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Percentages' }));
    setAny(/^Percent/, '15');
    setAny(/^Of value/, '200');
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('computes date, age and time differences', () => {
    render(<FinancePanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Dates & time' }));
    setAny(/^Start date/, '2024-01-01');
    setAny(/^End date/, '2024-03-01');
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByText('44')).toBeTruthy();
    setAny(/^Start time/, '09:30');
    setAny(/^End time/, '17:45');
    expect(screen.getByText('8 h 15 min 0 s')).toBeTruthy();
  });

  it('explains invalid dates', () => {
    render(<FinancePanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Dates & time' }));
    setAny(/^Start date/, '01/01/2024');
    expect(screen.getByText(/YYYY-MM-DD format/i)).toBeTruthy();
  });
});
