import { FLAME_TICKS } from '@libs/game-core';

/** Which flame texture a flame shows as it burns: grows in, holds at full size, then flickers out. */
export function flameFrame(ticksLeft: number): number {
  const t = 1 - ticksLeft / FLAME_TICKS;
  if (t < 0.1) return 2;
  if (t < 0.2) return 1;
  if (t < 0.65) return 0;
  if (t < 0.8) return 1;
  if (t < 0.9) return 2;
  return 3;
}
