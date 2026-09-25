/** World ↔ screen transforms and tick generation for the graph. */

export interface Viewport {
  /** World coordinates of the centre of the view. */
  centerX: number;
  centerY: number;
  /** World units per 100 screen pixels (independent per axis). */
  scaleX: number;
  scaleY: number;
}

export interface Size {
  width: number;
  height: number;
}

export const DEFAULT_VIEWPORT: Viewport = { centerX: 0, centerY: 0, scaleX: 20, scaleY: 20 };

export function worldToScreenX(viewport: Viewport, x: number, size: Size): number {
  return size.width / 2 + (x - viewport.centerX) / viewport.scaleX;
}

export function worldToScreenY(viewport: Viewport, y: number, size: Size): number {
  return size.height / 2 - (y - viewport.centerY) / viewport.scaleY;
}

export function screenToWorldX(viewport: Viewport, px: number, size: Size): number {
  return viewport.centerX + (px - size.width / 2) * viewport.scaleX;
}

export function screenToWorldY(viewport: Viewport, py: number, size: Size): number {
  return viewport.centerY - (py - size.height / 2) * viewport.scaleY;
}

export function visibleBounds(viewport: Viewport, size: Size) {
  return {
    minX: screenToWorldX(viewport, 0, size),
    maxX: screenToWorldX(viewport, size.width, size),
    minY: screenToWorldY(viewport, size.height, size),
    maxY: screenToWorldY(viewport, 0, size),
  };
}

/** Zoom about the view centre by a factor (>1 zooms in). */
export function zoom(viewport: Viewport, factor: number): Viewport {
  const safe = Math.max(1e-6, Math.min(1e6, factor));
  return {
    ...viewport,
    scaleX: clampScale(viewport.scaleX / safe),
    scaleY: clampScale(viewport.scaleY / safe),
  };
}

/** Zoom about a screen anchor so the world point under the cursor stays fixed. */
export function zoomAt(viewport: Viewport, factor: number, px: number, py: number, size: Size): Viewport {
  const worldX = screenToWorldX(viewport, px, size);
  const worldY = screenToWorldY(viewport, py, size);
  const zoomed = zoom(viewport, factor);
  return {
    ...zoomed,
    centerX: worldX - (px - size.width / 2) * zoomed.scaleX,
    centerY: worldY + (py - size.height / 2) * zoomed.scaleY,
  };
}

function clampScale(value: number): number {
  return Math.max(1e-12, Math.min(1e12, value));
}

export function pan(viewport: Viewport, dxPixels: number, dyPixels: number): Viewport {
  return {
    ...viewport,
    centerX: viewport.centerX - dxPixels * viewport.scaleX,
    centerY: viewport.centerY + dyPixels * viewport.scaleY,
  };
}

/** "Nice" tick step: 1, 2 or 5 × 10ⁿ covering roughly `target` divisions. */
export function niceStep(span: number, target = 10): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  const step = normalised <= 1.5 ? 1 : normalised <= 3.5 ? 2 : normalised <= 7.5 ? 5 : 10;
  return step * magnitude;
}

export interface Ticks {
  step: number;
  values: number[];
}

export function ticksFor(min: number, max: number, target = 10): Ticks {
  const step = niceStep(max - min, target);
  const first = Math.ceil(min / step) * step;
  const values: number[] = [];
  for (let value = first; value <= max + step / 1000 && values.length < 400; value += step) {
    values.push(Math.abs(value) < step / 1e6 ? 0 : value);
  }
  return { step, values };
}

export function formatTick(value: number, step: number): string {
  const decimals = Math.max(0, Math.min(8, Math.ceil(-Math.log10(step))));
  if (Math.abs(value) >= 1e5 || (Math.abs(value) < 1e-4 && value !== 0)) return value.toExponential(1);
  return value.toFixed(decimals).replace(/\.?0+$/, '') || '0';
}
