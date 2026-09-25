import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AppStatus } from './AppStatus';
import { captureInstallPrompt, resetInstallPrompt } from '@/pwa/install';
import { clearNotice, notify } from '@/ui/notify';

beforeEach(() => {
  clearNotice();
  resetInstallPrompt();
});

describe('status strip', () => {
  it('stays empty when online and nothing needs attention', () => {
    const { container } = render(<AppStatus />);
    expect(container.firstChild).toBeNull();
  });

  it('warns when offline and reassures that nothing is uploaded', () => {
    render(<AppStatus />);
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('status').textContent).toMatch(/Offline/);
    expect(screen.getByRole('status').textContent).toMatch(/nothing is sent anywhere/);
    fireEvent(window, new Event('online'));
  });

  it('offers the install prompt and can be dismissed', () => {
    const event = new Event('beforeinstallprompt');
    Object.assign(event, { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    render(<AppStatus />);
    fireEvent(window, event);
    expect(screen.getByText(/Install OmniCalc/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Dismiss the install suggestion'));
    expect(screen.queryByText(/Install OmniCalc/)).toBeNull();
    captureInstallPrompt(new Event('load'));
  });
});

describe('status strip notices', () => {
  it('shows and dismisses a transient notice', () => {
    render(<AppStatus />);
    act(() => notify('Backup downloaded.', 'ok'));
    expect(screen.getByText('Backup downloaded.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Dismiss message'));
    expect(screen.queryByText('Backup downloaded.')).toBeNull();
  });

  it('announces errors distinctly', () => {
    render(<AppStatus />);
    act(() => notify('That file is not valid JSON.', 'error'));
    expect(screen.getByRole('status').textContent).toMatch(/not valid JSON/);
    act(() => clearNotice());
  });
});
