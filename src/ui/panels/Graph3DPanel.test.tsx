import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Graph3DPanel } from './Graph3DPanel';

const setField = (label: string | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('3D, vector field and contour panel', () => {
  it('draws a surface plot and reports its value range', () => {
    const { container } = render(<Graph3DPanel />);
    expect(screen.getByLabelText('Surface plot of z against x and y')).toBeTruthy();
    expect(container.querySelectorAll('polyline').length).toBeGreaterThan(4);
    setField(/^Surface z = f\(x, y\)/,  'x^2 + y^2');
    expect(screen.getByText(/Minimum z/)).toBeTruthy();
  });

  it('explains an expression it cannot plot instead of drawing nonsense', () => {
    render(<Graph3DPanel />);
    setField(/^Surface z = f\(x, y\)/,  'sin(');
    expect(screen.getByText(/could not be read as an expression/i)).toBeTruthy();
  });

  it('switches to a vector field with streamlines and stagnation points', () => {
    const { container } = render(<Graph3DPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Vector field' }));
    expect(screen.getByLabelText('Vector field with streamlines')).toBeTruthy();
    setField('Field x-component F₁(x, y)', '-y');
    setField('Field y-component F₂(x, y)', 'x');
    expect(screen.getByText(/Divergence at/)).toBeTruthy();
    expect(screen.getByText(/Stagnation points found/)).toBeTruthy();
    expect(container.querySelectorAll('circle').length).toBeGreaterThan(0);
  });

  it('draws contour lines and a heat map with a chosen palette', () => {
    const { container } = render(<Graph3DPanel />);
    fireEvent.click(screen.getByRole('tab', { name: 'Contour & heat map' }));
    expect(screen.getByLabelText('Contour plot with heat map')).toBeTruthy();
    expect(container.querySelectorAll('rect').length).toBeGreaterThan(50);
    expect(screen.getByText(/Levels:/)).toBeTruthy();
    setField('Colour palette', 'terrain');
    expect(screen.getByText(/Level spacing/)).toBeTruthy();
  });

  it('rotates the surface from the input fields', () => {
    render(<Graph3DPanel />);
    setField(/Rotation \(yaw\)/, '45');
    setField(/Tilt \(pitch\)/, '60');
    expect(screen.getByText('45° / 60°')).toBeTruthy();
  });
});
