import { TestBed } from '@angular/core/testing';
import { DemoVideos, paintArenaTile } from '@libs/game-client';
import { ARENA_DEMO_VIDEOS, ARENA_TILE_PAINTER } from './arena-preview-painter';

describe('arena painters', () => {
  it('paint with the real skin unless a test overrides them', () => {
    expect(TestBed.inject(ARENA_TILE_PAINTER)).toBe(paintArenaTile);
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    const videos = TestBed.inject(ARENA_DEMO_VIDEOS)([
      document.createElement('canvas'),
    ]);
    expect(videos).toBeInstanceOf(DemoVideos);
    videos.stop();
    getContext.mockRestore();
  });
});
