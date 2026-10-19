import {
  BOMB_FLIGHT_TICKS_PER_CELL,
  CARRY_TICKS,
  GLOVE_THROW_CELLS,
  STUN_TICKS,
} from './constants';
import { eliminatePlayer, tick } from './game';
import { input, openArena, player, run, setBlock } from './testing.spec-helper';
import { GameState } from './types';

/** p1 with the glove on (1, 1) facing right, p2 right next to them on (2, 1). */
function faceToFace(): GameState {
  const state = openArena();
  const p1 = player(state, 'p1');
  p1.glove = true;
  p1.facing = 'right';
  const p2 = player(state, 'p2');
  p2.x = 2;
  p2.y = 1;
  return state;
}

const press = (state: GameState, id = 'p1') =>
  tick(state, { [id]: input(null, true) });

/** Runs until p2 is back on the ground. */
function land(state: GameState): GameState {
  for (let i = 0; i < 200 && player(state, 'p2').flight; i++) tick(state, {});
  return state;
}

describe('the glove, on people', () => {
  it('lifts the player in front, who rides along and cannot move', () => {
    const state = faceToFace();
    press(state);
    expect(state.events).toContainEqual({
      type: 'player-grabbed',
      playerId: 'p1',
      targetId: 'p2',
    });
    expect(player(state, 'p1').carrying).toBe('p2');

    run(state, 20, { p1: input('down'), p2: input('right') });
    const p1 = player(state, 'p1');
    const p2 = player(state, 'p2');
    expect(p1.y).toBeGreaterThan(1);
    expect([p2.x, p2.y]).toEqual([p1.x, p1.y]);
    expect(state.bombs).toHaveLength(0);
  });

  it('throws them three cells the way the holder faces; they land dizzy', () => {
    const state = faceToFace();
    press(state);
    press(state);
    const p2 = player(state, 'p2');
    expect(state.events).toContainEqual({
      type: 'player-thrown',
      playerId: 'p1',
      targetId: 'p2',
    });
    expect(p2.flight).toMatchObject({ col: 1 + GLOVE_THROW_CELLS, row: 1 });
    expect(p2.flight?.landTick).toBe(
      state.tick + GLOVE_THROW_CELLS * BOMB_FLIGHT_TICKS_PER_CELL,
    );

    land(state);
    expect([p2.x, p2.y]).toEqual([1 + GLOVE_THROW_CELLS, 1]);
    // Dizzy: their keys do nothing for a moment, then work again.
    run(state, STUN_TICKS - 1, { p2: input('right') });
    expect(p2.x).toBe(1 + GLOVE_THROW_CELLS);
    run(state, 10, { p2: input('right') });
    expect(p2.x).toBeGreaterThan(1 + GLOVE_THROW_CELLS);
  });

  it('throws them over a crate, to the next free cell', () => {
    const state = faceToFace();
    setBlock(state, 4, 1);
    press(state);
    press(state);
    expect(player(state, 'p2').flight).toMatchObject({
      col: 5,
      row: 1,
      cells: 4,
    });
  });

  it('throws them off the top and they come down from the bottom', () => {
    const state = faceToFace();
    press(state);
    player(state, 'p1').facing = 'up';
    press(state);
    land(state);
    expect([player(state, 'p2').x, player(state, 'p2').y]).toEqual([
      1,
      state.rows - 4,
    ]);
  });

  it('keeps the held player out of the flames', () => {
    const state = faceToFace();
    press(state);
    player(state, 'p1').vestUntilTick = 10_000;
    state.flames.push({
      col: 1,
      row: 1,
      shape: 'center',
      ticksLeft: 20,
      ownerId: null,
    });
    tick(state, {});
    expect(player(state, 'p2').alive).toBe(true);
  });

  it('lets them wriggle free when held too long', () => {
    const state = faceToFace();
    press(state);
    run(state, CARRY_TICKS);
    expect(player(state, 'p2').carriedBy).toBeNull();
    expect(player(state, 'p1').carrying).toBeNull();
  });

  it('puts them down when the holder is out', () => {
    const state = faceToFace();
    press(state);
    eliminatePlayer(state, 'p1');
    const p2 = player(state, 'p2');
    expect(p2.carriedBy).toBeNull();
    expect(p2.alive).toBe(true);
    expect([p2.x, p2.y]).toEqual([1, 1]);
  });

  it('without the glove, the bomb key just drops a bomb', () => {
    const state = faceToFace();
    player(state, 'p1').glove = false;
    press(state);
    expect(player(state, 'p1').carrying).toBeNull();
    expect(state.bombs).toHaveLength(1);
  });

  it('cannot lift anyone far away', () => {
    const state = faceToFace();
    player(state, 'p2').x = 3;
    press(state);
    expect(player(state, 'p1').carrying).toBeNull();
    expect(state.bombs).toHaveLength(1);
  });
});
