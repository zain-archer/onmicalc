import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import App from '@/App';
import { READY_TOOLS, getTool } from '@/ui/tools';
import { settingsStore } from '@/settings/store';
import { clearHistory } from '@/history/store';
import { memoryStore } from '@/history/memory';
import { answerStore, draftStore } from '@/ui/bus';
import { clearNotice } from '@/ui/notify';

/**
 * Interaction sweep: every tool is opened and every button inside it is pressed.
 *
 * This is the check that catches the failures a unit test cannot see — a panel
 * that throws while rendering, a button that reaches a state the maths never
 * gets, an event handler that assumes something about its inputs. A press is
 * allowed to change the screen, show an error or do nothing; it is not allowed
 * to crash the app, leave the view empty, or log a React error.
 */

let consoleErrors: string[] = [];
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  settingsStore.reset();
  clearHistory();
  memoryStore.reset();
  draftStore.reset();
  answerStore.reset();
  clearNotice();
  consoleErrors = [];
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  cleanup();
});

function assertNoConsoleErrors(label: string): void {
  // React logs render crashes and act() violations here; any of them is a bug.
  expect(consoleErrors, `${label}: ${consoleErrors.join(' | ')}`).toEqual([]);
}

function panelButtons(container: HTMLElement): HTMLButtonElement[] {
  // Buttons inside the panel host (the tool itself), plus its tabs.
  return [...container.querySelectorAll<HTMLButtonElement>('.panel-host button, .tool button, main button')];
}

/**
 * Panels load on demand (`React.lazy`), so waiting for the heading is not
 * enough — wait until the panel has actually rendered its controls.
 */
async function openTool(container: HTMLElement, label: string): Promise<void> {
  await waitFor(() => expect(container.querySelector('h1')?.textContent).toContain(label));
  await waitFor(
    () => {
      // A tool either offers controls or explains itself — never neither.
      const host = container.querySelector('.panel-host') ?? container;
      const controls = host.querySelectorAll('input, select, textarea, button').length;
      expect(controls > 0 || (host.textContent ?? '').length > 200).toBe(true);
    },
    { timeout: 4000 },
  );
}

describe.each(READY_TOOLS.map((tool) => [tool.label, tool.id] as const))('every button of %s', (label, id) => {
  it('survives being pressed', { timeout: 30000 }, async () => {
    window.location.hash = `#/${id}`;
    const { container } = render(<App />);
    await openTool(container, label);

    const buttons = panelButtons(container);
    // Every tool has to offer something to do — buttons or fields. A purely
    // informational tool (About) has neither, so it is checked for content.
    const controls = container.querySelectorAll('.panel-host input, .panel-host select, .panel-host textarea, .panel-host button');
    if (controls.length === 0) {
      expect((container.querySelector('.panel-host')?.textContent ?? '').length, `${label} shows nothing at all`).toBeGreaterThan(200);
      return;
    }

    const pressed: string[] = [];
    let guard = 0;
    for (let index = 0; index < buttons.length && guard < 25; index += 1) {
      const button = panelButtons(container)[index];
      if (!button || button.disabled) continue;
      const name = (button.textContent || button.getAttribute('aria-label') || button.title || 'unnamed').trim();
      pressed.push(name);
      guard += 1;
      expect(() => fireEvent.click(button), `${label}: pressing “${name}” threw`).not.toThrow();
      // The app must still be showing its panel after every press.
      expect(container.querySelector('main'), `${label}: view disappeared after “${name}”`).toBeTruthy();
      expect(container.querySelector('h1')?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
    assertNoConsoleErrors(`${label} buttons`);
  });

  it('can be opened twice in a row without losing state handling', { timeout: 30000 }, async () => {
    window.location.hash = `#/${id}`;
    const { unmount, container } = render(<App />);
    await openTool(container, label);
    unmount();
    const second = render(<App />);
    await openTool(second.container, label);
    const control = second.container.querySelector<HTMLElement>('.panel-host button, .panel-host input');
    if (control) {
      expect(() => fireEvent.click(control)).not.toThrow();
    }
    assertNoConsoleErrors(`${label} reopen`);
    cleanup();
  });
});

describe('shell controls', () => {
  it('has a route for every ready tool and an icon for each', () => {
    for (const tool of READY_TOOLS) {
      expect(getTool(tool.id)?.label).toBe(tool.label);
      expect(tool.icon.length).toBeGreaterThan(5);
      expect(tool.summary.length).toBeGreaterThan(10);
    }
  });

  it('presses the theme toggle, the palette and the shortcuts without breaking', async () => {
    window.location.hash = '#/calculator';
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelector('h1')).toBeTruthy());

    const shellButtons = [...container.querySelectorAll<HTMLButtonElement>('.topbar button, .sidebar button, .nav--bottom button')];
    expect(shellButtons.length).toBeGreaterThan(2);
    for (const button of shellButtons) {
      const name = (button.textContent || button.getAttribute('aria-label') || button.title || '').trim();
      if (/export|import|backup|download/i.test(name)) continue; // file actions, covered separately
      expect(() => fireEvent.click(button), `shell button “${name}” threw`).not.toThrow();
      expect(container.querySelector('h1')).toBeTruthy();
    }
    assertNoConsoleErrors('shell buttons');
  });

  it('routes through every hash in the address bar', { timeout: 60000 }, async () => {
    for (const tool of READY_TOOLS) {
      window.location.hash = `#/${tool.id}`;
      const { container } = render(<App />);
      await openTool(container, tool.label);
      cleanup();
    }
    // An unknown route falls back to something usable rather than a blank page.
    window.location.hash = '#/not-a-tool';
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelector('h1')).toBeTruthy());
    assertNoConsoleErrors('routing');
  });

  it('never shows a results area without input controls beside it', { timeout: 60000 }, async () => {
    for (const tool of READY_TOOLS) {
      window.location.hash = `#/${tool.id}`;
      const { container } = render(<App />);
      await openTool(container, tool.label);
      const controls = container.querySelectorAll('input, select, textarea, button[role="tab"]');
      const isInformational = (container.querySelector('.panel-host')?.textContent ?? '').length > 200;
      expect(controls.length > 0 || isInformational, `${tool.label} offers no input control and no content`).toBe(true);
      cleanup();
    }
  });
});
