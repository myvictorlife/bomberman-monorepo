import { Direction, PLAYER_COLOR_IDS, PlayerColorId } from '@libs/game-core';

/**
 * The cartoon style every character and mount is drawn in: thick ink outline,
 * flat colour, one cel shade on the lower right. All coordinates are in a
 * 64 × 64 logical space; the caller scales the context.
 */
export type Ctx = CanvasRenderingContext2D;

export const TAU = Math.PI * 2;

/**
 * The cast's proportions, shared so every character reads the same way in a
 * 64 px cell: a stocky body — as tall as drawn, but wider — and a head scaled
 * up about the neck, the first thing the eye finds in an arena cartoon. Each
 * painter draws its body between {@link bodyFrame} and {@link headFrame} and
 * its head after.
 */
export const BODY_STRETCH = 1.28;
export const HEAD_SCALE = 1.35;
/** Where the head meets the body, in art units: the head grows about it. */
export const NECK_Y = 26;
/**
 * Extra room above an on-foot frame, in the 64-unit space, for the bigger
 * head and any hat: the figure stands in the usual 64 × 64 cell and overlaps
 * the row above, the way a tall sprite does in a 3/4 view.
 */
export const CHARACTER_HEADROOM = 14;
/** A rider is nearly the size it is on foot: the mount is drawn big enough to carry it. */
export const RIDER_SCALE = 0.94;
/**
 * Extra room above a mounted frame: the mount stands in the 64 × 64 cell and
 * the rider's head rises into this strip.
 */
export const MOUNTED_HEADROOM = 26;
export const INK = '#1c1511';
/** The pale rim behind every figure, so a dark outline still reads on a dark floor. */
export const RIM = 'rgba(255, 255, 255, 0.42)';
export const RIM_WIDTH = 1.1;
/** The near-black silhouette line drawn just outside every figure, before the rim. */
export const SILHOUETTE = 'rgba(28, 21, 17, 0.92)';
export const SILHOUETTE_WIDTH = 0.8;

/**
 * Team colours: the suit panel and the light. Indexed like `PLAYER_COLOR_IDS`
 * — the first five are the slot colours of a round where nobody picked one —
 * so the `slot` a painter receives is a colour index ({@link colorSlot}).
 */
export interface TeamColors {
  readonly suit: string;
  readonly suitDark: string;
  readonly suitLight: string;
  readonly glow: string;
}

export const TEAM_COLORS: readonly TeamColors[] = [
  {
    suit: '#3d7bdc',
    suitDark: '#1f4a92',
    suitLight: '#6fa3ff',
    glow: '#5fd3ff',
  },
  {
    suit: '#39404f',
    suitDark: '#1c202a',
    suitLight: '#5b6477',
    glow: '#ffb547',
  },
  {
    suit: '#e8575a',
    suitDark: '#8a2326',
    suitLight: '#ff9a97',
    glow: '#fff1c2',
  },
  {
    suit: '#f1c744',
    suitDark: '#9a7a14',
    suitLight: '#ffe489',
    glow: '#a9ff6b',
  },
  {
    suit: '#3fb67a',
    suitDark: '#1d6b45',
    suitLight: '#7fe0aa',
    glow: '#ffd34d',
  },
  {
    suit: '#8b5cf6',
    suitDark: '#4c2a96',
    suitLight: '#b99cff',
    glow: '#7df0ff',
  },
  {
    suit: '#f08a3c',
    suitDark: '#94481a',
    suitLight: '#ffb67d',
    glow: '#fff1c2',
  },
  {
    suit: '#e86aa6',
    suitDark: '#8f2c5e',
    suitLight: '#ff9fcb',
    glow: '#ffe066',
  },
];

/** The painter's `slot` for a colour: its place in `PLAYER_COLOR_IDS`. */
export function colorSlot(color: PlayerColorId): number {
  return PLAYER_COLOR_IDS.indexOf(color);
}

export function teamFor(slot: number): TeamColors {
  return TEAM_COLORS[
    ((slot % TEAM_COLORS.length) + TEAM_COLORS.length) % TEAM_COLORS.length
  ] as TeamColors;
}

export interface CharacterPose {
  facing: Direction;
  /** 0 = standing, 1 and 2 = the two steps of the walk cycle. */
  frame: number;
  slot: number;
  /** Seconds, for idle motion. Omit for a still frame. */
  t?: number;
  /** 0 = eyes open, 1 = closed. */
  blink?: number;
  /** Drawn sitting on a mount: legs hang, hands hold the reins. */
  seated?: boolean;
}

export interface MountPose extends CharacterPose {
  /** `false` draws the mount alone. */
  rider?: boolean;
  riderBlink?: number;
}

export type CharacterPainter = (ctx: Ctx, pose: CharacterPose) => void;
export type MountPainter = (ctx: Ctx, pose: MountPose) => void;

export type Path = () => void;

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
  rot = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

/** Fills the current path and inks its outline. */
export function fillStroke(
  ctx: Ctx,
  fill: string,
  width = 2.1,
  stroke = INK,
): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function inkOnly(ctx: Ctx, width = 2.1): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

/**
 * One flat darker tone on the lower-right of a shape: the shape is clipped to
 * itself, then everything outside a copy shifted up-left is painted with the
 * shade.
 */
export function shadeRight(
  ctx: Ctx,
  path: Path,
  shade: string,
  dx = 1.8,
  dy = 1.4,
): void {
  ctx.save();
  path();
  ctx.clip();
  ctx.beginPath();
  ctx.rect(-10, -10, 90, 90);
  ctx.translate(dx, dy);
  path();
  ctx.closePath();
  ctx.fillStyle = shade;
  ctx.fill('evenodd');
  ctx.restore();
}

export function glowFill(ctx: Ctx, color: string, blur: number): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Frame 3: crouched, hands low in front — setting a bomb down. */
export const FRAME_PLACE = 3;
/** Frame 4: arms up, one knee up — the winner's cheer. */
export const FRAME_CHEER = 4;

/** Standing, step, standing, other step — the arena's walk cycle. */
export const CARTOON_WALK_CYCLE: readonly number[] = [1, 0, 2, 0];

/** The shared head shape, so the three faces sit on the same skull. */
export function headPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(22, 12);
  ctx.quadraticCurveTo(22, 4, 32, 4);
  ctx.quadraticCurveTo(42, 4, 42, 12);
  ctx.quadraticCurveTo(43, 21, 36, 24.5);
  ctx.quadraticCurveTo(32, 26, 28, 24.5);
  ctx.quadraticCurveTo(21, 21, 22, 12);
  ctx.closePath();
}

/** Mirrors the context for a left-facing frame; returns whether it did. */
export function beginFrame(ctx: Ctx, facing: Direction): void {
  ctx.save();
  if (facing === 'left') {
    ctx.translate(64, 0);
    ctx.scale(-1, 1);
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

export function stepOf(frame: number): -1 | 0 | 1 {
  return frame === 1 ? 1 : frame === 2 ? -1 : 0;
}

/** Starts the body: everything until {@link headFrame} is drawn {@link BODY_STRETCH} wider. */
export function bodyFrame(ctx: Ctx): void {
  ctx.save();
  ctx.translate(32, 0);
  ctx.scale(BODY_STRETCH, 1);
  ctx.translate(-32, 0);
}

/**
 * Ends the body and starts the head, scaled {@link HEAD_SCALE} about the neck
 * and lifted by the body's `bob`. The painter's closing `restore` pairs with it.
 */
export function headFrame(ctx: Ctx, bob: number): void {
  ctx.restore();
  ctx.save();
  ctx.translate(32, NECK_Y + bob);
  ctx.scale(HEAD_SCALE, HEAD_SCALE);
  ctx.translate(-32, -NECK_Y);
}

/**
 * How much wider a mount is drawn than its painter's coordinates: seen from
 * the front or the back it is a block as wide as from the side.
 */
export function mountStretch(facing: Direction): number {
  return facing === 'left' || facing === 'right' ? 1 : 1.4;
}
/** How much taller a mount is drawn, about its feet: a body to carry a rider's big head. */
export const MOUNT_RISE = 1.18;
/** The line the mount's feet stand on, in art units; it grows upward from here. */
const MOUNT_FEET_Y = 60;

/** Starts a mount: its body is drawn {@link mountStretch} wider and {@link MOUNT_RISE} taller. Pairs with a closing `restore`. */
export function mountFrame(ctx: Ctx, facing: Direction): void {
  ctx.save();
  ctx.translate(32, MOUNT_FEET_Y);
  ctx.scale(mountStretch(facing), MOUNT_RISE);
  ctx.translate(-32, -MOUNT_FEET_Y);
}

/**
 * Inside a {@link mountFrame}: puts the rider's hips (32, 38) at `hx`, `hy`
 * of the mount, undoing the mount's stretch so the rider keeps its shape.
 * Pairs with a closing `restore`.
 */
export function riderFrame(
  ctx: Ctx,
  facing: Direction,
  hx: number,
  hy: number,
): void {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(RIDER_SCALE / mountStretch(facing), RIDER_SCALE / MOUNT_RISE);
  ctx.translate(-32, -38);
}

/**
 * A pale rim behind whatever the canvas holds: the figure's own shape, offset
 * in eight directions, under it. `pixelsPerUnit` is the canvas's scale.
 * Drawn off-canvas so only the shadow lands, behind the figure.
 */
export function rimLight(ctx: Ctx, pixelsPerUnit: number): void {
  const source = ctx.canvas;
  // A test's stand-in context has no canvas to copy.
  if (typeof source?.width !== 'number') return;
  const copy = source.ownerDocument.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext('2d')?.drawImage(source, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.shadowBlur = 0;
  const far = source.width + source.height + 64;
  // The dark silhouette first, right behind the figure; the pale rim behind that.
  for (const [color, width] of [
    [SILHOUETTE, SILHOUETTE_WIDTH],
    [RIM, SILHOUETTE_WIDTH + RIM_WIDTH],
  ] as const) {
    ctx.shadowColor = color;
    const r = width * pixelsPerUnit;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.shadowOffsetX = far + Math.cos(a) * r;
      ctx.shadowOffsetY = Math.sin(a) * r;
      ctx.drawImage(copy, -far, 0);
    }
  }
  ctx.restore();
}

// ── volume: a top-left light, coloured lines, occlusion and gloss ──────────

/** `#rrggbb` → [r, g, b]. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mixes `a` toward `b` by `t` (0 = `a`, 1 = `b`), as `#rrggbb`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

/**
 * The line of a material: its colour pulled most of the way to the ink, so
 * the inside of a figure is drawn in coloured lines and only the silhouette
 * (see {@link rimLight}) is near-black — what keeps it from reading as a
 * sticker.
 */
export function lineOf(color: string): string {
  return mix(color, INK, 0.7);
}

/** A tone lighter than `color`, for the side the light hits. */
export function lit(color: string, t = 0.28): string {
  return mix(color, '#ffffff', t);
}

/** A tone darker than `color`, for the side the light leaves. */
export function dim(color: string, t = 0.3): string {
  return mix(color, '#1a1420', t);
}

/**
 * Fills, inside `path`, the band that a copy of it shifted by (`dx`, `dy`)
 * leaves uncovered. Shifted down-right (positive) the band is on the
 * upper-left, the side the light hits; shifted up-left it is the core
 * shadow on the lower-right. Clipping only, so any path works.
 */
export function band(
  ctx: Ctx,
  path: Path,
  color: string,
  dx: number,
  dy: number,
): void {
  ctx.save();
  path();
  ctx.clip();
  ctx.translate(dx, dy);
  path();
  ctx.rect(-200, -200, 500, 500);
  ctx.clip('evenodd');
  ctx.translate(-dx, -dy);
  ctx.fillStyle = color;
  ctx.fillRect(-200, -200, 500, 500);
  ctx.restore();
}

/** Highlight on the lit side and core shadow on the far side of one shape. */
export function volume(
  ctx: Ctx,
  path: Path,
  color: string,
  highlight = 1.3,
  shadow = 1.9,
): void {
  band(ctx, path, dim(color), -shadow, -shadow * 0.75);
  band(ctx, path, lit(color), highlight, highlight * 0.75);
}

/**
 * Contact shadow: a dark gradient inside `path` from `y0` (full) fading out
 * by `y1`, for the skin under a brim, the chest under a chin, the legs under
 * a hem.
 */
export function occlude(
  ctx: Ctx,
  path: Path,
  y0: number,
  y1: number,
  strength = 0.28,
): void {
  ctx.save();
  path();
  ctx.clip();
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(20, 12, 10, ${strength})`);
  g.addColorStop(1, 'rgba(20, 12, 10, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(-200, Math.min(y0, y1) - 1, 500, Math.abs(y1 - y0) + 2);
  ctx.restore();
}

/** A soft white gloss, for a cap, a visor, a shoe's toe. */
export function gloss(
  ctx: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot = -0.5,
  alpha = 0.45,
): void {
  ellipse(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.fill();
}

/** A short stroke in a material's line colour: a fold, a seam, a lace. */
export function seam(
  ctx: Ctx,
  points: readonly (readonly [number, number])[],
  color: string,
  width = 1.1,
): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
