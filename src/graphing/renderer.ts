/**
 * Canvas renderer for professional graphing
 */
import { worldToScreenX, worldToScreenY, ticksFor, formatTick, type Viewport, type Size, visibleBounds } from './viewport';
import type { Polyline } from './sampling';
import type { Segment2D } from './implicit';
import type { ParametricPolyline } from './extendedSampling';

export interface RenderOptions {
  showGrid: boolean;
  showAxes: boolean;
  showLabels: boolean;
  showMinorGrid: boolean;
  backgroundColor?: string;
}

export interface ThemeColors {
  bgInset: string;
  border: string;
  textDim: string;
}

const FALLBACK_COLORS: ThemeColors = {
  bgInset: '#0e1425',
  border: 'rgba(128,128,128,0.2)',
  textDim: '#a3adc9',
};

export function renderGrid(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  size: Size,
  options: RenderOptions,
  theme: ThemeColors = FALLBACK_COLORS
) {
  const bounds = visibleBounds(viewport, size);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  // Clear
  ctx.fillStyle = options.backgroundColor || theme.bgInset;
  ctx.fillRect(0, 0, size.width, size.height);

  if (!options.showGrid) return;

  const xTicks = ticksFor(bounds.minX, bounds.maxX, Math.max(6, Math.round(size.width / 80)));
  const yTicks = ticksFor(bounds.minY, bounds.maxY, Math.max(6, Math.round(size.height / 80)));

  // Minor grid
  if (options.showMinorGrid) {
    const xMinorStep = xTicks.step / 5;
    const yMinorStep = yTicks.step / 5;
    ctx.strokeStyle = 'rgba(128,128,128,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const xMinMinor = Math.ceil(bounds.minX / xMinorStep) * xMinorStep;
    for (let x = xMinMinor; x <= bounds.maxX; x += xMinorStep) {
      if (Math.abs(x) < xTicks.step / 1e6) continue;
      if (xTicks.values.some(v => Math.abs(v - x) < xMinorStep * 0.1)) continue;
      const px = worldToScreenX(viewport, x, size);
      ctx.moveTo(px, 0);
      ctx.lineTo(px, size.height);
    }
    const yMinMinor = Math.ceil(bounds.minY / yMinorStep) * yMinorStep;
    for (let y = yMinMinor; y <= bounds.maxY; y += yMinorStep) {
      if (Math.abs(y) < yTicks.step / 1e6) continue;
      if (yTicks.values.some(v => Math.abs(v - y) < yMinorStep * 0.1)) continue;
      const py = worldToScreenY(viewport, y, size);
      ctx.moveTo(0, py);
      ctx.lineTo(size.width, py);
    }
    ctx.stroke();
  }

  // Major grid
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const x of xTicks.values) {
    if (Math.abs(x) < xTicks.step / 1e6) continue;
    const px = worldToScreenX(viewport, x, size);
    ctx.moveTo(px, 0);
    ctx.lineTo(px, size.height);
  }
  for (const y of yTicks.values) {
    if (Math.abs(y) < yTicks.step / 1e6) continue;
    const py = worldToScreenY(viewport, y, size);
    ctx.moveTo(0, py);
    ctx.lineTo(size.width, py);
  }
  ctx.stroke();

  // Axes
  if (options.showAxes) {
    ctx.strokeStyle = theme.textDim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const y0 = worldToScreenY(viewport, 0, size);
    if (y0 >= 0 && y0 <= size.height) {
      ctx.moveTo(0, y0);
      ctx.lineTo(size.width, y0);
    }
    const x0 = worldToScreenX(viewport, 0, size);
    if (x0 >= 0 && x0 <= size.width) {
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, size.height);
    }
    ctx.stroke();
  }

  // Labels
  if (options.showLabels) {
    ctx.fillStyle = theme.textDim;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const y0 = worldToScreenY(viewport, 0, size);
    const labelY = Math.min(size.height - 4, Math.max(12, y0 + 4));
    for (const x of xTicks.values) {
      if (Math.abs(x) < xTicks.step / 1e6) continue;
      const px = worldToScreenX(viewport, x, size);
      if (px < 20 || px > size.width - 20) continue;
      ctx.fillText(formatTick(x, xTicks.step), px, labelY);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const x0 = worldToScreenX(viewport, 0, size);
    const labelX = Math.min(size.width - 4, Math.max(30, x0 - 6));
    for (const y of yTicks.values) {
      if (Math.abs(y) < yTicks.step / 1e6) continue;
      const py = worldToScreenY(viewport, y, size);
      if (py < 10 || py > size.height - 10) continue;
      ctx.fillText(formatTick(y, yTicks.step), labelX, py);
    }
    if (Math.abs(bounds.minX) < width * 0.9 && Math.abs(bounds.maxX) > width * 0.1 && Math.abs(bounds.minY) < height * 0.9 && Math.abs(bounds.maxY) > height * 0.1) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const ox = worldToScreenX(viewport, 0, size);
      const oy = worldToScreenY(viewport, 0, size);
      if (ox >= 0 && ox <= size.width && oy >= 0 && oy <= size.height) {
        ctx.fillText('0', ox + 4, oy + 4);
      }
    }
  }
}

export function renderPolylines(
  ctx: CanvasRenderingContext2D,
  polylines: Polyline[],
  viewport: Viewport,
  size: Size,
  color: string,
  lineWidth: number,
  lineStyle: 'solid' | 'dashed' | 'dotted' = 'solid',
  alpha = 1
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (lineStyle === 'dashed') ctx.setLineDash([8, 4]);
  else if (lineStyle === 'dotted') ctx.setLineDash([2, 4]);
  else ctx.setLineDash([]);

  for (const line of polylines) {
    if (line.points.length < 2) continue;
    ctx.beginPath();
    let first = true;
    for (const p of line.points) {
      const sx = worldToScreenX(viewport, p.x, size);
      const sy = worldToScreenY(viewport, p.y, size);
      if (first) {
        ctx.moveTo(sx, sy);
        first = false;
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

export function renderParametric(
  ctx: CanvasRenderingContext2D,
  polylines: ParametricPolyline[],
  viewport: Viewport,
  size: Size,
  color: string,
  lineWidth: number,
  lineStyle: 'solid' | 'dashed' | 'dotted' = 'solid'
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (lineStyle === 'dashed') ctx.setLineDash([8, 4]);
  else if (lineStyle === 'dotted') ctx.setLineDash([2, 4]);
  else ctx.setLineDash([]);

  for (const line of polylines) {
    if (line.points.length < 2) continue;
    ctx.beginPath();
    let first = true;
    for (const p of line.points) {
      const sx = worldToScreenX(viewport, p.x, size);
      const sy = worldToScreenY(viewport, p.y, size);
      if (first) {
        ctx.moveTo(sx, sy);
        first = false;
      } else {
        ctx.lineTo(sx, sy);
      }
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

export function renderImplicit(
  ctx: CanvasRenderingContext2D,
  segments: Segment2D[],
  viewport: Viewport,
  size: Size,
  color: string,
  lineWidth: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (const seg of segments) {
    const ax = worldToScreenX(viewport, seg.a.x, size);
    const ay = worldToScreenY(viewport, seg.a.y, size);
    const bx = worldToScreenX(viewport, seg.b.x, size);
    const by = worldToScreenY(viewport, seg.b.y, size);
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.stroke();
}

export function renderInequalityRegion(
  ctx: CanvasRenderingContext2D,
  regions: { x: number; y1: number; y2: number }[],
  viewport: Viewport,
  size: Size,
  color: string
) {
  if (regions.length < 2) return;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  let first = true;
  // Top edge
  for (const r of regions) {
    const sx = worldToScreenX(viewport, r.x, size);
    const sy = worldToScreenY(viewport, r.y1, size);
    if (first) {
      ctx.moveTo(sx, sy);
      first = false;
    } else {
      ctx.lineTo(sx, sy);
    }
  }
  // Bottom edge reverse
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i]!;
    const sx = worldToScreenX(viewport, r.x, size);
    const sy = worldToScreenY(viewport, r.y2, size);
    ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function renderIntegralShade(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  viewport: Viewport,
  size: Size,
  color: string,
  baselineY = 0
) {
  if (points.length < 2) return;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  const first = points[0]!;
  ctx.moveTo(worldToScreenX(viewport, first.x, size), worldToScreenY(viewport, baselineY, size));
  for (const p of points) {
    ctx.lineTo(worldToScreenX(viewport, p.x, size), worldToScreenY(viewport, p.y, size));
  }
  const last = points[points.length - 1]!;
  ctx.lineTo(worldToScreenX(viewport, last.x, size), worldToScreenY(viewport, baselineY, size));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function renderPoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  viewport: Viewport,
  size: Size,
  color: string,
  radius = 4
) {
  const sx = worldToScreenX(viewport, x, size);
  const sy = worldToScreenY(viewport, y, size);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function renderCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  viewport: Viewport,
  size: Size
) {
  const sx = worldToScreenX(viewport, x, size);
  const sy = worldToScreenY(viewport, y, size);
  ctx.strokeStyle = 'rgba(128,128,128,0.4)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sx, 0);
  ctx.lineTo(sx, size.height);
  ctx.moveTo(0, sy);
  ctx.lineTo(size.width, sy);
  ctx.stroke();
  ctx.setLineDash([]);
}
