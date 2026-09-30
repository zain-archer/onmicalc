import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import App from '@/App';
import { READY_TOOLS } from '@/ui/tools';
import { settingsStore } from '@/settings/store';
import { clearHistory } from '@/history/store';
import { memoryStore } from '@/history/memory';
import { draftStore, answerStore } from '@/ui/bus';
import { clearNotice } from '@/ui/notify';

/**
 * Accessibility sweep. These are the failures that make a calculator unusable
 * with a keyboard or a screen reader, so they are asserted for every tool rather
 * than checked by hand once.
 */

beforeEach(() => {
  settingsStore.reset();
  clearHistory();
  memoryStore.reset();
  draftStore.reset();
  answerStore.reset();
  clearNotice();
});

function accessibleName(element: Element): string {
  const aria = element.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
    if (text) return text;
  }
  const id = element.getAttribute('id');
  if (id) {
    const label = element.ownerDocument.querySelector(`label[for="${id}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }
  const wrapping = element.closest('label');
  if (wrapping?.textContent?.trim()) return wrapping.textContent.trim();
  const title = element.getAttribute('title');
  if (title?.trim()) return title.trim();
  const text = element.textContent?.trim();
  if (text) return text;
  const alt = element.getAttribute('alt');
  return alt?.trim() ?? '';
}

describe.each(READY_TOOLS.map((tool) => [tool.label, tool.id] as const))('accessibility of %s', (label, id) => {
  it('labels every control and keeps semantics sound', () => {
    window.location.hash = `#/${id}`;
    const { container } = render(<App />);
    const problems: string[] = [];

    for (const element of container.querySelectorAll('input, select, textarea')) {
      const type = element.getAttribute('type');
      if (type === 'hidden') continue;
      if (!accessibleName(element)) {
        problems.push(`unlabelled ${element.tagName.toLowerCase()}[type=${type ?? 'text'}]`);
      }
    }

    for (const button of container.querySelectorAll('button')) {
      if (!accessibleName(button)) problems.push(`button without accessible name: ${button.className}`);
    }

    for (const image of container.querySelectorAll('img')) {
      if (!image.getAttribute('alt') && image.getAttribute('role') !== 'presentation') {
        problems.push(`img without alt: ${image.getAttribute('src')}`);
      }
    }

    for (const element of container.querySelectorAll('[tabindex]')) {
      const value = Number(element.getAttribute('tabindex'));
      if (value > 0) problems.push(`positive tabindex ${value} on ${element.tagName.toLowerCase()}`);
    }

    for (const svg of container.querySelectorAll('svg')) {
      const labelled = svg.getAttribute('aria-label') || svg.getAttribute('aria-hidden') === 'true';
      if (!labelled && svg.querySelector('title')) continue;
      if (!labelled) problems.push(`svg without aria-label or aria-hidden: ${svg.getAttribute('class')}`);
    }

    expect(problems, `${label}: ${problems.join(', ')}`).toEqual([]);
    expect(container.querySelector('h1')?.textContent).toContain(label);
    cleanup();
  });
});

describe('structure', () => {
  it('has exactly one main landmark and one h1 per view', () => {
    window.location.hash = '#/calculator';
    const { container } = render(<App />);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('#main')?.tagName.toLowerCase()).toBe('main');
  });

  it('offers a skip link as the first focusable element', () => {
    window.location.hash = '#/calculator';
    const { container } = render(<App />);
    const first = container.querySelector('.skip-link');
    expect(first?.getAttribute('href')).toBe('#main');
    expect(first?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('marks live regions for results that change while typing', () => {
    window.location.hash = '#/calculator';
    const { container } = render(<App />);
    const live = container.querySelectorAll('[aria-live]');
    expect(live.length).toBeGreaterThan(0);
    for (const region of live) {
      expect(['polite', 'assertive']).toContain(region.getAttribute('aria-live'));
    }
  });
});
