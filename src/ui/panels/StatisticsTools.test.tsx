import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FitTool, InferenceTool, ShapeTool } from './StatisticsTools';

const setField = (label: string | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('shape and spread tool', () => {
  it('summarises the shape, spread and outliers of a dataset', () => {
    render(<ShapeTool />);
    expect(screen.getByText(/Skewness \(sample\)/)).toBeTruthy();
    expect(screen.getAllByText('9').length).toBeGreaterThan(0); // the single outlier of the default data
    expect(screen.getByText(/Spearman rank correlation/)).toBeTruthy();
    expect(screen.getByText(/Histogram/)).toBeTruthy();
  });

  it('asks for numbers when the input is not numeric', () => {
    render(<ShapeTool />);
    setField(/^Data/, 'two, four');
    expect(screen.getByText(/Enter numbers separated by commas/)).toBeTruthy();
  });
});

describe('curve fitting tool', () => {
  it('fits the default quadratic data and predicts from it', () => {
    render(<FitTool />);
    expect(screen.getByText(/^y = /)).toBeTruthy();
    expect(screen.getByText(/Adjusted R²/)).toBeTruthy();
    expect(screen.getByText(/Prediction at x =/)).toBeTruthy();
  });

  it('explains when a model cannot be used for the data', () => {
    render(<FitTool />);
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'power' } });
    setField(/^x values/, '-1, 0, 1');
    setField(/^y values/, '1, 2, 3');
    expect(screen.getByText(/positive x and y/)).toBeTruthy();
  });

  it('fits several explanatory variables', () => {
    render(<FitTool />);
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'multiple' } });
    setField(/^x values/, '1, 2, 3, 4, 5, 6');
    setField(/^y values/, '3, 3, 4, 3, 1, 4');
    expect(screen.getAllByText(/adjusted R²/i).length).toBeGreaterThan(0);
  });
});

describe('hypothesis test tool', () => {
  it('runs the t tests and reports intervals', () => {
    render(<InferenceTool />);
    expect(screen.getByText(/One-sample t test/)).toBeTruthy();
    expect(screen.getByText(/Welch's two-sample t test/)).toBeTruthy();
    expect(screen.getByText(/Confidence interval for the mean/)).toBeTruthy();
  });

  it('runs the chi-square tests from counts and a contingency table', () => {
    render(<InferenceTool />);
    expect(screen.getByText(/Chi-square goodness of fit/)).toBeTruthy();
    expect(screen.getByText(/Chi-square test of independence/)).toBeTruthy();
    expect(screen.getByText(/Expected counts \(first row\)/)).toBeTruthy();
  });

  it('reports the proportion interval and sample sizes', () => {
    render(<InferenceTool />);
    expect(screen.getByText(/One-proportion z test/)).toBeTruthy();
    expect(screen.getByText(/Wilson score interval/)).toBeTruthy();
    setField(/^Trials$/, '0');
    expect(screen.getByText(/whole numbers/)).toBeTruthy();
  });
});
