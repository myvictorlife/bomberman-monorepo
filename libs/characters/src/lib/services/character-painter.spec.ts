import { TestBed } from '@angular/core/testing';
import { paintCharacterFrame, paintMountIcon } from '@libs/game-client';
import { CHARACTER_PAINTER, MOUNT_ICON_PAINTER } from './character-painter';

describe('painter tokens', () => {
  it("paint with the game's own painters unless a test swaps them", () => {
    expect(TestBed.inject(CHARACTER_PAINTER)).toBe(paintCharacterFrame);
    expect(TestBed.inject(MOUNT_ICON_PAINTER)).toBe(paintMountIcon);
  });
});
