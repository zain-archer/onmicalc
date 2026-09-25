import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EngineeringPanel } from './EngineeringPanel';

const setField = (label: string | RegExp, value: string, index = 0) => {
  fireEvent.change(screen.getAllByLabelText(label)[index]!, { target: { value } });
};

describe('engineering panel', () => {
  it('solves Ohm’s law from two known values', () => {
    render(<EngineeringPanel />);
    setField(/^Voltage/, '12');
    setField(/^Current/, '2');
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('24')).toBeTruthy();
  });

  it('asks for exactly two known values', () => {
    render(<EngineeringPanel />);
    setField(/^Resistance/, '5');
    setField(/^Power/, '10', 0);
    expect(screen.getByText(/exactly two known quantities/i)).toBeTruthy();
  });

  it('combines resistors in series and parallel', () => {
    render(<EngineeringPanel />);
    setField(/^Series resistors/, '100, 100');
    setField(/^Parallel resistors/, '100, 100');
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('computes physics quantities from the fields that are filled', () => {
    render(<EngineeringPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Physics' }));
    setField(/^Mass/, '10');
    setField(/Acceleration/, '2');
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getAllByText(/98\.066|98\.07/).length).toBeGreaterThan(0);
  });

  it('computes geometry and refuses impossible triangles', () => {
    render(<EngineeringPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Geometry' }));
    expect(screen.getByText('28.2743338823')).toBeTruthy(); // π·3²

    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: 'triangle' } });
    setField(/^Side a/, '1');
    setField(/^Side b/, '2');
    setField(/^Side c/, '10');
    expect(screen.getByText(/cannot form a triangle/i)).toBeTruthy();
  });

  it('refuses negative dimensions', () => {
    render(<EngineeringPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Geometry' }));
    setField(/^Radius/, '-1');
    expect(screen.getByText(/Radius must be non-negative/i)).toBeTruthy();
  });
});
