import { createRng } from '@libs/game-core';
import { HD_TILE as S } from '../hd-palette';
import { TEXTURE } from '../../texture-keys';
import {
  ArenaTheme,
  circle,
  Ctx,
  ellipse,
  fillStroke,
  floorShadow,
  glow,
  grain,
  linear,
  roundRect,
  TAU,
  tilePainter,
} from './theme';
import { RAIN } from './moments';

/**
 * Autódromo — a race track. Asphalt with skid marks, stacks of tyres for
 * pillars, fuel drums for crates, an Armco guard-rail on a red-and-white kerb
 * around the edge, the grandstand along the top, and the start lights in
 * the middle.
 */
const ASPHALT = '#2e2f35';
const ASPHALT_D = '#232428';
const TYRE = '#1c1d21';
const TYRE_L = '#3b3d45';
const DRUM = '#d63c3c';
const DRUM_D = '#8a1f24';
const RAIL = '#cfd4de';
const RAIL_D = '#6b7281';
const KERB_R = '#d8343a';
const KERB_W = '#f3f0e8';
const CROWD = [
  '#f1c744',
  '#5fd3ff',
  '#e8575a',
  '#8ff0b4',
  '#ff9a4a',
  '#ffffff',
  '#c58cff',
];

function checker(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < w / size; i++) {
    for (let j = 0; j < h / size; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : KERB_W;
      ctx.fillRect(x + i * size, y + j * size, size, size);
    }
  }
  ctx.restore();
}

function asphalt(ctx: Ctx, startLine: boolean, shadow: boolean): void {
  ctx.fillStyle = linear(ctx, 0, 0, S, S, [ASPHALT, ASPHALT_D]);
  ctx.fillRect(0, 0, S, S);
  grain(ctx, 21, 50, 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.25)');
  // A skid mark.
  ctx.strokeStyle = 'rgba(0,0,0,0.38)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(10, 54);
  ctx.quadraticCurveTo(30, 40, 56, 44);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  if (startLine) checker(ctx, 0, S - 12, S, 8, 4, 0.85);
  if (shadow) floorShadow(ctx);
}

/** Pillar: three tyres stacked, the top one painted red and white. */
function tyres(ctx: Ctx): void {
  const tyre = (y: number, painted: boolean) => {
    ellipse(ctx, S / 2, y + 4, 26, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(S / 2, y, 26, 10, 0, 0, Math.PI);
    ctx.lineTo(S / 2 - 26, y - 9);
    ctx.ellipse(S / 2, y - 9, 26, 10, 0, Math.PI, 0, true);
    ctx.closePath();
    fillStroke(ctx, linear(ctx, 6, 0, 58, 0, [TYRE_L, TYRE, '#0e0f12']), 1.5);
    ellipse(ctx, S / 2, y - 9, 26, 10);
    fillStroke(ctx, painted ? '#1f2024' : TYRE, 1.5);
    if (painted) {
      ctx.save();
      ellipse(ctx, S / 2, y - 9, 26, 10);
      ctx.clip();
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? KERB_R : KERB_W;
        ctx.beginPath();
        ctx.moveTo(S / 2, y - 9);
        ctx.arc(S / 2, y - 9, 30, (i / 8) * TAU, ((i + 1) / 8) * TAU);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ellipse(ctx, S / 2, y - 9, 12, 4.5);
    fillStroke(ctx, ASPHALT_D, 1.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(S / 2, y - 9, 20, 7.5, 0, 0, TAU);
    ctx.stroke();
  };
  tyre(56, false);
  tyre(44, false);
  tyre(32, true);
}

/** Soft block: a fuel drum. In a bomb game the crates are flammable, of course. */
function drum(ctx: Ctx): void {
  ellipse(ctx, S / 2 + 2, S - 6, 22, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
  roundRect(ctx, 12, 12, 40, 46, 5);
  fillStroke(
    ctx,
    linear(ctx, 12, 0, 52, 0, ['#ff6b6b', DRUM, DRUM_D, '#5e1216']),
    1.5,
  );
  for (const y of [20, 50]) {
    roundRect(ctx, 10, y - 2.5, 44, 5, 2.5);
    fillStroke(ctx, linear(ctx, 10, 0, 54, 0, ['#f4f6fa', RAIL, RAIL_D]), 1.2);
  }
  ctx.fillStyle = KERB_W;
  ctx.fillRect(12, 31, 40, 8);
  ctx.save();
  ctx.translate(32, 35);
  ctx.rotate(Math.PI / 4);
  roundRect(ctx, -5.5, -5.5, 11, 11, 1.5);
  ctx.fillStyle = '#ff8a2c';
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#1b1d24';
  ctx.beginPath();
  ctx.moveTo(32, 30);
  ctx.quadraticCurveTo(36, 34, 34.5, 38);
  ctx.quadraticCurveTo(32, 40.5, 29.5, 38);
  ctx.quadraticCurveTo(28, 34, 32, 30);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, 32, 12, 20, 6);
  fillStroke(ctx, linear(ctx, 0, 6, 0, 18, ['#ff8080', DRUM_D]), 1.5);
  ellipse(ctx, 32, 12, 14, 3.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  circle(ctx, 40, 12, 2.2);
  ctx.fillStyle = RAIL_D;
  ctx.fill();
}

/** Border: an Armco guard-rail on a red-and-white kerb. */
function guardrail(ctx: Ctx): void {
  ctx.fillStyle = '#121318';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? KERB_W : KERB_R;
    ctx.fillRect(i * 16, S - 12, 16, 12);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, S - 12, S, 2);
  for (const x of [8, 56]) {
    roundRect(ctx, x - 3, 18, 6, 34, 1.5);
    fillStroke(ctx, linear(ctx, x - 3, 0, x + 3, 0, [RAIL_D, '#3a3f4b']), 1);
  }
  for (const y of [22, 36]) {
    roundRect(ctx, 0, y, S, 10, 3);
    fillStroke(
      ctx,
      linear(ctx, 0, y, 0, y + 10, ['#f4f6fa', RAIL, RAIL_D]),
      1.2,
    );
    for (const x of [8, 56]) {
      circle(ctx, x, y + 5, 1.6);
      ctx.fillStyle = '#3a3f4b';
      ctx.fill();
    }
  }
}

/** The top row: the grandstand, three rows of a colourful crowd. */
function grandstand(ctx: Ctx): void {
  const rng = createRng(5);
  ctx.fillStyle = linear(ctx, 0, 0, 0, S, ['#0c0d11', '#17181d']);
  ctx.fillRect(0, 0, S, S);
  for (let row = 0; row < 3; row++) {
    const y = 12 + row * 14;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, y + 7, S, 6);
    for (let x = 6 + (row % 2) * 5; x < S; x += 10) {
      const color = CROWD[Math.floor(rng() * CROWD.length)] as string;
      circle(ctx, x, y + (rng() < 0.3 ? -3 : 0), 3.2);
      ctx.fillStyle = color;
      ctx.fill();
      roundRect(ctx, x - 3.5, y + 3, 7, 6, 2);
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = linear(ctx, 0, S - 10, 0, S, [RAIL, RAIL_D]);
  ctx.fillRect(0, S - 10, S, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, S - 11, S, 1.5);
}

/** The middle: the start-light gantry on the asphalt, all five lamps lit. */
function gantry(ctx: Ctx): void {
  asphalt(ctx, false, false);
  ellipse(ctx, S / 2, S - 8, 20, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
  roundRect(ctx, 28, 30, 8, 28, 2);
  fillStroke(ctx, linear(ctx, 28, 0, 36, 0, [RAIL, RAIL_D]), 1.2);
  roundRect(ctx, 20, 52, 24, 8, 3);
  fillStroke(ctx, '#2a2d36', 1.2);
  roundRect(ctx, 4, 8, 56, 24, 5);
  fillStroke(ctx, linear(ctx, 0, 8, 0, 32, ['#3a3d47', '#15161b']), 1.5);
  for (let i = 0; i < 5; i++) {
    circle(ctx, 12 + i * 10, 20, 3.8);
    glow(ctx, '#ff3b3b', 9);
  }
}

export const autodromoTheme: ArenaTheme = {
  id: 'autodromo',
  accent: '#d8343a',
  moment: RAIN,
  paint(doc, resolution = 1) {
    const { paint, textures } = tilePainter(doc, resolution);
    paint(TEXTURE.floor, (ctx) => asphalt(ctx, false, false));
    paint(TEXTURE.floorShadow, (ctx) => asphalt(ctx, false, true));
    paint(TEXTURE.wall, tyres);
    paint(TEXTURE.wallBorder, guardrail);
    paint(TEXTURE.wallTop, grandstand);
    paint(TEXTURE.feature, gantry);
    paint(TEXTURE.block, drum);
    return textures;
  },
};
