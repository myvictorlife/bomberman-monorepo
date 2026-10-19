import { InjectionToken } from '@angular/core';
import { ArenaLauncher, mountArena } from '@libs/game-client';

/**
 * How the page starts a match. A token rather than a direct call so unit tests
 * can swap in a fake — Phaser needs a real WebGL/canvas the test DOM lacks —
 * and so the online mode can later provide a launcher that joins a server room.
 */
export const ARENA_LAUNCHER = new InjectionToken<ArenaLauncher>(
  'ARENA_LAUNCHER',
  {
    factory: () => mountArena,
  },
);
