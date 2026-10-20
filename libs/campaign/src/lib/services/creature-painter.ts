import { InjectionToken } from '@angular/core';
import { CreaturePainter, paintCreatureFrame } from '@libs/game-client';

/**
 * How a creature or boss gets painted. A token so unit tests can hand in a
 * fake — the painter needs a 2D canvas the test DOM does not have.
 */
export const CREATURE_PAINTER = new InjectionToken<CreaturePainter>(
  'CREATURE_PAINTER',
  { factory: () => paintCreatureFrame },
);
