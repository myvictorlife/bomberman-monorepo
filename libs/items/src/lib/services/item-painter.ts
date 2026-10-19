import { InjectionToken } from '@angular/core';
import { paintItem } from '@libs/game-client';

/**
 * How the pages paint an item. A token so unit tests can swap in a fake — the
 * real painter needs a 2D canvas the test DOM lacks.
 */
export const ITEM_PAINTER = new InjectionToken<typeof paintItem>(
  'ITEM_PAINTER',
  {
    factory: () => paintItem,
  },
);
