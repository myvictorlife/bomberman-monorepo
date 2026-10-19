import { Direction, PLAYER_COLOR_IDS, PlayerColorId } from '@libs/game-core';

/**
 * The cartoon style every character and mount is drawn in: thick ink outline,
 * flat colour, one cel shade on the lower right. All coordinates are in a
 * 64 × 64 logical space; the caller scales the context.
 */
export type Ctx = CanvasRenderingContext2D;

export const TAU = Math.PI * 2;

/**
 * How big a rider is on a mount, against the same character on foot. Below
 * about 0.8 the rider reads as a child on a toy; above it the head leaves the
 * frame, which is why mounted frames get {@link MOUNTED_HEADROOM} on top.
 */
export const RIDER_SCALE = 0.92;
/**
 * Extra room above a mounted frame, in the 64-unit space: the mount stands
 * in the usual 64 × 64 cell and the rider's head rises into this strip, the
 * way a tall sprite overlaps the row above in a 3/4 view.
 */
export const MOUNTED_HEADROOM = 18;
export const INK = '#1c1511';

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
  width = 1.8,
  stroke = INK,
): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function inkOnly(ctx: Ctx, width = 1.8): void {
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
