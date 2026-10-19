import { HD_TILE as S } from '../hd-palette';
import { TEXTURE } from '../../texture-keys';
import {
  ArenaTheme,
  circle,
  Ctx,
  floorShadow,
  glow,
  grain,
  hazardStripes,
  linear,
  OUTLINE,
  roundRect,
  tilePainter,
} from './theme';
import { BLACKOUT } from './moments';

/**
 * Subestação — Tião the electrician's workplace. Transformer cabinets for pillars, fuse
 * boxes for crates, cracked concrete with a safety stripe, a concrete barrier
 * with chain-link above it around the edge, and the generator in the middle.
 */
const STEEL = '#4b5160';
const STEEL_D = '#2b2f3a';
const STEEL_L = '#7a8296';
const CONCRETE = '#3a3d46';
const CONCRETE_D = '#2b2e36';
const HAZARD = '#e9b83a';
const FUSE_BOX = '#dcaa2c';
const FUSE_BOX_D = '#9f7414';
const LED_RED = '#ff4a3d';
const CYAN = '#5fd3ff';

function floor(ctx: Ctx, stripe: boolean, shadow: boolean): void {
  ctx.fillStyle = linear(ctx, 0, 0, S, S, [CONCRETE, CONCRETE_D]);
  ctx.fillRect(0, 0, S, S);
  grain(ctx, 11, 36, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.2)');
  // A crack across the slab.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(12, 50);
  ctx.lineTo(26, 38);
  ctx.lineTo(31, 41);
  ctx.lineTo(44, 24);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  if (stripe) hazardStripes(ctx, 0, S - 8, S, 6, 0.55);
  if (shadow) floorShadow(ctx);
}

/** Pillar: a transformer cabinet with cooling fins, a warning sign and an LED. */
function transformer(ctx: Ctx, led: string): void {
  const front = 14;
  roundRect(ctx, 3, 3, S - 6, S - 6, 6);
  ctx.fillStyle = linear(ctx, 0, S - front, 0, S, [STEEL_D, '#171a21']);
  ctx.fill();
  roundRect(ctx, 3, 3, S - 6, S - front - 3, 6);
  ctx.fillStyle = linear(ctx, 0, 3, S, S - front, [STEEL, STEEL_D]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  for (let x = 12; x <= S - 12; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, S - front - 10);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 13; x <= S - 11; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, S - front - 10);
    ctx.stroke();
  }
  ctx.fillStyle = STEEL_L;
  for (const [x, y] of [
    [8, 8],
    [S - 8, 8],
    [8, S - front - 8],
    [S - 8, S - front - 8],
  ]) {
    circle(ctx, x as number, y as number, 1.6);
    ctx.fill();
  }
  // Rim light in the arena's accent, top-left.
  ctx.strokeStyle = 'rgba(95,211,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(5.5, S - front - 6);
  ctx.lineTo(5.5, 9);
  ctx.quadraticCurveTo(5.5, 5.5, 9, 5.5);
  ctx.lineTo(S - 9, 5.5);
  ctx.stroke();
  // Warning triangle with a bolt.
  ctx.fillStyle = HAZARD;
  ctx.beginPath();
  ctx.moveTo(13, S - 4);
  ctx.lineTo(23, S - 4);
  ctx.lineTo(18, S - 13);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1b1d24';
  ctx.beginPath();
  ctx.moveTo(18.8, S - 11);
  ctx.lineTo(16.8, S - 7.5);
  ctx.lineTo(18.2, S - 7.5);
  ctx.lineTo(17.2, S - 5);
  ctx.lineTo(19.4, S - 8.5);
  ctx.lineTo(18, S - 8.5);
  ctx.closePath();
  ctx.fill();
  circle(ctx, S - 12, S - front / 2 - 1, 2.4);
  if (led === 'off') {
    ctx.fillStyle = '#4a1613';
    ctx.fill();
  } else {
    glow(ctx, led, 8);
  }
  roundRect(ctx, 3, 3, S - 6, S - 6, 6);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Border: a concrete barrier with the warning stripe, chain-link above it. */
function barrier(ctx: Ctx): void {
  ctx.fillStyle = '#121419';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(150,160,180,0.22)';
  ctx.lineWidth = 1;
  for (let k = -S; k < S * 2; k += 12) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + 28, 28);
    ctx.moveTo(k + 28, 0);
    ctx.lineTo(k, 28);
    ctx.stroke();
  }
  roundRect(ctx, 1, 26, S - 2, S - 27, 4);
  ctx.fillStyle = linear(ctx, 0, 26, 0, S, ['#5a6070', '#2d313c']);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(3, 28, S - 6, 2);
  hazardStripes(ctx, 2, S - 14, S - 4, 9, 0.9);
  roundRect(ctx, 1, 26, S - 2, S - 27, 4);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Soft block: a yellow fuse box with the high-voltage bolt. */
function fuseBox(ctx: Ctx): void {
  roundRect(ctx, 4, 4, S - 8, S - 8, 5);
  ctx.fillStyle = linear(ctx, 4, 4, S - 4, S - 4, [FUSE_BOX, FUSE_BOX_D]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(6, 6, S - 12, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(6, 22);
  ctx.lineTo(S - 6, 22);
  ctx.stroke();
  roundRect(ctx, S / 2 - 4, 19, 8, 6, 1.5);
  ctx.fillStyle = STEEL_D;
  ctx.fill();
  roundRect(ctx, 14, 30, S - 28, 22, 3);
  ctx.fillStyle = '#1b1d24';
  ctx.fill();
  ctx.fillStyle = HAZARD;
  ctx.beginPath();
  ctx.moveTo(35, 32);
  ctx.lineTo(27, 42);
  ctx.lineTo(32, 42);
  ctx.lineTo(29, 50);
  ctx.lineTo(37, 40);
  ctx.lineTo(32, 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = linear(ctx, 0, S * 0.78, 0, S, [
    'rgba(0,0,0,0)',
    'rgba(0,0,0,0.45)',
  ]);
  ctx.fillRect(4, S * 0.78, S - 8, S * 0.22 - 4);
  roundRect(ctx, 4, 4, S - 8, S - 8, 5);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** The generator: a transformer with a cyan core behind a window. */
function generator(ctx: Ctx): void {
  transformer(ctx, LED_RED);
  roundRect(ctx, 18, 14, 28, 22, 4);
  ctx.fillStyle = '#0b1420';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  roundRect(ctx, 22, 18, 20, 14, 3);
  glow(ctx, CYAN, 18);
}

export const subestacaoTheme: ArenaTheme = {
  id: 'subestacao',
  accent: '#e9b83a',
  moment: BLACKOUT,
  paint(doc) {
    const { paint, textures } = tilePainter(doc);
    paint(TEXTURE.floor, (ctx) => floor(ctx, false, false));
    paint(TEXTURE.floorShadow, (ctx) => floor(ctx, false, true));
    paint(TEXTURE.wall, (ctx) => transformer(ctx, LED_RED));
    paint(TEXTURE.wallBorder, barrier);
    paint(TEXTURE.wallTop, barrier);
    paint(TEXTURE.feature, generator);
    paint(TEXTURE.block, fuseBox);
    return textures;
  },
};
