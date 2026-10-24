import { createRng } from '@libs/game-core';
import { HD_TILE as S } from '../hd-palette';
import { TEXTURE } from '../../texture-keys';
import {
  ArenaTheme,
  circle,
  Ctx,
  floorShadow,
  glow,
  linear,
  OUTLINE,
  roundRect,
  TAU,
  tilePainter,
} from './theme';
import { ALARM_SUFFIX, SWEEP, SWEEP_COLOR } from './moments';

/**
 * Núcleo — the datacenter where CIDA, the city's AI, lives. A circuit-board
 * floor whose traces run on into the next tile, server racks for pillars,
 * glass data cubes with a lit core for crates (a light frame, so they read as
 * breakable), a barrier with a light strip round the edge, a wall of data
 * screens along the top, and CIDA's eye in the middle of it.
 */
const ACCENT = '#39d5ff';
const ACCENT_2 = '#a77bff';
const FLOOR = '#141c2e';
const FLOOR_D = '#0b1120';
const STEEL = '#2b3448';
const STEEL_D = '#151b28';
const STEEL_L = '#5a6680';
const FRAME = '#c7d0e2';
const FRAME_D = '#6f7a91';
const GLASS = '#2a1f5c';
const SCREEN = '#05070d';

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function hexagon(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * TAU) / 6;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** The floor: a dark circuit-board panel; its traces meet the neighbours'. */
function board(ctx: Ctx, shadow: boolean): void {
  ctx.fillStyle = linear(ctx, 0, 0, S, S, [FLOOR, FLOOR_D]);
  ctx.fillRect(0, 0, S, S);
  const rng = createRng(11);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle =
      rng() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.035)';
    ctx.fillRect(rng() * S, rng() * S, 1.2, 1.2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.beginPath();
  ctx.moveTo(1.5, S - 2);
  ctx.lineTo(1.5, 1.5);
  ctx.lineTo(S - 2, 1.5);
  ctx.stroke();
  // The traces: one across at row 20, one down at column 46, a stub.
  ctx.strokeStyle = rgba(ACCENT, 0.17);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(14, 20);
  ctx.lineTo(21, 27);
  ctx.lineTo(34, 27);
  ctx.lineTo(41, 20);
  ctx.lineTo(S, 20);
  ctx.moveTo(46, 0);
  ctx.lineTo(46, 34);
  ctx.lineTo(52, 40);
  ctx.lineTo(52, 50);
  ctx.lineTo(46, 56);
  ctx.lineTo(46, S);
  ctx.moveTo(8, 44);
  ctx.lineTo(26, 44);
  ctx.lineTo(32, 50);
  ctx.stroke();
  ctx.fillStyle = rgba(ACCENT, 0.35);
  for (const [x, y] of [
    [8, 44],
    [32, 50],
    [27.5, 27],
  ] as const) {
    circle(ctx, x, y, 1.7);
    ctx.fill();
  }
  circle(ctx, 46, 34, 1.6);
  glow(ctx, rgba(ACCENT, 0.7), 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(4, 9);
  ctx.lineTo(4, 4);
  ctx.lineTo(9, 4);
  ctx.moveTo(S - 9, S - 4);
  ctx.lineTo(S - 4, S - 4);
  ctx.lineTo(S - 4, S - 9);
  ctx.stroke();
  if (shadow) floorShadow(ctx);
}

/** Pillar: a server rack — bays with vents, a column of LEDs, a light bar in front. */
function rack(ctx: Ctx): void {
  const front = 14;
  roundRect(ctx, 3, 3, S - 6, S - 6, 6);
  ctx.fillStyle = linear(ctx, 0, S - front, 0, S, [STEEL_D, '#0a0d14']);
  ctx.fill();
  roundRect(ctx, 3, 3, S - 6, S - front - 3, 6);
  ctx.fillStyle = linear(ctx, 3, 3, S, S - front, [STEEL, STEEL_D]);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const y = 9 + i * 8;
    roundRect(ctx, 9, y, 36, 6, 1.5);
    ctx.fillStyle = '#0b0f18';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(10, y + 0.5, 34, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    for (let x = 12; x < 42; x += 4) ctx.fillRect(x, y + 2.6, 2, 1.4);
  }
  [ACCENT, ACCENT_2, null, ACCENT].forEach((led, i) => {
    circle(ctx, 52, 12 + i * 8, 1.9);
    if (led) {
      glow(ctx, led, 6);
    } else {
      ctx.fillStyle = '#1d2433';
      ctx.fill();
    }
  });
  // Rim light in the arena's accent, top-left, like the other arenas.
  ctx.strokeStyle = rgba(ACCENT, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(5.5, S - front - 6);
  ctx.lineTo(5.5, 9);
  ctx.quadraticCurveTo(5.5, 5.5, 9, 5.5);
  ctx.lineTo(S - 9, 5.5);
  ctx.stroke();
  roundRect(ctx, 10, S - 10, S - 20, 3, 1.5);
  glow(ctx, ACCENT, 8);
  roundRect(ctx, 3, 3, S - 6, S - 6, 6);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Soft block: a glass data cube with a lit core in a light frame. */
function dataCube(ctx: Ctx): void {
  roundRect(ctx, 5, 5, 54, 54, 7);
  ctx.fillStyle = linear(ctx, 5, 5, 59, 59, [FRAME, FRAME_D]);
  ctx.fill();
  roundRect(ctx, 11, 11, 42, 42, 4);
  ctx.fillStyle = linear(ctx, 11, 11, 53, 53, [
    rgba(ACCENT_2, 0.9),
    GLASS,
    '#0c0920',
  ]);
  ctx.fill();
  ctx.save();
  roundRect(ctx, 11, 11, 42, 42, 4);
  ctx.clip();
  ctx.strokeStyle = rgba(ACCENT, 0.2);
  ctx.lineWidth = 1;
  for (let k = 18; k < 50; k += 7) {
    ctx.beginPath();
    ctx.moveTo(k, 11);
    ctx.lineTo(k, 53);
    ctx.moveTo(11, k);
    ctx.lineTo(53, k);
    ctx.stroke();
  }
  hexagon(ctx, 32, 32, 10);
  glow(ctx, ACCENT, 12);
  hexagon(ctx, 32, 32, 10);
  ctx.fillStyle = linear(ctx, 24, 24, 40, 40, ['#ffffff', ACCENT]);
  ctx.fill();
  hexagon(ctx, 32, 32, 4.5);
  ctx.fillStyle = 'rgba(5,7,13,0.7)';
  ctx.fill();
  // The glass's reflection.
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(11, 30);
  ctx.lineTo(30, 11);
  ctx.lineTo(38, 11);
  ctx.lineTo(11, 38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  roundRect(ctx, 11, 11, 42, 42, 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(8, 7.5, 48, 1.5);
  ctx.fillStyle = FRAME_D;
  for (const [x, y] of [
    [8.5, 8.5],
    [55.5, 8.5],
    [8.5, 55.5],
    [55.5, 55.5],
  ] as const) {
    circle(ctx, x, y, 1.5);
    ctx.fill();
  }
  roundRect(ctx, 5, 5, 54, 54, 7);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Border: a metal barrier with a light strip, glass above it. */
function barrier(ctx: Ctx): void {
  ctx.fillStyle = '#070a12';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = linear(ctx, 0, 0, 0, 26, [
    rgba(ACCENT, 0.02),
    rgba(ACCENT, 0.11),
  ]);
  ctx.fillRect(0, 0, S, 26);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0.5, 0);
  ctx.lineTo(0.5, 26);
  ctx.moveTo(32.5, 0);
  ctx.lineTo(32.5, 26);
  ctx.moveTo(0, 12.5);
  ctx.lineTo(S, 12.5);
  ctx.stroke();
  roundRect(ctx, 1, 26, S - 2, S - 27, 4);
  ctx.fillStyle = linear(ctx, 0, 26, 0, S, [STEEL_L, STEEL_D]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(3, 28, S - 6, 1.5);
  roundRect(ctx, 4, 35, S - 8, 4, 2);
  glow(ctx, ACCENT, 8);
  ctx.strokeStyle = rgba(ACCENT, 0.4);
  ctx.lineWidth = 1.5;
  for (const x of [10, 22, 34, 46]) {
    ctx.beginPath();
    ctx.moveTo(x, 47);
    ctx.lineTo(x + 5, 51.5);
    ctx.lineTo(x, 56);
    ctx.stroke();
  }
  roundRect(ctx, 1, 26, S - 2, S - 27, 4);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function screenFrame(ctx: Ctx, fill: string | CanvasGradient): void {
  ctx.fillStyle = SCREEN;
  ctx.fillRect(0, 0, S, S);
  roundRect(ctx, 3, 5, S - 6, 40, 3);
  ctx.fillStyle = fill;
  ctx.fill();
}

function scanlines(ctx: Ctx): void {
  ctx.save();
  roundRect(ctx, 3, 5, S - 6, 40, 3);
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let k = 6; k < 45; k += 2) ctx.fillRect(3, k, S - 6, 1);
  ctx.restore();
}

/** The rail under the screens, with its light strip. */
function rail(ctx: Ctx, edge: string): void {
  roundRect(ctx, 3.5, 5.5, S - 7, 39, 3);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = linear(ctx, 0, S - 14, 0, S, [STEEL_L, STEEL_D]);
  ctx.fillRect(0, S - 14, S, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, S - 15, S, 1.5);
  roundRect(ctx, 6, S - 8.5, S - 12, 3, 1.5);
  glow(ctx, ACCENT, 6);
}

/** The top row: a wall of data screens, code scrolling. */
function dataWall(ctx: Ctx): void {
  screenFrame(ctx, linear(ctx, 0, 5, 0, 45, ['#0a1628', '#060c18']));
  ctx.save();
  roundRect(ctx, 3, 5, S - 6, 40, 3);
  ctx.clip();
  const rng = createRng(31);
  for (let y = 9; y < 42; y += 5) {
    let x = 7 + Math.floor(rng() * 3) * 4;
    while (x < S - 10) {
      let w = 3 + Math.floor(rng() * 12);
      if (x + w > S - 7) w = S - 7 - x;
      if (w > 0) {
        ctx.fillStyle = rgba(
          rng() < 0.2 ? ACCENT_2 : ACCENT,
          0.3 + rng() * 0.55,
        );
        ctx.fillRect(x, y, w, 2);
      }
      x += w + 3 + Math.floor(rng() * 4);
    }
  }
  ctx.restore();
  scanlines(ctx);
  rail(ctx, rgba(ACCENT, 0.35));
}

/** The feature: CIDA's eye, on the screen in the middle of the top row; red while it sweeps. */
function eye(ctx: Ctx, color: string): void {
  screenFrame(ctx, '#070d1a');
  circle(ctx, 32, 25, 16);
  ctx.strokeStyle = rgba(color, 0.3);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(32, 25, 12.5, (i / 12) * TAU + 0.09, ((i + 1) / 12) * TAU - 0.09);
    ctx.strokeStyle = rgba(color, i % 3 === 0 ? 0.95 : 0.5);
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
  circle(ctx, 32, 25, 8);
  glow(ctx, color, 14);
  const iris = ctx.createRadialGradient(30, 23, 1, 32, 25, 8);
  iris.addColorStop(0, '#ffffff');
  iris.addColorStop(0.4, color);
  iris.addColorStop(1, rgba(color, 0.7));
  circle(ctx, 32, 25, 8);
  ctx.fillStyle = iris;
  ctx.fill();
  circle(ctx, 32, 25, 3.3);
  ctx.fillStyle = '#04060c';
  ctx.fill();
  circle(ctx, 29.6, 22.6, 1.3);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  scanlines(ctx);
  rail(ctx, rgba(color, 0.45));
}

export const nucleoTheme: ArenaTheme = {
  id: 'nucleo',
  accent: ACCENT,
  moment: SWEEP,
  paint(doc, resolution = 1) {
    const { paint, textures } = tilePainter(doc, resolution);
    paint(TEXTURE.floor, (ctx) => board(ctx, false));
    paint(TEXTURE.floorShadow, (ctx) => board(ctx, true));
    paint(TEXTURE.wall, rack);
    paint(TEXTURE.wallBorder, barrier);
    paint(TEXTURE.wallTop, dataWall);
    paint(TEXTURE.feature, (ctx) => eye(ctx, ACCENT));
    paint(TEXTURE.feature + ALARM_SUFFIX, (ctx) => eye(ctx, SWEEP_COLOR));
    paint(TEXTURE.block, dataCube);
    return textures;
  },
};
