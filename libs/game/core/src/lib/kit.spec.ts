import { sanitizeProgress } from './campaign';
import { isMountId } from './characters';
import { MAX_BOMBS, MAX_FIRE, MAX_SPEED_LEVEL } from './constants';
import { createGame } from './game';
import { applyKit, kitOf, PlayerKit, sanitizeKit, START_KIT } from './kit';

const strong: PlayerKit = {
  maxBombs: 4,
  fireRange: 5,
  speedLevel: 2,
  pierce: true,
  remote: false,
  glove: true,
  kick: true,
  wallPass: true,
  powerBomb: false,
  mountId: 'pato',
};

describe('player kit', () => {
  it('starts a player with the kit they bring, instead of the starting one', () => {
    const state = createGame({
      seed: 1,
      stageId: 'gramado-2',
      players: [{ id: 'p1', name: 'P1', kit: strong }],
    });
    const p1 = state.players[0];

    expect(p1 && kitOf(p1)).toEqual(strong);
  });

  it('starts with the starting kit when none is brought', () => {
    const state = createGame({ seed: 1, players: [{ id: 'p1', name: 'P1' }] });
    const p1 = state.players[0];

    expect(p1 && kitOf(p1)).toEqual(START_KIT);
  });

  it('never grows past the limits, nor below the start', () => {
    expect(
      sanitizeKit({ maxBombs: 99, fireRange: 99, speedLevel: 99 }),
    ).toEqual(
      expect.objectContaining({
        maxBombs: MAX_BOMBS,
        fireRange: MAX_FIRE,
        speedLevel: MAX_SPEED_LEVEL,
      }),
    );
    expect(
      sanitizeKit({ maxBombs: -3, fireRange: 'x', speedLevel: 1.7 }),
    ).toEqual({ ...START_KIT, speedLevel: 1 });
    expect(sanitizeKit(null)).toEqual(START_KIT);
    expect(sanitizeKit({ mountId: 'dragao', pierce: 'yes' })).toEqual(
      START_KIT,
    );
  });

  it('is applied within the limits', () => {
    const state = createGame({ seed: 1, players: [{ id: 'p1', name: 'P1' }] });
    const p1 = state.players[0];
    if (!p1) throw new Error('no player');

    applyKit(p1, { ...strong, maxBombs: 50 });

    expect(p1.maxBombs).toBe(MAX_BOMBS);
    expect(p1.mountId).toBe('pato');
  });

  it('travels in the campaign progress, cleaned like the rest', () => {
    expect(sanitizeProgress({ cleared: [], kit: strong })).toEqual({
      cleared: [],
      kit: strong,
    });
    expect(sanitizeProgress({ cleared: [] })).toEqual({ cleared: [] });
    expect(
      sanitizeProgress({ cleared: [], kit: { maxBombs: 99 } }).kit?.maxBombs,
    ).toBe(MAX_BOMBS);
  });

  it('knows the mounts by id', () => {
    expect(isMountId('tatu')).toBe(true);
    expect(isMountId('dragao')).toBe(false);
  });
});
