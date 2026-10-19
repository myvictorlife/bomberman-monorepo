import { InjectionToken } from '@angular/core';
import {
  CharacterPainter,
  MountIconPainter,
  paintCharacterFrame,
  paintMountIcon,
} from '@libs/game-client';

/**
 * How a sprite gets painted. Tokens so unit tests can hand in fakes — the
 * painters need a 2D canvas the test DOM does not have.
 */
export const CHARACTER_PAINTER = new InjectionToken<CharacterPainter>(
  'CHARACTER_PAINTER',
  {
    factory: () => paintCharacterFrame,
  },
);

export const MOUNT_ICON_PAINTER = new InjectionToken<MountIconPainter>(
  'MOUNT_ICON_PAINTER',
  {
    factory: () => paintMountIcon,
  },
);
