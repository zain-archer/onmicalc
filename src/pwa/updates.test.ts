import { describe, expect, it } from 'vitest';
import { initOfflineSupport } from './updates';

describe('offline support bootstrapping', () => {
  it('degrades gracefully when service workers are unavailable', async () => {
    const handle = initOfflineSupport();
    expect(handle.supported).toBe(false);
    expect(typeof handle.applyUpdate).toBe('function');
    await expect(handle.checkForUpdate()).resolves.toBe(false);
  });

  it('never asks for an update without a registration', async () => {
    const handle = initOfflineSupport({ onUpdateReady: () => undefined });
    await expect(handle.checkForUpdate()).resolves.toBe(false);
  });
});
