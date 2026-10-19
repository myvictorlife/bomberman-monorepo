import { InjectionToken } from '@angular/core';
import { DemoVideos, paintArenaTile } from '@libs/game-client';

/** Something that plays the arena videos and can be stopped when the page is left. */
export interface ArenaVideos {
  stop(): void;
}

/**
 * How the pages play an arena's little match on a canvas, and paint one tile
 * of it. Tokens so unit tests can swap in fakes — the real ones need a 2D
 * canvas the test DOM lacks.
 */
export const ARENA_DEMO_VIDEOS = new InjectionToken<
  (canvases: HTMLCanvasElement[]) => ArenaVideos
>('ARENA_DEMO_VIDEOS', {
  factory: () => (canvases) => new DemoVideos(canvases),
});

export const ARENA_TILE_PAINTER = new InjectionToken<typeof paintArenaTile>(
  'ARENA_TILE_PAINTER',
  {
    factory: () => paintArenaTile,
  },
);
