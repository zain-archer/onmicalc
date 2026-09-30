import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom does not implement canvas getContext – provide a minimal stub so graphing tests don't crash
if (typeof HTMLCanvasElement !== 'undefined') {
  const original = HTMLCanvasElement.prototype.getContext;
  // @ts-ignore
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        arc: vi.fn(),
        closePath: vi.fn(),
        setTransform: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        setLineDash: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        measureText: () => ({ width: 0 }),
        createLinearGradient: () => ({ addColorStop: vi.fn() }),
        canvas: this,
      } as any;
    }
    // Fallback to original for other types (will still throw in jsdom but that's okay)
    try {
      return original?.call(this, type as any) as any;
    } catch {
      return null;
    }
  } as any;
}

// ResizeObserver is not implemented in jsdom – stub it
if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
