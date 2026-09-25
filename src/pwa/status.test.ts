import { describe, expect, it } from 'vitest';
import { currentOnlineStatus, subscribeOnlineStatus } from './status';

describe('online status', () => {
  it('reports the current connectivity', () => {
    expect(currentOnlineStatus()).toBe(true);
  });

  it('notifies subscribers about online and offline events', () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeOnlineStatus((online) => seen.push(online));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(seen).toEqual([false, true]);
    unsubscribe();
    window.dispatchEvent(new Event('offline'));
    expect(seen).toEqual([false, true]);
  });
});
