import { describe, expect, it } from 'vitest';
import { findShortcut, formatBinding, isTypingTarget, matchesBinding, nextToolIndex } from './shortcuts';

describe('shortcut matching', () => {
  it('treats Ctrl and Cmd as the same primary modifier', () => {
    expect(matchesBinding({ key: 'k', ctrlKey: true }, { key: 'k', primary: true })).toBe(true);
    expect(matchesBinding({ key: 'K', metaKey: true }, { key: 'k', primary: true })).toBe(true);
    expect(matchesBinding({ key: 'k' }, { key: 'k', primary: true })).toBe(false);
  });

  it('requires the modifiers that were asked for', () => {
    expect(matchesBinding({ key: 'd' }, { key: 'd', alt: true })).toBe(false);
    expect(matchesBinding({ key: 'd', altKey: true }, { key: 'd', alt: true })).toBe(true);
    expect(matchesBinding({ key: 'd', altKey: true, ctrlKey: true }, { key: 'd', alt: true })).toBe(false);
    expect(matchesBinding({ key: '?', shiftKey: true }, { key: '?', shift: true })).toBe(true);
    expect(matchesBinding({ key: 'Escape' }, { key: 'escape' })).toBe(true);
  });

  it('finds shortcuts by event', () => {
    expect(findShortcut({ key: 'k', ctrlKey: true })?.id).toBe('palette');
    expect(findShortcut({ key: '/', shiftKey: true })?.id).toBe('palette.slash');
    expect(findShortcut({ key: 'x' })).toBeUndefined();
  });

  it('formats bindings for each platform', () => {
    expect(formatBinding({ key: 'k', primary: true }, false)).toBe('Ctrl+K');
    expect(formatBinding({ key: 'k', primary: true }, true)).toBe('⌘K');
    expect(formatBinding({ key: 'd', alt: true }, false)).toBe('Alt+D');
    expect(formatBinding({ key: 'Escape' }, false)).toBe('Esc');
  });

  it('detects typing surfaces so shortcuts do not hijack typing', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'textarea' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('cycles tool indexes in both directions', () => {
    expect(nextToolIndex(0, -1, 4)).toBe(3);
    expect(nextToolIndex(3, 1, 4)).toBe(0);
    expect(nextToolIndex(0, 1, 0)).toBe(0);
  });
});
