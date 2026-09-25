import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canInstall, captureInstallPrompt, isStandalone, promptInstall, resetInstallPrompt } from './install';

function fakePromptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt');
  Object.assign(event, {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  return event;
}

beforeEach(() => {
  resetInstallPrompt();
});

describe('install prompt', () => {
  it('ignores events that are not install prompts', () => {
    captureInstallPrompt(new Event('load'));
    expect(canInstall()).toBe(false);
  });

  it('captures a prompt and resolves with the user choice', async () => {
    const event = fakePromptEvent('accepted');
    captureInstallPrompt(event);
    expect(canInstall()).toBe(true);
    await expect(promptInstall()).resolves.toBe('accepted');
    // The prompt can only be used once.
    expect(canInstall()).toBe(false);
    await expect(promptInstall()).resolves.toBe('unavailable');
  });

  it('reports a dismissal', async () => {
    captureInstallPrompt(fakePromptEvent('dismissed'));
    await expect(promptInstall()).resolves.toBe('dismissed');
  });

  it('detects standalone display mode', () => {
    expect(typeof isStandalone()).toBe('boolean');
  });
});
