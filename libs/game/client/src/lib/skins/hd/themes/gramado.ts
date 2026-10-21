import { createRng } from '@libs/game-core';
import { HD_TILE as S } from '../hd-palette';
import { TEXTURE } from '../../texture-keys';
import {
  ArenaTheme,
  Ctx,
  ellipse,
  linear,
  roundRect,
  tilePainter,
} from './theme';

/**
 * Gramado — the plain one: a mown lawn in a city park. Concrete planters
 * with clipped box for pillars, blocks of pale large-format brick for
 * crates, a curb with a black steel railing and the hedge behind it round
 * the edge, an old well as the feature. No weather, no blackout: the arena
 * to learn on, and the quick versus. Lit like the rest of the skin — soft,
 * from the top left, every solid thing resting on its own shadow.
 */
const GRASS = '#4e8a3c';
const GRASS_D = '#3f7331';
const GRASS_L = '#5c9b48';
const STONE_D = '#5a6069';
const STONE_L = '#b7bcc4';
const CONCRETE_L = '#d3d6da';
const CONCRETE = '#a9adb3';
const CONCRETE_D = '#7a7f87';
const SOIL = '#3a2a1f';
const BOX_L = '#5f9d4c';
const BOX = '#3b7634';
const BOX_D = '#214a21';
const BRICKS = ['#d9c3a9', '#cfb79b', '#e0cbb2', '#c7ae92'];
const MORTAR = '#6b6058';
const RAIL = '#1f2328';
const RAIL_L = '#3a3f46';
const CURB = '#b9bcc1';
const CURB_D = '#8d9198';
const MOSS = 'rgba(70, 120, 55, 0.75)';
const HEDGE = '#2d5a2a';
const HEDGE_L = '#3f7a39';
const WOOD = '#6f4a2c';
const WOOD_D = '#47301c';
const INK = 'rgba(10, 14, 12, 0.38)';

/** The lawn: a quiet green, a soft tuft here and there, no seams. */
function lawn(ctx: Ctx, shadow: boolean): void {
  ctx.fillStyle = linear(ctx, 0, 0, S, S, [GRASS_L, GRASS, GRASS_D]);
  ctx.fillRect(0, 0, S, S);
  // Mower's sheen: a wide, faint band.
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.beginPath();
  ctx.moveTo(0, S * 0.7);
  ctx.lineTo(S * 0.7, 0);
  ctx.lineTo(S, 0);
  ctx.lineTo(S, S * 0.15);
  ctx.lineTo(S * 0.15, S);
  ctx.lineTo(0, S);
  ctx.closePath();
  ctx.fill();
  // Blades: short, low-contrast, leaning the same way.
  const rng = createRng(7);
  ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const h = 2 + rng() * 2.5;
    ctx.strokeStyle =
      rng() < 0.55 ? 'rgba(20, 40, 15, 0.16)' : 'rgba(200, 235, 170, 0.14)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.8, y - h);
    ctx.stroke();
  }
  // A clover leaf or two.
  for (let i = 0; i < 3; i++) {
    const x = 8 + rng() * (S - 16);
    const y = 8 + rng() * (S - 16);
    ctx.fillStyle = 'rgba(120, 170, 95, 0.35)';
    for (const [dx, dy] of [
      [0, -1.6],
      [-1.5, 0.9],
      [1.5, 0.9],
    ]) {
      ellipse(ctx, x + (dx as number), y + (dy as number), 1.4, 1.1);
      ctx.fill();
    }
  }
  if (shadow) {
    // Softer than the skin's band: a park in open light, not a hall.
    ctx.fillStyle = linear(ctx, 0, 0, 0, S * 0.42, [
      'rgba(0,0,0,0.38)',
      'rgba(0,0,0,0)',
    ]);
    ctx.fillRect(0, 0, S, S * 0.42);
  }
}

/** The soft pool of shadow a solid thing leaves on the lawn. */
function groundShadow(ctx: Ctx, rx: number): void {
  ellipse(ctx, S / 2 + 1, S - 3, rx, 4.5);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fill();
  ellipse(ctx, S / 2 + 1, S - 3, rx * 0.8, 3);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fill();
}

/**
 * Pillar: a concrete planter with a clipped box shrub. Smooth concrete, a
 * groove round the lip, the arena's green catching the top-left edge the
 * way the other arenas' accents do.
 */
function planter(ctx: Ctx): void {
  const lip = 30;
  // The cell is drawn with this texture alone: the lawn goes under it.
  lawn(ctx, false);
  groundShadow(ctx, S * 0.46);
  // The box: front face down to the lawn, lighter top with a dark soil rim.
  roundRect(ctx, 6, lip, S - 12, S - lip - 4, 3);
  ctx.fillStyle = linear(ctx, 0, lip, 0, S - 4, [CONCRETE, CONCRETE_D]);
  ctx.fill();
  roundRect(ctx, 5, lip - 6, S - 10, 8, 2.5);
  ctx.fillStyle = linear(ctx, 0, lip - 6, 0, lip + 2, [CONCRETE_L, CONCRETE]);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  roundRect(ctx, 6, lip, S - 12, S - lip - 4, 3);
  ctx.stroke();
  roundRect(ctx, 5, lip - 6, S - 10, 8, 2.5);
  ctx.stroke();
  // A groove across the face, and a little weathering.
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, lip + 12);
  ctx.lineTo(S - 10, lip + 12);
  ctx.stroke();
  const rng = createRng(41);
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.09)';
    ctx.fillRect(
      8 + rng() * (S - 16),
      lip + 2 + rng() * (S - lip - 8),
      1.2,
      1.2,
    );
  }
  // Soil, then the shrub: a dome of dark green, leaves speckled, lit top-left.
  ellipse(ctx, S / 2, lip - 3, S / 2 - 8, 3);
  ctx.fillStyle = SOIL;
  ctx.fill();
  const cx = S / 2;
  const cy = lip - 12;
  ellipse(ctx, cx + 1, cy + 9, 23, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 22, 15, 0, 0, Math.PI * 2);
  ctx.fillStyle = (() => {
    const g = ctx.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, 24);
    g.addColorStop(0, BOX_L);
    g.addColorStop(0.55, BOX);
    g.addColorStop(1, BOX_D);
    return g;
  })();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 22, 15, 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 70; i++) {
    const x = cx - 22 + rng() * 44;
    const y = cy - 15 + rng() * 30;
    ellipse(ctx, x, y, 1.6, 1.1);
    ctx.fillStyle =
      rng() < 0.4 ? 'rgba(140, 200, 110, 0.35)' : 'rgba(0, 25, 0, 0.3)';
    ctx.fill();
  }
  ctx.restore();
  // The arena's accent on the top-left edge of the box, like the other arenas.
  ctx.strokeStyle = 'rgba(111, 184, 90, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(6.5, S - 8);
  ctx.lineTo(6.5, lip - 4);
  ctx.stroke();
  ctx.fillStyle = MOSS;
  ellipse(ctx, 14, S - 6, 6, 2.6);
  ctx.fill();
}

/** Multiplies a hex colour's brightness by `k`. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

/**
 * Border: the park's edge — a concrete curb, a black steel railing, and the
 * hedge behind it. Along the top the hedge is taller and the railing is
 * seen over it; the lawn runs right up to the curb.
 */
function parkEdge(ctx: Ctx, seed: number, top: boolean): void {
  const rng = createRng(seed);
  // Hedge behind everything.
  ctx.fillStyle = linear(ctx, 0, 0, 0, S, [HEDGE_L, HEDGE, '#20421f']);
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const x = rng() * S;
    const y = rng() * (top ? S * 0.75 : S * 0.6);
    const r = 1.8 + rng() * 2;
    ellipse(ctx, x, y, r, r * 0.8);
    ctx.fillStyle =
      rng() < 0.45 ? 'rgba(130, 190, 105, 0.32)' : 'rgba(0, 22, 0, 0.32)';
    ctx.fill();
  }
  // Light from above on the clipped top of the hedge.
  ctx.fillStyle = linear(ctx, 0, 0, 0, 10, [
    'rgba(255,255,255,0.14)',
    'rgba(255,255,255,0)',
  ]);
  ctx.fillRect(0, 0, S, 10);
  // The railing: a rail and thin balusters, dark steel with a cold highlight.
  const railY = top ? 26 : 18;
  ctx.fillStyle = RAIL;
  ctx.fillRect(0, railY, S, 3);
  ctx.fillStyle = RAIL_L;
  ctx.fillRect(0, railY, S, 1);
  for (let x = 6; x < S; x += 13) {
    ctx.fillStyle = RAIL;
    ctx.fillRect(x, railY + 2, 2.2, top ? S - railY - 16 : S - railY - 14);
    ctx.fillStyle = RAIL_L;
    ctx.fillRect(x, railY + 2, 0.8, top ? S - railY - 16 : S - railY - 14);
  }
  ctx.fillStyle = RAIL;
  ctx.fillRect(0, S - 14, S, 2.5);
  // The curb at the foot, then the lawn's edge.
  ctx.fillStyle = linear(ctx, 0, S - 12, 0, S - 5, [CURB, CURB_D]);
  ctx.fillRect(0, S - 12, S, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, S - 12, S, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, S - 6, S, 1.5);
  ctx.fillStyle = linear(ctx, 0, S - 5, 0, S, [GRASS_D, GRASS]);
  ctx.fillRect(0, S - 5, S, 5);
}

/** Crate: a block of pale, large-format brick with thin dark joints — a modern façade, not a chimney. */
function brickBlock(ctx: Ctx): void {
  // The cell is drawn with this texture alone: the lawn goes under it.
  lawn(ctx, false);
  groundShadow(ctx, S * 0.44);
  const x0 = 5;
  const y0 = 6;
  const w = S - 10;
  const h = S - 11;
  roundRect(ctx, x0, y0, w, h, 3);
  ctx.fillStyle = MORTAR;
  ctx.fill();
  ctx.save();
  roundRect(ctx, x0, y0, w, h, 3);
  ctx.clip();
  const rng = createRng(53);
  const rows = 3;
  const bh = h / rows;
  const bw = 27;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * bh;
    for (let x = x0 - (r % 2 ? bw / 2 : 0); x < x0 + w; x += bw) {
      const base = BRICKS[Math.floor(rng() * BRICKS.length)] as string;
      ctx.fillStyle = linear(ctx, x, y, x + bw, y + bh, [
        shade(base, 1.04),
        base,
        shade(base, 0.9),
      ]);
      ctx.fillRect(x + 0.7, y + 0.7, bw - 1.4, bh - 1.4);
      // A faint grain across each brick.
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      for (let i = 0; i < 4; i++)
        ctx.fillRect(x + 2 + rng() * (bw - 6), y + 2 + rng() * (bh - 4), 3, 1);
    }
  }
  ctx.restore();
  // Ambient shade down the block, a quiet edge, light on the top-left.
  roundRect(ctx, x0, y0, w, h, 3);
  ctx.fillStyle = linear(ctx, 0, y0, 0, y0 + h, [
    'rgba(255,255,255,0.06)',
    'rgba(0,0,0,0.2)',
  ]);
  ctx.fill();
  roundRect(ctx, x0, y0, w, h, 3);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + 2, y0 + h - 4);
  ctx.lineTo(x0 + 2, y0 + 3);
  ctx.lineTo(x0 + w - 4, y0 + 3);
  ctx.stroke();
  ctx.fillStyle = 'rgba(70, 120, 55, 0.45)';
  ellipse(ctx, S - 13, S - 9, 5, 2.6);
  ctx.fill();
}

/** Feature: the old stone well with its wooden frame — for a map that wants one. */
function well(ctx: Ctx): void {
  // The cell is drawn with this texture alone: the lawn goes under it.
  lawn(ctx, false);
  groundShadow(ctx, S * 0.46);
  ctx.fillStyle = WOOD_D;
  ctx.fillRect(13, 10, 4, 36);
  ctx.fillRect(S - 17, 10, 4, 36);
  ctx.fillStyle = WOOD;
  ctx.beginPath();
  ctx.moveTo(8, 14);
  ctx.lineTo(S / 2, 3);
  ctx.lineTo(S - 8, 14);
  ctx.lineTo(S - 11, 16);
  ctx.lineTo(S / 2, 7);
  ctx.lineTo(11, 16);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, S / 2, 44, 22, 11);
  ctx.fillStyle = linear(ctx, 0, 33, 0, 55, [STONE_L, STONE_D]);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ellipse(ctx, S / 2, 42, 15, 6.5);
  ctx.fillStyle = '#0f1a24';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let a = 0; a < 7; a++) {
    const t = (a / 7) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(S / 2 + Math.cos(t) * 15, 42 + Math.sin(t) * 6.5);
    ctx.lineTo(S / 2 + Math.cos(t) * 22, 44 + Math.sin(t) * 11);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d9c7a0';
  ctx.beginPath();
  ctx.moveTo(S / 2, 8);
  ctx.lineTo(S / 2, 26);
  ctx.stroke();
  ctx.fillStyle = WOOD;
  ctx.fillRect(S / 2 - 5, 26, 10, 8);
}

export const gramadoTheme: ArenaTheme = {
  id: 'gramado',
  accent: '#6fb85a',
  paint(doc, resolution = 1) {
    const { paint, textures } = tilePainter(doc, resolution);
    paint(TEXTURE.floor, (ctx) => lawn(ctx, false));
    paint(TEXTURE.floorShadow, (ctx) => lawn(ctx, true));
    paint(TEXTURE.wall, planter);
    paint(TEXTURE.wallBorder, (ctx) => parkEdge(ctx, 3, false));
    paint(TEXTURE.wallTop, (ctx) => parkEdge(ctx, 5, true));
    paint(TEXTURE.feature, well);
    paint(TEXTURE.block, brickBlock);
    return textures;
  },
};
