import { PowerUpKind } from '@libs/game-core';

/** Every item a round can hand out, in the order the gallery shows them. */
export const ITEM_IDS: readonly PowerUpKind[] = [
  'egg',
  'bomb',
  'fire',
  'speed',
  'pierce',
  'remote',
  'vest',
  'glove',
  'kick',
];

export function isItemId(value: string): value is PowerUpKind {
  return (ITEM_IDS as readonly string[]).includes(value);
}

/**
 * How cracked the egg is `elapsedMs` after "hatch" was pressed: it opens over
 * two seconds, then rests whole again.
 */
export function hatchStage(elapsedMs: number, stages: number): number {
  if (elapsedMs < 0 || elapsedMs >= 2400) return 0;
  return Math.min(stages - 1, Math.floor((elapsedMs / 2000) * stages));
}
