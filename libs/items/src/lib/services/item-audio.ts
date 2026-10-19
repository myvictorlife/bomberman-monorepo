import { InjectionToken } from '@angular/core';
import { Sfx, SoundEffect, Voice } from '@libs/game-client';
import { PowerUpKind } from '@libs/game-core';

/** The effects and the announcer, for hearing an item's sounds on its page. */
export interface ItemAudio {
  sfx: Sfx;
  voice: Voice;
}

/**
 * Made once per visit to the items (provided on the route). A token so unit
 * tests can swap in fakes — the real ones need Web Audio and speech.
 */
export const ITEM_AUDIO = new InjectionToken<ItemAudio>('ITEM_AUDIO', {
  factory: () => ({ sfx: new Sfx(), voice: new Voice() }),
});

/** The effects an item plays in a match: its pick-up, and for the egg every mount's call. */
export function itemEffects(kind: PowerUpKind): SoundEffect[] {
  if (kind === 'egg')
    return [
      'hatch',
      'mount-tatu',
      'mount-pato',
      'mount-bernardo',
      'mount-capivara',
      'mount-galinha',
      'ability',
      'mount-lost',
    ];
  if (kind === 'glove') return ['power-up', 'throw'];
  if (kind === 'kick') return ['power-up', 'kick'];
  return ['power-up'];
}
