import { START_KIT } from '@libs/game-core';
import { kitBadges } from './kit-view';

describe('kit view', () => {
  it('draws a kit as badges, with nothing timed running', () => {
    expect(kitBadges({ ...START_KIT, maxBombs: 3, mountId: 'pato' })).toEqual({
      bombs: 3,
      fire: START_KIT.fireRange,
      speed: 0,
      pierce: false,
      remote: false,
      glove: false,
      kick: false,
      wallPass: false,
      powerBomb: false,
      vestSeconds: 0,
      mount: 'pato',
      abilityReadyIn: 0,
      abilityActive: false,
    });
  });
});
