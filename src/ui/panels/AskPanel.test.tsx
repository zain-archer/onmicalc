import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AskPanel } from './AskPanel';
import { clearHistory, historyStore } from '@/history/store';
import { askStore, draftStore, setAsk } from '@/ui/bus';
import { settingsStore } from '@/settings/store';

const headline = () => screen.getByTestId('ask-headline').textContent ?? '';

/** What the panel told the rest of the app (history and the draft box). */
const entriesSummary = () => historyStore.get().entries.map((entry) => entry.expression).join(' | ');

beforeEach(() => {
  clearHistory();
  draftStore.reset();
  askStore.reset();
  settingsStore.reset();
});

const ask = (text: string) => {
  const input = screen.getByLabelText('Your request') as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Solve it' }));
  return input;
};

describe('Ask OmniCalc panel', () => {
  it('greets the user with a single plain-language box', () => {
    render(<AskPanel />);
    expect(screen.getByRole('heading', { name: 'What do you want to do?' })).toBeDefined();
    expect(screen.getByLabelText('Your request')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Solve it' })).toBeDefined();
  });

  it('says which tool it will use before running anything', () => {
    render(<AskPanel />);
    const input = screen.getByLabelText('Your request') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'convert 5 km to miles' } });
    expect(screen.getByText(/I will convert units/i)).toBeDefined();
  });

  it('answers a plain-language request and shows the understood line', () => {
    render(<AskPanel />);
    ask('20 percent of 250');
    expect(headline()).toBe('50');
    expect(screen.getByTestId('ask-understood').textContent).toMatch(/20% of 250/);
  });

  it('solves from a starter chip', () => {
    render(<AskPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'solve 3x + 5 = 20' }));
    expect(headline()).toBe('x = 5');
  });

  it('sends the answer to the calculator', () => {
    render(<AskPanel />);
    ask('integrate x^2 from 0 to 3');
    fireEvent.click(screen.getByRole('button', { name: 'Send to calculator' }));
    expect(draftStore.get().text.length).toBeGreaterThan(0);
  });

  it('records successful answers in history', () => {
    render(<AskPanel />);
    ask('determinant of 1 2; 3 4');
    const entries = historyStore.get().entries;
    expect(entries.length).toBe(1);
    expect(entries[0]!.expression).toBe('determinant of 1 2; 3 4');
    expect(entries[0]!.value).toBe(-2);
  });

  it('accepts a whole sentence about money and shows a table of rows', () => {
    render(<AskPanel />);
    ask('compound interest on 1000 at 5 percent for 10 years');
    expect(headline()).toBe('1,600');
    expect(screen.getByRole('table')).toBeDefined();
  });

  it('offers alternatives instead of guessing', () => {
    render(<AskPanel />);
    ask('zzz qqq');
    expect(screen.getByRole('alert').textContent).toMatch(/could not tell which tool/i);
    expect(screen.getByText('Did you mean:')).toBeDefined();
  });

  it('shows a friendly explanation when a value is missing', () => {
    render(<AskPanel />);
    ask('20 percent');
    expect(screen.getByRole('alert').textContent).toMatch(/percentage and a value/i);
  });

  it('lets people fill the values by hand', () => {
    render(<AskPanel />);
    ask('20 percent of 250');
    expect(headline()).toBe('50');
    const percent = screen.getByLabelText(/^Percent/) as HTMLInputElement;
    expect(percent.value).toBe('20');
    fireEvent.change(percent, { target: { value: '15' } });
    const whole = screen.getByLabelText(/^Of what/) as HTMLInputElement;
    fireEvent.change(whole, { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solve with these values' }));
    expect(headline()).toBe('30');
  });

  it('lists everything it can do, grouped', () => {
    render(<AskPanel />);
    fireEvent.click(screen.getByText('Everything you can ask'));
    expect(screen.getByRole('button', { name: 'Solve an equation' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Matrix calculations' })).toBeDefined();
    expect(screen.getByText('Algebra & equations')).toBeDefined();
  });

  it('runs a request handed over from the command palette', () => {
    setAsk('days between 2024-01-01 and 2026-09-25');
    render(<AskPanel />);
    expect(headline()).toBe('998 days');
    expect((screen.getByLabelText('Your request') as HTMLInputElement).value).toBe(
      'days between 2024-01-01 and 2026-09-25',
    );
  });

  it('understands a request with typos and says what it assumed', () => {
    render(<AskPanel />);
    ask('convret 5 km to miels');
    expect(headline()).toMatch(/3\.106855961/);
    const corrections = screen.getByTestId('ask-corrections').textContent ?? '';
    expect(corrections).toMatch(/“convret” as “convert”/);
    expect(corrections).toMatch(/“miels” as “miles”/);
    // History keeps the user's own words, so they can recognise the entry later.
    expect(entriesSummary()).toMatch(/convret 5 km to miels/);
  });

  it('says nothing about typos when there were none', () => {
    render(<AskPanel />);
    ask('convert 5 km to miles');
    expect(screen.queryByTestId('ask-corrections')).toBeNull();
  });

  it('clears the form', () => {
    render(<AskPanel />);
    ask('20 percent of 250');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect((screen.getByLabelText('Your request') as HTMLInputElement).value).toBe('');
    expect(screen.queryByTestId('ask-headline')).toBeNull();
  });
});

describe('Ask OmniCalc — files', () => {
  it('reads a text file, lists its questions and answers the first one', async () => {
    render(<AskPanel />);
    const file = new File(['Chapter 1\nSolve 3x + 5 = 20\nWhat is 20 percent of 250?\n'], 'homework.txt', {
      type: 'text/plain',
    });
    const input = screen.getByLabelText('Attach a file with a question in it') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByTestId('ask-file')).toBeDefined();
    const headlineText = await screen.findByTestId('ask-headline');
    expect(headlineText.textContent ?? '').toMatch(/x\s*=\s*5/);

    fireEvent.click(screen.getByRole('button', { name: 'What is 20 percent of 250?' }));
    expect((await screen.findByTestId('ask-headline')).textContent ?? '').toContain('50');
  });

  it('never claims to read a picture', async () => {
    render(<AskPanel />);
    const file = new File([new Uint8Array([1, 2, 3])], 'question.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Attach a file with a question in it'), { target: { files: [file] } });

    const card = await screen.findByTestId('ask-file');
    expect(card.textContent ?? '').toMatch(/image recognition/i);
  });
});
