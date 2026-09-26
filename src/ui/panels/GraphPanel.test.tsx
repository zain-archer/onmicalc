import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GraphPanel } from './GraphPanel';


describe('GraphPanel calculation controls', () => {
  it('keeps range edits pending until Calculate graph is pressed', async () => {
    render(<GraphPanel />);

    const areaFrom = screen.getByLabelText('Area from') as HTMLInputElement;
    expect(screen.getByText(/∫ from -3 to 3/)).toBeTruthy();

    fireEvent.change(areaFrom, { target: { value: '0' } });

    expect(areaFrom.value).toBe('0');
    expect(screen.getByRole('status').textContent).toContain('Changes waiting');
    expect(screen.getByText(/∫ from -3 to 3/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Calculate graph' }));

    await waitFor(() => expect(screen.getByText(/∫ from 0 to 3/)).toBeTruthy());
    expect(screen.queryByText(/Changes waiting/)).toBeNull();
  });
});
