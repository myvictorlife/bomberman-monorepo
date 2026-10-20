import { BossId, CreatureId } from '@libs/game-core';
import { ART_INK, BOSS_ART, CREATURE_ART, CreatureArt } from './creature-art';

/** What to paint: a creature or a boss, by id. */
export type CreatureSubject =
  | { readonly creature: CreatureId }
  | { readonly boss: BossId };

export interface CreatureFrame {
  readonly subject: CreatureSubject;
  /** Side of the canvas, in texture pixels. */
  readonly size: number;
  /** Mirror to face left; the art faces right. */
  readonly flip?: boolean;
}

export type CreaturePainter = (
  doc: Document,
  frame: CreatureFrame,
) => HTMLCanvasElement;

export function artFor(subject: CreatureSubject): CreatureArt {
  return 'creature' in subject
    ? CREATURE_ART[subject.creature]
    : BOSS_ART[subject.boss];
}

/**
 * Paints one creature or boss on a fresh canvas — for the campaign pages and,
 * later, the arena's textures. Every part is filled, then outlined in ink.
 */
export const paintCreatureFrame: CreaturePainter = (doc, frame) => {
  const canvas = doc.createElement('canvas');
  canvas.width = frame.size;
  canvas.height = frame.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  const art = artFor(frame.subject);
  const scale = frame.size / art.box;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (frame.flip) {
    ctx.translate(frame.size, 0);
    ctx.scale(-1, 1);
  }
  ctx.scale(scale, scale);
  for (const part of art.parts) {
    const path = new Path2D(part.d);
    if (part.fill) {
      ctx.fillStyle = part.fill;
      ctx.fill(path);
    }
    if (part.stroke !== 'none') {
      ctx.strokeStyle = part.stroke ?? ART_INK;
      ctx.lineWidth = part.width ?? 4;
      ctx.stroke(path);
    }
  }
  return canvas;
};
