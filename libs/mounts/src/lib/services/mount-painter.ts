import { InjectionToken } from '@angular/core';
import {
  CharacterPainter,
  MountIconPainter,
  paintCharacterFrame,
  paintMountIcon,
} from '@libs/game-client';

/**
 * How a rider on a mount, and a mount's portrait, get painted. Tokens so unit
 * tests can hand in fakes — the painters need a 2D canvas the test DOM does
 * not have.
 */
export const MOUNT_SPRITE_PAINTER = new InjectionToken<CharacterPainter>(
  'MOUNT_SPRITE_PAINTER',
  {
    factory: () => paintCharacterFrame,
  },
);

export const MOUNT_PORTRAIT_PAINTER = new InjectionToken<MountIconPainter>(
  'MOUNT_PORTRAIT_PAINTER',
  {
    factory: () => paintMountIcon,
  },
);
