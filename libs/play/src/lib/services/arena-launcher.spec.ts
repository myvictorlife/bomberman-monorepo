import { TestBed } from '@angular/core/testing';
import { mountArena } from '@libs/game-client';
import { ARENA_LAUNCHER } from './arena-launcher';

describe('ARENA_LAUNCHER', () => {
  it('starts the real Phaser arena unless a test or mode overrides it', () => {
    expect(TestBed.inject(ARENA_LAUNCHER)).toBe(mountArena);
  });
});
