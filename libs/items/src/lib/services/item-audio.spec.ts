import { TestBed } from '@angular/core/testing';
import { Sfx, Voice } from '@libs/game-client';
import { ITEM_AUDIO, itemEffects } from './item-audio';

describe('item audio', () => {
  it('builds the real players unless a test overrides them', () => {
    const audio = TestBed.inject(ITEM_AUDIO);

    expect(audio.sfx).toBeInstanceOf(Sfx);
    expect(audio.voice).toBeInstanceOf(Voice);
  });

  it('knows which effects belong to an item', () => {
    expect(itemEffects('fire')).toEqual(['power-up']);
    expect(itemEffects('egg')).toContain('mount-pato');
    expect(itemEffects('egg')).toContain('hatch');
  });
});
