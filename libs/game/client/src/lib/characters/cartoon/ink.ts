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
  ctx.shadowColor = RIM;
  ctx.shadowBlur = 0;
  const r = RIM_WIDTH * pixelsPerUnit;
  const far = source.width + source.height + 64;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.shadowOffsetX = far + Math.cos(a) * r;
    ctx.shadowOffsetY = Math.sin(a) * r;
    ctx.drawImage(copy, -far, 0);
  }
  ctx.restore();
}
