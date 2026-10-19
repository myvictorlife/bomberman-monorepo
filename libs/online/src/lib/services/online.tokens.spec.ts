import { TestBed } from '@angular/core/testing';
import { connectToArena, mountArena } from '@libs/game-client';
import { ARENA_CONNECTOR, ONLINE_ARENA_LAUNCHER } from './online.tokens';

describe('online tokens', () => {
  it('default to the real connection and the real arena', () => {
    expect(TestBed.inject(ARENA_CONNECTOR)).toBe(connectToArena);
    expect(TestBed.inject(ONLINE_ARENA_LAUNCHER)).toBe(mountArena);
  });
});
