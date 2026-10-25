import { CharacterId, Direction, MountId } from '@libs/game-core';
import {
  CartoonPose,
  paintCartoonCharacter,
  paintCartoonMountIcon,
} from './cartoon/cartoon';
import { CHARACTER_HEADROOM, MOUNTED_HEADROOM, rimLight } from './cartoon/ink';

/** Side of a character frame, in art units: every painter draws in 64 × 64. */
export const CHARACTER_TILE = 64;

/**
 * Pixels per CSS pixel on this screen, 1 to 3: a frame painted for `size`
 * CSS pixels gets that many pixels per unit of its side, so a dense screen
 * shows it sharp instead of scaling a 64 px canvas up.
 */
export function characterPixelRatio(): number {
  return Math.min(3, Math.max(1, globalThis.devicePixelRatio ?? 1));
}

export interface CharacterFrame {
  characterId: CharacterId;
  facing: Direction;
  /** 0 = standing, 1 and 2 = the two steps of the walk cycle. */
  frame: number;
  /** Player slot, 0–3: picks the team colour. Defaults to the first. */
  slot?: number;
  /** Riding this mount instead of on foot. */
  mountId?: MountId | null;
  /**
   * Rendered side, in CSS pixels: the canvas is painted at that size times
   * the screen's pixel ratio, so it stays sharp. Defaults to one tile.
   */
  size?: number;
}

export type CharacterPainter = (
  doc: Document,
  frame: CharacterFrame,
) => HTMLCanvasElement;
export type MountIconPainter = (
  doc: Document,
  mountId: MountId,
  slot?: number,
  /** Rendered side, in CSS pixels; see {@link CharacterFrame.size}. */
  size?: number,
) => HTMLCanvasElement;

/**
 * A square canvas for `size` CSS pixels, as many pixels as the screen shows
 * for them, with its context scaled so the painters keep drawing in 64 units.
 */
function canvasFor(
  doc: Document,
  size = CHARACTER_TILE,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = doc.createElement('canvas');
  const pixels = Math.max(1, Math.round(size * characterPixelRatio()));
  canvas.width = pixels;
  canvas.height = pixels;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ctx.scale(pixels / CHARACTER_TILE, pixels / CHARACTER_TILE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [canvas, ctx];
}

/**
 * Paints one frame of a character outside the arena — for the roster, a
 * selection screen or a HUD. The same painter draws the arena textures, so
 * what the player picks is exactly what walks into the arena.
 */
export const paintCharacterFrame: CharacterPainter = (doc, frame) => {
  const [canvas, ctx] = canvasFor(doc, frame.size);
  paintCharacterInTile(ctx, {
    characterId: frame.characterId,
    facing: frame.facing,
    frame: frame.frame,
    slot: frame.slot ?? 0,
    mountId: frame.mountId ?? null,
  });
  rimLight(ctx, canvas.width / CHARACTER_TILE);
  return canvas;
};

/**
 * Paints a character whole into a context whose unit space is one tile
 * (64 per side). In the arena the head rises above its cell; here the frame
 * shrinks so the head fits inside the square instead of being cut off.
 */
export function paintCharacterInTile(
  ctx: CanvasRenderingContext2D,
  pose: CartoonPose,
): void {
  const headroom = pose.mountId ? MOUNTED_HEADROOM : CHARACTER_HEADROOM;
  const fit = CHARACTER_TILE / (CHARACTER_TILE + headroom);
  ctx.save();
  ctx.translate((CHARACTER_TILE * (1 - fit)) / 2, 0);
  ctx.scale(fit, fit);
  ctx.translate(0, headroom);
  paintCartoonCharacter(ctx, pose);
  ctx.restore();
}

/** The framed portrait of a mount, for lists. */
export const paintMountIcon: MountIconPainter = (
  doc,
  mountId,
  slot = 0,
  size,
) => {
  const [canvas, ctx] = canvasFor(doc, size);
  paintCartoonMountIcon(ctx, mountId, slot);
  return canvas;
};
