import {
  band,
  Ctx,
  dim,
  lineOf,
  lit,
  Path,
  TAU,
} from '../../characters/cartoon/ink';
import { HD_TILE as S } from './hd-palette';

/** How many crack stages the egg has: 0 is whole, the last is about to open. */
export const EGG_STAGES = 4;

const SHELL = '#f6f0e0';
const SHELL_LINE = '#1c1511';
/** The egg's patches: the arena's own green-teal, nobody's team colour. */
const PATCH = '#3fb98f';
const PATCH_LINE = lineOf(PATCH);
const SPECKLE = 'rgba(226, 128, 150, 0.55)';

export interface EggPaintOptions {
  /** 0 = whole … EGG_STAGES - 1 = cracked open to the last line. */
  stage?: number;
  /** Tilt in radians, for the wobble. */
  tilt?: number;
}

const CX = 32;
const CY = 31;
const RX = 21;
const RY = 25;

/** An egg: wider at the bottom, pointier at the top. */
function eggPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(CX, CY - RY);
  ctx.bezierCurveTo(
    CX + RX * 0.95,
    CY - RY,
    CX + RX,
    CY + RY * 0.35,
    CX + RX * 0.72,
    CY + RY * 0.8,
  );
  ctx.bezierCurveTo(
    CX + RX * 0.45,
    CY + RY * 1.05,
    CX - RX * 0.45,
    CY + RY * 1.05,
    CX - RX * 0.72,
    CY + RY * 0.8,
  );
  ctx.bezierCurveTo(
    CX - RX,
    CY + RY * 0.35,
    CX - RX * 0.95,
    CY - RY,
    CX,
    CY - RY,
  );
  ctx.closePath();
}

/**
 * A continent: a wobbly radius sampled around a circle, with lobes, joined
 * through the midpoints so nothing has a corner.
 */
function continent(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  k: number,
  squash = 0.85,
): void {
  const n = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr =
      r *
      (1 +
        0.22 * Math.sin(a * 2 + k) +
        0.14 * Math.cos(a * 3 + k * 1.7) +
        0.08 * Math.sin(a * 5 + k * 0.6));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * squash]);
  }
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p = pts[i] as [number, number];
    const q = pts[(i + 1) % n] as [number, number];
    const nq = pts[(i + 2) % n] as [number, number];
    if (i === 0) ctx.moveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    ctx.quadraticCurveTo(q[0], q[1], (q[0] + nq[0]) / 2, (q[1] + nq[1]) / 2);
  }
  ctx.closePath();
}

/** Big patches that run off the shell, like continents on a globe. */
const PATCHES: readonly [number, number, number, number, number][] = [
  [-17, -8, 13, 0.4, 0.8],
  [15, 2, 12, 1.9, 0.9],
  [-6, 21, 13, 3.1, 0.6],
  [6, -24, 9, 2.4, 0.75],
];

/** Short pink dashes on the white, in pairs, like a wild bird's egg. */
const SPECKLES: readonly [number, number, number][] = [
  [-3, -12, -0.4],
  [-1, -9, -0.4],
  [4, 2, 0.6],
  [7, 5, 0.6],
  [-11, 6, -0.2],
  [-9, 9, -0.2],
  [10, -11, 0.5],
  [2, 14, 0.3],
];

const CRACK: readonly [number, number][] = [
  [7, -16],
  [2, -10],
  [9, -4],
  [3, 3],
  [10, 9],
  [5, 15],
];

/**
 * The egg a mount hatches from: big in its cell, on the floor with its
 * shadow, lit from the upper left, with green-teal continents outlined in
 * their own dark line, pink speckles on the shell, a near-black silhouette,
 * and a crack that grows with `stage`. Painted in the tile's 64-unit space.
 */
export function paintEgg(ctx: Ctx, options: EggPaintOptions = {}): void {
  const stage = Math.max(0, Math.min(EGG_STAGES - 1, options.stage ?? 0));
  const shell: Path = () => eggPath(ctx);

  ctx.beginPath();
  ctx.ellipse(32, 58, 19, 4.5, 0, 0, TAU);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.fill();

  ctx.save();
  ctx.translate(32, 54);
  ctx.rotate(options.tilt ?? 0);
  ctx.translate(-32, -54);

  // Shell: base, a core shadow on the lower right, a highlight on the upper left.
  shell();
  ctx.fillStyle = SHELL;
  ctx.fill();
  band(ctx, shell, dim(SHELL, 0.22), -3.2, -2.6);
  band(ctx, shell, dim(SHELL, 0.1), -1.6, -1.3);
  band(ctx, shell, lit(SHELL, 0.9), 2.4, 2);

  // Continents, clipped to the shell, each with its own line and shading.
  ctx.save();
  shell();
  ctx.clip();
  for (const [dx, dy, r, k, squash] of PATCHES) {
    const x = CX + dx;
    const y = CY + dy;
    const p: Path = () => continent(ctx, x, y, r, k, squash);
    p();
    ctx.fillStyle = PATCH;
    ctx.fill();
    band(ctx, p, dim(PATCH, 0.3), -2, -1.6);
    band(ctx, p, lit(PATCH, 0.25), 1.6, 1.3);
    p();
    ctx.strokeStyle = PATCH_LINE;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  // Speckles on the white.
  ctx.strokeStyle = SPECKLE;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (const [dx, dy, a] of SPECKLES) {
    ctx.beginPath();
    ctx.moveTo(CX + dx - Math.cos(a) * 1.6, CY + dy - Math.sin(a) * 1.6);
    ctx.lineTo(CX + dx + Math.cos(a) * 1.6, CY + dy + Math.sin(a) * 1.6);
    ctx.stroke();
  }
  ctx.restore();

  // Gloss on the shoulder of the egg.
  ctx.save();
  ctx.translate(CX - 8, CY - 15);
  ctx.rotate(-0.65);
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 2.4, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(CX - 1, CY - 20, 1.4, 0, TAU);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fill();

  // The crack, one more line per stage, with a lit edge.
  if (stage > 0) {
    const lines = Math.round((stage / (EGG_STAGES - 1)) * CRACK.length);
    const crack: Path = () => {
      ctx.beginPath();
      ctx.moveTo(CX + 3, CY - RY + 1);
      for (const [dx, dy] of CRACK.slice(0, Math.max(1, lines)))
        ctx.lineTo(CX + dx, CY + dy);
    };
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'round';
    crack();
    ctx.strokeStyle = SHELL_LINE;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.save();
    ctx.translate(0.9, 0.7);
    crack();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
    if (stage >= EGG_STAGES - 1) {
      // Chips lifting off the shell.
      for (const [dx, dy] of [
        [-2, -14],
        [12, -2],
        [-1, 10],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(CX + dx, CY + dy);
        ctx.lineTo(CX + dx + 3.5, CY + dy - 1);
        ctx.lineTo(CX + dx + 1.5, CY + dy + 2.5);
        ctx.closePath();
        ctx.fillStyle = lit(SHELL, 0.8);
        ctx.fill();
        ctx.strokeStyle = SHELL_LINE;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  shell();
  ctx.strokeStyle = SHELL_LINE;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** The tile is 64 units wide; callers scaling a canvas need the number. */
export const EGG_TILE = S;
