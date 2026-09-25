import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CalculatorPanel } from './CalculatorPanel';
import { draftStore, answerStore } from '@/ui/bus';
import { historyStore, clearHistory } from '@/history/store';
import { memoryStoreValue } from '@/history/memory';
import { settingsStore } from '@/settings/store';

beforeEach(() => {
  draftStore.reset();
  answerStore.reset();
  clearHistory();
  settingsStore.reset();
  memoryStoreValue(0);
});

const type = (text: string) => {
  const input = screen.getByLabelText('Expression') as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  return input;
};

describe('calculator panel', () => {
  it('evaluates as you type and shows the formatted result', () => {
    render(<CalculatorPanel />);
    type('2+3*4');
    expect(screen.getByTestId('calc-value').textContent).toContain('14');
  });

  it('shows a specific message instead of a wrong answer', () => {
    render(<CalculatorPanel />);
    type('1/0');
    expect(screen.getByRole('alert').textContent).toMatch(/Division by zero/i);
  });

  it('switches angle mode and keeps it visible', () => {
    render(<CalculatorPanel />);
    type('sin(180)');
    expect(screen.getByTestId('calc-value').textContent).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'RAD' }));
    expect(settingsStore.get().angleMode).toBe('RAD');
    expect(screen.getByTestId('calc-value').textContent).not.toBe('0');
  });

  it('records history and exposes ans after evaluation', () => {
    render(<CalculatorPanel />);
    const input = type('6*7');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(historyStore.get().entries[0]!.expression).toBe('6*7');
    expect(historyStore.get().entries[0]!.display).toBe('42');
    expect(answerStore.get().value).toBe(42);
  });

  it('inserts snippets from the keypad and basic keys', () => {
    render(<CalculatorPanel />);
    fireEvent.click(screen.getByTitle('Divide'));
    expect((screen.getByLabelText('Expression') as HTMLInputElement).value).toBe('÷');

    fireEvent.click(screen.getByRole('tab', { name: 'Scientific' }));
    fireEvent.click(screen.getByTitle('Square root'));
    expect((screen.getByLabelText('Expression') as HTMLInputElement).value).toBe('÷sqrt(');

    fireEvent.click(screen.getByRole('tab', { name: 'Basic' }));
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    expect((screen.getByLabelText('Expression') as HTMLInputElement).value).toBe('÷sqrt7(');
  });

  it('switches the trig row with INV and HYP', () => {
    render(<CalculatorPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Scientific' }));
    fireEvent.click(screen.getByRole('button', { name: 'INV' }));
    expect(screen.getByTitle('asin()')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'HYP' }));
    expect(screen.getByTitle('asinh()')).toBeTruthy();
  });

  it('supports memory add and recall', () => {
    render(<CalculatorPanel />);
    type('20');
    fireEvent.click(screen.getByTitle('Add result to memory'));
    expect(screen.getByText(/M = 20/)).toBeTruthy();
    fireEvent.click(screen.getByTitle('Clear memory'));
    expect(screen.getByText(/M = 0/)).toBeTruthy();
    fireEvent.click(screen.getByTitle('Add result to memory'));
    fireEvent.click(screen.getByTitle('Recall memory'));
    expect((screen.getByLabelText('Expression') as HTMLInputElement).value).toBe('20m');
  });
});

describe('fraction display', () => {
  it('shows an exact fraction alongside the decimal', () => {
    render(<CalculatorPanel />);
    type('1/4+1/2');
    expect(screen.getByTitle('Click to insert the fraction form').textContent).toContain('3/4');
  });

  it('hides the fraction hint when decimals-only is selected', () => {
    settingsStore.set({ fractionMode: 'decimal' });
    render(<CalculatorPanel />);
    type('1/4+1/2');
    expect(screen.queryByTitle('Click to insert the fraction form')).toBeNull();
  });
});
