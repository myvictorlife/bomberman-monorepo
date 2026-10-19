import { HD_TILE as S } from './hd-palette';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const OUTLINE = 'rgba(8, 10, 16, 0.78)';

/** How many crack stages the egg has: 0 is whole, the last is about to open. */
export const EGG_STAGES = 4;

/** The egg's patches: teal, the arena's own accent — nobody else's green. */
const PATCH = '#35bfb2';
const PATCH_SHADE = '#1f8f85';

export interface EggPaintOptions {
  /** 0 = whole … EGG_STAGES - 1 = cracked open to the last line. */
  stage?: number;
  /** Tilt in radians, for the wobble. */
  tilt?: number;
}

/** An egg: wider at the bottom, pointier at the top. */
function eggPath(
  ctx: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.bezierCurveTo(
    cx + rx * 0.95,
    cy - ry,
    cx + rx,
    cy + ry * 0.35,
    cx + rx * 0.72,
    cy + ry * 0.8,
  );
  ctx.bezierCurveTo(
    cx + rx * 0.45,
    cy + ry * 1.05,
    cx - rx * 0.45,
    cy + ry * 1.05,
    cx - rx * 0.72,
    cy + ry * 0.8,
  );
  ctx.bezierCurveTo(
    cx - rx,
    cy + ry * 0.35,
    cx - rx * 0.95,
    cy - ry,
    cx,
    cy - ry,
  );
  ctx.closePath();
}

/**
 * A soft organic blob: a wobbly radius sampled around a circle, joined with
 * quadratic curves through the midpoints so nothing has a corner.
 */
function blob(ctx: Ctx, x: number, y: number, r: number, k: number): void {
  const n = 10;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr =
      r * (1 + 0.18 * Math.sin(a * 2 + k) + 0.1 * Math.cos(a * 3 + k * 1.7));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.88]);
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

const PATCHES: readonly [number, number, number, number][] = [
  [-14, -9, 9.5, 0.4],
  [12, -1, 8.5, 1.9],
  [-5, 15, 10, 3.1],
  [14, 16, 7, 0.9],
  [3, -19, 5.5, 2.4],
];

const CRACK: readonly [number, number][] = [
  [6, -14],
  [1, -9],
  [8, -4],
  [2, 2],
  [9, 7],
];

/**
 * The egg a mount hatches from: big, on the floor with its shadow, lit from
 * the upper left with the arena's cool rim light, teal patches, and a crack
 * that grows with `stage`. Painted in the tile's 64-unit space.
 */
export function paintEgg(ctx: Ctx, options: EggPaintOptions = {}): void {
  const stage = Math.max(0, Math.min(EGG_STAGES - 1, options.stage ?? 0));
  const cx = 32;
  const cy = 34;
  const rx = 18;
  const ry = 21;

  ctx.beginPath();
  ctx.ellipse(32, 57, 17, 5, 0, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  ctx.save();
  ctx.translate(32, 50);
  ctx.rotate(options.tilt ?? 0);
  ctx.translate(-32, -50);

  // Shell: three tones of light.
  eggPath(ctx, cx, cy, rx, ry);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  const g = ctx.createRadialGradient(cx - 7, cy - 10, 3, cx, cy, 26);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#f6f1e3');
  g.addColorStop(1, '#c9c0a4');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  // Patches, clipped to the shell: the shade first, then the colour shifted
  // up-left so a soft dark crescent stays on the lower right.
  ctx.save();
  eggPath(ctx, cx, cy, rx, ry);
  ctx.clip();
  for (const [dx, dy, r, k] of PATCHES) {
    const x = cx + dx;
    const y = cy + dy;
    blob(ctx, x, y, r, k);
    ctx.fillStyle = PATCH_SHADE;
    ctx.fill();
    ctx.save();
    blob(ctx, x, y, r, k);
    ctx.clip();
    blob(ctx, x - 1.4, y - 1.6, r, k);
    ctx.fillStyle = PATCH;
    ctx.fill();
    blob(ctx, x - 3, y - 3.4, r * 0.55, k + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.restore();
  }
  // Rim light on the shadow side, cool like the arena.
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 2, rx - 2, ry - 2, 0, -0.2, 1.4);
  ctx.stroke();
  ctx.restore();

  // Shine.
  ctx.save();
  ctx.translate(cx - 7, cy - 11);
  ctx.rotate(-0.6);
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.5, 2.6, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 15, 1.3, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();

  // The crack, one more line per stage.
  if (stage > 0) {
    const lines = Math.round((stage / (EGG_STAGES - 1)) * CRACK.length);
    ctx.strokeStyle = '#3a2f24';
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - ry + 1);
    for (const [dx, dy] of CRACK.slice(0, Math.max(1, lines)))
      ctx.lineTo(cx + dx, cy + dy);
    ctx.stroke();
    if (stage >= EGG_STAGES - 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + 3, cy - ry + 2);
      ctx.lineTo(cx + 7, cy - 13);
      ctx.stroke();
    }
  }

  eggPath(ctx, cx, cy, rx, ry);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** The tile is 64 units wide; callers scaling a canvas need the number. */
export const EGG_TILE = S;
