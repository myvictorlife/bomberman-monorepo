import { BOSSES, CREATURES } from '@libs/game-core';
import { BOSS_ART, circle, CREATURE_ART, ellipse } from './creature-art';
import { artFor } from './paint-creature';

describe('creature art', () => {
  it('draws every creature and boss of the catalogue', () => {
    for (const c of CREATURES)
      expect(CREATURE_ART[c.id].parts.length).toBeGreaterThan(0);
    for (const b of BOSSES)
      expect(BOSS_ART[b.id].parts.length).toBeGreaterThan(0);
  });

  it('picks the art by subject', () => {
    expect(artFor({ creature: 'pombo' })).toBe(CREATURE_ART.pombo);
    expect(artFor({ boss: 'rainha' })).toBe(BOSS_ART.rainha);
  });

  it('writes circles and ellipses as closed paths', () => {
    expect(ellipse(10, 20, 4, 2)).toBe('M6 20 a4 2 0 1 0 8 0 a4 2 0 1 0 -8 0z');
    expect(circle(10, 20, 4)).toBe(ellipse(10, 20, 4, 4));
  });
});
