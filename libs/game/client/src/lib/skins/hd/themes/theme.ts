import { createRng, MapId } from '@libs/game-core';
import { TEXTURE } from '../../texture-keys';
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
  /**
   * How many looks a tile has, by `TEXTURE` key: a cell draws `<key>#<n>`
   * (n from 1) when the theme painted one for the number its position picks,
   * else the plain tile. A count larger than the looks painted makes them rare.
   */
  readonly variants?: Readonly<Record<string, number>>;
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
    // A variant (`feature:alarm`, `wall#2`) is lit like the tile it stands in for.
    if (SOLID_TILES.has(key.split(/[:#]/)[0] ?? key)) relief(ctx, resolution);
    textures.set(key, canvas);
  };
  return { paint, textures };
}

/** The tiles that stand up from the floor: lit like the cast. */
export const SOLID_TILES: ReadonlySet<string> = new Set([
  TEXTURE.wall,
  TEXTURE.wallBorder,
  TEXTURE.wallTop,
  TEXTURE.feature,
  TEXTURE.block,
]);

/**
 * The cast's light on a tile: a top-left highlight and a bottom-right core
 * shadow over whatever was painted, following its shape, and a near-black
 * silhouette behind it — so a crate and the player beside it read as one
 * drawing. `resolution` is the canvas's pixels per art unit.
 */
export function relief(ctx: Ctx, resolution: number): void {
  const canvas = ctx.canvas;
  // A test's stand-in context has no canvas to copy.
  if (typeof canvas?.width !== 'number') return;
  ctx.save();
  ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  const light = ctx.createLinearGradient(0, 0, S, S);
  light.addColorStop(0, 'rgba(255, 255, 255, 0.17)');
  light.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  light.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
  light.addColorStop(1, 'rgba(10, 6, 14, 0.34)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();

  const copy = canvas.ownerDocument.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d')?.drawImage(canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.shadowColor = 'rgba(8, 10, 16, 0.9)';
  ctx.shadowBlur = 0;
  const r = 0.9 * resolution;
  const far = canvas.width + canvas.height + 64;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.shadowOffsetX = far + Math.cos(a) * r;
    ctx.shadowOffsetY = Math.sin(a) * r;
    ctx.drawImage(copy, -far, 0);
  }
  ctx.restore();
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
