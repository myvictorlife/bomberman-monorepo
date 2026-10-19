import { createRng, MapId } from '@libs/game-core';
import { HD_TILE as S } from '../hd-palette';
import { ArenaMoment } from './moments';

export type Ctx = CanvasRenderingContext2D;

/**
 * An arena theme is the look of one map: the tiles the HD skin draws the
 * arena with, painted at runtime like the rest of the skin. It replaces only
 * the arena textures — players, bombs, flames and power-ups stay the skin's.
 */
export interface ArenaTheme {
  readonly id: MapId;
  /** CSS colour the pages use for this map's accent (cards, badges). */
  readonly accent: string;
  /** What the place does on its own over a match — a blackout, rain. Visual only. */
  readonly moment?: ArenaMoment;
  /** Paints every tile of the theme, keyed like `TEXTURE`, at `resolution` pixels per art unit. */
  paint(doc: Document, resolution?: number): Map<string, HTMLCanvasElement>;
}

export const TAU = Math.PI * 2;
export const OUTLINE = 'rgba(8, 10, 16, 0.78)';

/**
 * Runs `draw` on a fresh tile-sized canvas and stores it under `key`. The
 * art is drawn in 64 units; `resolution` is how many pixels each gets.
 */
export function tilePainter(
  doc: Document,
  resolution = 1,
): {
  paint: (key: string, draw: (ctx: Ctx) => void) => void;
  textures: Map<string, HTMLCanvasElement>;
} {
  const textures = new Map<string, HTMLCanvasElement>();
  const paint = (key: string, draw: (ctx: Ctx) => void) => {
    const canvas = doc.createElement('canvas');
    canvas.width = S * resolution;
    canvas.height = S * resolution;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.scale(resolution, resolution);
    draw(ctx);
    textures.set(key, canvas);
  };
  return { paint, textures };
}

export function linear(
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: string[],
) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

export function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

export function ellipse(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
}

export function fillStroke(
  ctx: Ctx,
  fill: string | CanvasGradient,
  width = 1.5,
): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Glows `color` along the current path. */
export function glow(ctx: Ctx, color: string, blur: number): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Deterministic speckle over the tile: `count` dots, dark or light. */
export function grain(
  ctx: Ctx,
  seed: number,
  count: number,
  light: string,
  dark: string,
): void {
  const rng = createRng(seed);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rng() < 0.5 ? dark : light;
    ctx.fillRect(rng() * S, rng() * S, 1.5, 1.5);
  }
}

/** The darker band a wall or block casts on the floor below it. */
export function floorShadow(ctx: Ctx): void {
  ctx.fillStyle = linear(ctx, 0, 0, 0, S * 0.5, [
    'rgba(0,0,0,0.6)',
    'rgba(0,0,0,0)',
  ]);
  ctx.fillRect(0, 0, S, S * 0.5);
}

/** Yellow-and-transparent diagonal stripes — the "danger" tape. */
export function hazardStripes(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number,
  color = '#e9b83a',
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let k = -h; k < w + h; k += 16) {
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + k + 8, y);
    ctx.lineTo(x + k + 8 - h, y + h);
    ctx.lineTo(x + k - h, y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
