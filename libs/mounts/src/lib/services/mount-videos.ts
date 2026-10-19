import { InjectionToken } from '@angular/core';
import { DemoVideos } from '@libs/game-client';

/** Plays the little videos of the cards; a token so unit tests can hand in a fake (no canvas there). */
export type MountVideosFactory = (canvases: readonly HTMLCanvasElement[]) => {
  stop(): void;
};

export const MOUNT_VIDEOS = new InjectionToken<MountVideosFactory>(
  'MOUNT_VIDEOS',
  {
    factory: () => (canvases) => new DemoVideos(canvases),
  },
);
