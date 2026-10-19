import { CharacterId, Direction, MountId } from '@libs/game-core';
import {
  paintCartoonCharacter,
  paintCartoonMountIcon,
} from './cartoon/cartoon';
import { MOUNTED_HEADROOM } from './cartoon/ink';

/** Side of a character frame, in texture pixels. */
export const CHARACTER_TILE = 64;

export interface CharacterFrame {
  characterId: CharacterId;
  facing: Direction;
  /** 0 = standing, 1 and 2 = the two steps of the walk cycle. */
  frame: number;
  /** Player slot, 0–3: picks the team colour. Defaults to the first. */
  slot?: number;
  /** Riding this mount instead of on foot. */
  mountId?: MountId | null;
}

export type CharacterPainter = (
  doc: Document,
  frame: CharacterFrame,
) => HTMLCanvasElement;
export type MountIconPainter = (
  doc: Document,
  mountId: MountId,
  slot?: number,
) => HTMLCanvasElement;

function canvasFor(
  doc: Document,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = doc.createElement('canvas');
  canvas.width = CHARACTER_TILE;
  canvas.height = CHARACTER_TILE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
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
  const [canvas, ctx] = canvasFor(doc);
  if (frame.mountId) {
    // The rider's head rises above the cell: shrink the whole frame to fit the square.
    const fit = CHARACTER_TILE / (CHARACTER_TILE + MOUNTED_HEADROOM);
    ctx.translate((CHARACTER_TILE * (1 - fit)) / 2, 0);
    ctx.scale(fit, fit);
    ctx.translate(0, MOUNTED_HEADROOM);
  }
  paintCartoonCharacter(ctx, {
    characterId: frame.characterId,
    facing: frame.facing,
    frame: frame.frame,
    slot: frame.slot ?? 0,
    mountId: frame.mountId ?? null,
  });
  return canvas;
};

/** The framed portrait of a mount, for lists. */
export const paintMountIcon: MountIconPainter = (doc, mountId, slot = 0) => {
  const [canvas, ctx] = canvasFor(doc);
  paintCartoonMountIcon(ctx, mountId, slot);
  return canvas;
};
