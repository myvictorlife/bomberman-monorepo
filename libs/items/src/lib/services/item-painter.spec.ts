import { TestBed } from '@angular/core/testing';
import { paintItem } from '@libs/game-client';
import { ITEM_PAINTER } from './item-painter';

describe('ITEM_PAINTER', () => {
  it('paints with the real skin unless a test overrides it', () => {
    expect(TestBed.inject(ITEM_PAINTER)).toBe(paintItem);
  });
});
